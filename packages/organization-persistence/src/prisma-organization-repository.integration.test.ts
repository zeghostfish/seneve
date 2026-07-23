import { PrismaClient } from '@prisma/client';
import type { OrganizationPersistenceRepositories } from '@seneve/domain-organization';
import {
  AsyncLocalStorageTenantContextProvider,
  platformAdminTenantContext,
  TenantExecutionContext,
} from '@seneve/tenant-context';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaOrganizationRlsUnitOfWork, PrismaTenantRlsTransactionBoundary } from './index.js';

const shouldRunPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = shouldRunPostgres ? describe : describe.skip;

const prisma = new PrismaClient();
const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
const rls = new PrismaTenantRlsTransactionBoundary(prisma, execution);
const unitOfWork = new PrismaOrganizationRlsUnitOfWork(rls);

const now = new Date('2026-07-15T00:00:00.000Z');
const later = new Date('2026-07-22T00:00:00.000Z');
const ownerIdentityId = '11111111-1111-4111-8111-111111111111';
const secondIdentityId = '22222222-2222-4222-8222-222222222222';
const thirdIdentityId = '33333333-3333-4333-8333-333333333333';
const organizationId = '44444444-4444-4444-8444-444444444444';
const ownerMembershipId = '55555555-5555-4555-8555-555555555555';

