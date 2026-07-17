import 'reflect-metadata';

import { type CanActivate, type ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizationDomainError } from '@seneve/domain-organization';
import { OrganizationApplicationError } from '@seneve/organization-application';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_VERIFIER, AUTH_SESSION_VALIDATOR } from '../auth/auth.tokens.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import {
  InvitationAcceptanceController,
  OrganizationController,
} from './organization.controller.js';
import {
  ORGANIZATION_APPLICATION_SERVICE,
  ORGANIZATION_NOTIFICATION_SINK,
} from './organization.tokens.js';

describe('OrganizationController', () => {
  it('creates an organization through the application service', async () => {
    const { app, services, url } = await createApp();
    services.organizations.createOrganization.mockResolvedValue({
      organization: organizationFixture(),
    });

    const response = await request(url)
      .post('/organizations')
      .set('Authorization', 'Bearer valid')
      .send({
        displayName: 'Seneve Awards',
        slug: 'seneve-awards',
        defaultLocale: 'en',
        timezone: 'Africa/Lome',
      })
      .expect(201);

    expect(response.body.organization).toMatchObject({
      id: organizationFixture().id,
      displayName: 'Seneve Awards',
      status: 'ACTIVE',
    });
    expect(services.organizations.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        actorIdentityId: 'identity-1',
        slug: 'seneve-awards',
      }),
    );

    await app.close();
  });

  it('conceals permission denied as a stable public error', async () => {
    const { app, services, url } = await createApp();
    services.organizations.getOrganization.mockRejectedValue(
      new OrganizationApplicationError('PERMISSION_DENIED', 'Permission denied.'),
    );

    const response = await request(url)
      .get(`/organizations/${organizationFixture().id}`)
      .set('Authorization', 'Bearer valid')
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'PERMISSION_DENIED',
      message: 'Permission denied.',
    });

    await app.close();
  });

  it('creates invitations without exposing raw invitation tokens', async () => {
    const { app, services, url } = await createApp();
    services.organizations.createInvitation.mockResolvedValue({
      invitation: invitationFixture(),
      notification: {
        recipientEmail: 'member@example.com',
        template: 'organization.invitation',
        organizationId: organizationFixture().id,
        invitationId: invitationFixture().id,
        rawInvitationToken: 'raw-secret-invitation-token',
        invitationTokenId: '68d36544-d951-4f49-b41f-ff32b40dc010',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        correlationId: 'test',
      },
    });

    const response = await request(url)
      .post(`/organizations/${organizationFixture().id}/invitations`)
      .set('Authorization', 'Bearer valid')
      .send({
        email: 'member@example.com',
        role: 'VIEWER',
      })
      .expect(201);

    expect(JSON.stringify(response.body)).not.toContain('raw-secret-invitation-token');
    expect(services.notifications.invitationRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        rawInvitationToken: 'raw-secret-invitation-token',
      }),
    );

    await app.close();
  });

  it('maps last-owner domain protection to conflict', async () => {
    const { app, services, url } = await createApp();
    services.organizations.removeMembership.mockRejectedValue(
      new OrganizationDomainError('LAST_OWNER_REMOVAL_FORBIDDEN', 'Last owner cannot be removed.'),
    );

    await request(url)
      .delete(
        `/organizations/${organizationFixture().id}/memberships/5a7decc4-3ca2-4aa8-8888-b4f31ff9232c`,
      )
      .set('Authorization', 'Bearer valid')
      .expect(409);

    await app.close();
  });

  it('accepts invitation tokens through a dedicated route', async () => {
    const { app, services, url } = await createApp();
    services.organizations.acceptInvitation.mockResolvedValue({
      organization: organizationFixture(),
    });

    await request(url)
      .post('/invitations/accept')
      .set('Authorization', 'Bearer valid')
      .send({
        tokenId: '68d36544-d951-4f49-b41f-ff32b40dc010',
        token: 'raw-token',
        recipientEmail: 'member@example.com',
      })
      .expect(201);

    expect(services.organizations.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorIdentityId: 'identity-1',
        tokenId: '68d36544-d951-4f49-b41f-ff32b40dc010',
        rawInvitationToken: 'raw-token',
      }),
    );

    await app.close();
  });
});

async function createApp() {
  const services = createServices();
  const builder = Test.createTestingModule({
    controllers: [OrganizationController, InvitationAcceptanceController],
    providers: [
      {
        provide: TenantExecutionContext,
        useValue: new TenantExecutionContext(tenantContextProvider),
      },
      {
        provide: ACCESS_TOKEN_VERIFIER,
        useValue: {
          verify: vi.fn().mockResolvedValue({
            sub: 'identity-1',
            identityId: 'identity-1',
            sessionId: 'session-1',
            tokenVersion: 1,
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
          }),
        },
      },
      {
        provide: AUTH_SESSION_VALIDATOR,
        useValue: {
          validate: vi.fn().mockResolvedValue(true),
        },
      },
      { provide: ORGANIZATION_APPLICATION_SERVICE, useValue: services.organizations },
      { provide: ORGANIZATION_NOTIFICATION_SINK, useValue: services.notifications },
    ],
  })
    .overrideGuard(AccessTokenGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        request.auth = {
          identityId: 'identity-1',
          sessionId: 'session-1',
          tokenVersion: 1,
        };
        return true;
      },
    } satisfies CanActivate);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return { app, services, url: `http://127.0.0.1:${port}` };
}

function createServices() {
  return {
    organizations: {
      createOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getOrganization: vi.fn(),
      updateProfile: vi.fn(),
      transition: vi.fn(),
      listMemberships: vi.fn(),
      updateMembershipRole: vi.fn(),
      suspendMembership: vi.fn(),
      removeMembership: vi.fn(),
      createInvitation: vi.fn(),
      listInvitations: vi.fn(),
      revokeInvitation: vi.fn(),
      transferOwnership: vi.fn(),
      acceptInvitation: vi.fn(),
    },
    notifications: {
      invitationRequested: vi.fn(),
    },
  };
}

function organizationFixture() {
  return {
    id: 'c9c07d2d-5342-467e-90e2-7dfbe094e6ef',
    publicId: null,
    displayName: 'Seneve Awards',
    slug: 'seneve-awards',
    status: 'ACTIVE',
    version: 1,
    defaultLocale: 'en',
    timezone: 'Africa/Lome',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    suspendedAt: null,
    closedAt: null,
    archivedAt: null,
    memberships: [],
    invitations: [],
  };
}

function invitationFixture() {
  return {
    id: '68d36544-d951-4f49-b41f-ff32b40dc010',
    organizationId: organizationFixture().id,
    normalizedRecipientEmail: 'member@example.com',
    intendedRole: 'VIEWER',
    status: 'PENDING',
    tokenId: 'token-id',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-08T00:00:00.000Z'),
    revokedAt: null,
    acceptedAt: null,
    invitedBy: 'identity-1',
  };
}