describePostgres('Prisma organization repositories', () => {
  beforeEach(async () => {
    await cleanupTables();
    await createIdentity(ownerIdentityId, 'owner@example.com');
    await createIdentity(secondIdentityId, 'second@example.com');
    await createIdentity(thirdIdentityId, 'third@example.com');
  });

  afterAll(async () => {
    await cleanupTables();
    await prisma.$disconnect();
  });

  it('persists and rehydrates an organization with its initial owner membership', async () => {
    await createOrganization();

    const organization = await withAdminRepositories(({ organizations }) =>
      organizations.findOrganizationBySlug('seneve-awards'),
    );

    expect(organization).toMatchObject({
      id: organizationId,
      publicId: 'org_public_1',
      displayName: 'Seneve Awards',
      slug: 'seneve-awards',
      status: 'DRAFT',
      defaultLocale: 'en',
      timezone: 'Africa/Lome',
      memberships: [
        expect.objectContaining({
          id: ownerMembershipId,
          identityId: ownerIdentityId,
          role: 'OWNER',
          status: 'ACTIVE',
        }),
      ],
    });
  });

  it('enforces unique organization slug and one active membership per identity', async () => {
    await createOrganization();

    await expect(
      withAdminRepositories(({ organizations }) =>
        organizations.createOrganization({
          ...organizationInput('99999999-9999-4999-8999-999999999999', 'org_public_2'),
          ownerMembership: {
            ...organizationInput('99999999-9999-4999-8999-999999999999', 'org_public_2')
              .ownerMembership,
            membershipId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withAdminRepositories(({ memberships }) =>
        memberships.createMembership({
          membershipId: '66666666-6666-4666-8666-666666666666',
          organizationId,
          identityId: ownerIdentityId,
          role: 'VIEWER',
          createdAt: now,
          lastChangedBy: ownerIdentityId,
        }),
      ),
    ).rejects.toThrow();
  });

  it('persists invitations with token hashes and prevents duplicate pending invitations', async () => {
    await createOrganization();
    await createInvitation();

    const organization = await withAdminRepositories(({ organizations }) =>
      organizations.findOrganizationById(organizationId),
    );

    expect(organization?.invitations).toEqual([
      expect.objectContaining({
        normalizedRecipientEmail: 'new.member@example.com',
        tokenId: '77777777-7777-4777-8777-777777777777',
        status: 'PENDING',
      }),
    ]);
    await expect(
      withAdminRepositories(({ invitations }) =>
        invitations.createInvitation({
          invitationId: '88888888-8888-4888-8888-888888888888',
          organizationId,
          normalizedRecipientEmail: 'new.member@example.com',
          intendedRole: 'AUDITOR',
          tokenId: '99999999-9999-4999-8999-999999999999',
          tokenHash: 'hmac-sha256:second-invitation-hash',
          invitedBy: ownerIdentityId,
          createdAt: now,
          expiresAt: later,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      withAdminTransaction((tx) =>
        tx.organizationInvitation.findUniqueOrThrow({
          where: { id: '77777777-7777-4777-8777-777777777777' },
        }),
      ),
    ).resolves.not.toMatchObject({
      tokenHash: 'raw-token',
    });
  });

  it('accepts an invitation and creates the membership atomically', async () => {
    await createOrganization();
    await createInvitation();

    await expect(
      withAdminRepositories(({ invitations }) =>
        invitations.acceptInvitationWithMembership({
          invitationId: '77777777-7777-4777-8777-777777777777',
          expectedOrganizationId: organizationId,
          acceptingIdentityId: secondIdentityId,
          recipientEmail: 'NEW.MEMBER@example.com',
          membershipId: '88888888-8888-4888-8888-888888888888',
          changedAt: new Date('2026-07-16T00:00:00.000Z'),
        }),
      ),
    ).resolves.toMatchObject({ outcome: 'UPDATED' });
    await expect(
      withAdminRepositories(({ invitations }) =>
        invitations.acceptInvitationWithMembership({
          invitationId: '77777777-7777-4777-8777-777777777777',
          expectedOrganizationId: organizationId,
          acceptingIdentityId: thirdIdentityId,
          recipientEmail: 'new.member@example.com',
          membershipId: '99999999-9999-4999-8999-999999999999',
          changedAt: new Date('2026-07-16T01:00:00.000Z'),
        }),
      ),
    ).resolves.toMatchObject({ outcome: 'CONFLICT' });

    const organization = await withAdminRepositories(({ organizations }) =>
      organizations.findOrganizationById(organizationId),
    );

    expect(organization?.invitations[0]?.status).toBe('ACCEPTED');
    expect(organization?.memberships).toContainEqual(
      expect.objectContaining({
        id: '88888888-8888-4888-8888-888888888888',
        identityId: secondIdentityId,
        role: 'VIEWER',
        status: 'ACTIVE',
        invitationId: '77777777-7777-4777-8777-777777777777',
      }),
    );
  });

  it('transfers ownership as one persistence operation', async () => {
    await createOrganization();
    await withAdminRepositories(({ memberships }) =>
      memberships.createMembership({
        membershipId: '66666666-6666-4666-8666-666666666666',
        organizationId,
        identityId: secondIdentityId,
        role: 'ADMINISTRATOR',
        createdAt: now,
        lastChangedBy: ownerIdentityId,
      }),
    );

    await expect(
      withAdminRepositories(({ memberships }) =>
        memberships.transferOwnership({
          organizationId,
          currentOwnerMembershipId: ownerMembershipId,
          targetMembershipId: '66666666-6666-4666-8666-666666666666',
          previousOwnerRole: 'ADMINISTRATOR',
          transferredAt: later,
          actorId: ownerIdentityId,
        }),
      ),
    ).resolves.toMatchObject({ outcome: 'UPDATED' });

    const organization = await withAdminRepositories(({ organizations }) =>
      organizations.findOrganizationById(organizationId),
    );

    expect(organization?.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownerMembershipId, role: 'ADMINISTRATOR' }),
        expect.objectContaining({
          id: '66666666-6666-4666-8666-666666666666',
          role: 'OWNER',
        }),
      ]),
    );
  });

  it('rolls back a unit-of-work transaction on failure', async () => {
    await expect(
      withAdminRepositories(async (repositories) => {
        await repositories.organizations.createOrganization(organizationInput());
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(
      withAdminRepositories(({ organizations }) =>
        organizations.findOrganizationById(organizationId),
      ),
    ).resolves.toBeNull();
  });
});

function organizationInput(id = organizationId, publicId: string | null = 'org_public_1') {
  return {
    organizationId: id,
    publicId,
    displayName: 'Seneve Awards',
    slug: 'seneve-awards',
    status: 'DRAFT' as const,
    defaultLocale: 'en',
    timezone: 'Africa/Lome',
    createdAt: now,
    ownerMembership: {
      membershipId: ownerMembershipId,
      identityId: ownerIdentityId,
      role: 'OWNER' as const,
      createdAt: now,
      lastChangedBy: ownerIdentityId,
    },
  };
}

async function createOrganization(): Promise<void> {
  await withAdminRepositories(({ organizations }) =>
    organizations.createOrganization(organizationInput()),
  );
}

async function createInvitation(): Promise<void> {
  await withAdminRepositories(({ invitations }) =>
    invitations.createInvitation({
      invitationId: '77777777-7777-4777-8777-777777777777',
      organizationId,
      normalizedRecipientEmail: 'new.member@example.com',
      intendedRole: 'VIEWER',
      tokenId: '77777777-7777-4777-8777-777777777777',
      tokenHash: 'hmac-sha256:first-invitation-hash',
      invitedBy: ownerIdentityId,
      createdAt: now,
      expiresAt: later,
    }),
  );
}

async function createIdentity(identityId: string, normalizedEmail: string): Promise<void> {
  const suffix = identityId.slice(0, 8);

  await prisma.identity.create({
    data: {
      id: identityId,
      status: 'ACTIVE',
      normalizedLoginEmail: normalizedEmail,
      createdAt: now,
      updatedAt: now,
      user: {
        create: {
          id: `${suffix}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
          displayName: normalizedEmail,
          createdAt: now,
          updatedAt: now,
        },
      },
      emails: {
        create: {
          id: `${suffix}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
          email: normalizedEmail,
          normalizedEmail,
          isPrimary: true,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      credentials: {
        create: {
          id: `${suffix}-cccc-4ccc-8ccc-cccccccccccc`,
          type: 'PASSWORD',
          secretHash: '$argon2id$v=19$m=65536,t=3,p=1$hash',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  });
}

async function cleanupTables(): Promise<void> {
  await withAdminTransaction(async (tx) => {
    await tx.voteAttempt.deleteMany();
    await tx.candidate.deleteMany();
    await tx.campaign.deleteMany();
    await tx.organizationMembership.deleteMany();
    await tx.organizationInvitation.deleteMany();
    await tx.organization.deleteMany();
  });
  await prisma.identitySecurityEvent.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.trustedDevice.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.identityEmail.deleteMany();
  await prisma.user.deleteMany();
  await prisma.identity.deleteMany();
}

async function withAdminRepositories<T>(
  work: (repositories: OrganizationPersistenceRepositories) => Promise<T>,
): Promise<T> {
  return execution.run(
    platformAdminTenantContext({
      identityId: ownerIdentityId,
      correlationId: 'correlation-organization-persistence',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () => unitOfWork.transaction(work),
  );
}

async function withAdminTransaction<T>(
  work: Parameters<PrismaTenantRlsTransactionBoundary['transaction']>[0],
): Promise<T> {
  return execution.run(
    platformAdminTenantContext({
      identityId: ownerIdentityId,
      correlationId: 'correlation-organization-persistence',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () => rls.transaction(work),
  ) as Promise<T>;
}
