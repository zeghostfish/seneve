import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
  crossTenantTenantContext,
  organizationTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';

import { PrismaTenantRlsTransactionBoundary } from './tenant-rls-transaction.js';

const shouldRunPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = shouldRunPostgres ? describe : describe.skip;

const prisma = new PrismaClient();
const provider = new AsyncLocalStorageTenantContextProvider();
const execution = new TenantExecutionContext(provider);
const rls = new PrismaTenantRlsTransactionBoundary(prisma, execution);

const now = new Date('2026-07-15T11:00:00.000Z');
const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const identityA = '11111111-1111-4111-8111-111111111111';
const identityB = '22222222-2222-4222-8222-222222222222';

describePostgres('PostgreSQL organization row-level security', () => {
  beforeEach(async () => {
    await cleanupTables();
    await createIdentity(identityA, 'owner-a@example.com');
    await createIdentity(identityB, 'owner-b@example.com');
    await seedTenant(tenantA, identityA, 'tenant-a');
    await seedTenant(tenantB, identityB, 'tenant-b');
  });

  afterAll(async () => {
    await cleanupTables();
    await prisma.$disconnect();
  });

  it('denies organization-scoped reads and writes when database tenant context is missing', async () => {
    await expect(prisma.organization.findMany()).resolves.toEqual([]);
    await expect(
      prisma.organizationInvitation.create({
        data: invitationInput(tenantA, identityA, 'missing-context@example.com'),
      }),
    ).rejects.toThrow();
  });

  it('allows one tenant to read and write only its own organization-scoped rows', async () => {
    const context = organizationTenantContext({
      tenantId: tenantA,
      identityId: identityA,
      membershipId: `${tenantA.slice(0, 8)}-1111-4111-8111-111111111111`,
      role: 'OWNER',
      correlationId: 'correlation-tenant-a',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await execution.run(context, () =>
      rls.transaction(async (tx) => {
        await expect(tx.organization.findMany()).resolves.toHaveLength(1);
        await expect(tx.organizationMembership.findMany()).resolves.toHaveLength(1);
        await expect(tx.organizationInvitation.findMany()).resolves.toHaveLength(0);
        await expect(
          tx.organizationInvitation.create({
            data: invitationInput(tenantA, identityA, 'new-a@example.com'),
          }),
        ).resolves.toMatchObject({
          organizationId: tenantA,
        });
        await expect(
          tx.organizationInvitation.create({
            data: invitationInput(tenantB, identityA, 'wrong-tenant@example.com'),
          }),
        ).rejects.toThrow();
      }),
    );
  });

  it('blocks cross-tenant leakage through unfiltered, nested, aggregate and bulk queries', async () => {
    const context = organizationTenantContext({
      tenantId: tenantA,
      identityId: identityA,
      membershipId: `${tenantA.slice(0, 8)}-1111-4111-8111-111111111111`,
      role: 'OWNER',
      correlationId: 'correlation-leakage',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await execution.run(context, () =>
      rls.transaction(async (tx) => {
        await expect(
          tx.organization.findMany({
            include: {
              memberships: true,
            },
          }),
        ).resolves.toEqual([
          expect.objectContaining({
            id: tenantA,
            memberships: [expect.objectContaining({ organizationId: tenantA })],
          }),
        ]);
        await expect(tx.organization.count()).resolves.toBe(1);
        await expect(
          tx.organizationMembership.updateMany({
            data: {
              role: 'VIEWER',
            },
          }),
        ).resolves.toMatchObject({ count: 1 });
        await expect(tx.organization.findUnique({ where: { id: tenantB } })).resolves.toBeNull();
      }),
    );
  });

  it('does not leak transaction-local tenant settings across pooled connection reuse', async () => {
    await execution.run(tenantContext(tenantA, identityA, 'correlation-pooled-a'), () =>
      rls.transaction(async (tx) => {
        await expect(tx.organization.findMany()).resolves.toEqual([
          expect.objectContaining({ id: tenantA }),
        ]);
      }),
    );
    await execution.run(tenantContext(tenantB, identityB, 'correlation-pooled-b'), () =>
      rls.transaction(async (tx) => {
        await expect(tx.organization.findMany()).resolves.toEqual([
          expect.objectContaining({ id: tenantB }),
        ]);
      }),
    );

    await expect(prisma.organization.findMany()).resolves.toEqual([]);
  });

  it('supports explicit platform and cross-tenant administrative paths', async () => {
    await execution.run(
      platformAdminTenantContext({
        identityId: identityA,
        correlationId: 'correlation-platform-admin',
        executionSource: 'INTERNAL_WORKFLOW',
      }),
      () =>
        rls.transaction(async (tx) => {
          await expect(tx.organization.count()).resolves.toBe(2);
        }),
    );

    await execution.run(
      crossTenantTenantContext({
        targetTenantId: tenantB,
        identityId: identityA,
        platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
        reason: 'support investigation',
        correlationId: 'correlation-cross-tenant',
        executionSource: 'INTERNAL_WORKFLOW',
      }),
      () =>
        rls.transaction(async (tx) => {
          await expect(tx.organization.findMany()).resolves.toEqual([
            expect.objectContaining({ id: tenantB }),
          ]);
        }),
    );
  });

  it('supports controlled organization bootstrap without disabling RLS', async () => {
    const bootstrapTenant = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    await execution.run(tenantContext(tenantA, identityA, 'correlation-bootstrap-source'), () =>
      rls.transaction(
        async (tx) => {
          await tx.organization.create({
            data: organizationInput(bootstrapTenant, identityA, 'tenant-c'),
          });
        },
        {
          operation: 'ORGANIZATION_BOOTSTRAP',
          tenantId: bootstrapTenant,
        },
      ),
    );

    await execution.run(
      tenantContext(bootstrapTenant, identityA, 'correlation-bootstrap-read'),
      () =>
        rls.transaction(async (tx) => {
          await expect(
            tx.organization.findUnique({ where: { id: bootstrapTenant } }),
          ).resolves.toMatchObject({
            id: bootstrapTenant,
          });
        }),
    );
  });
});

async function seedTenant(
  organizationId: string,
  ownerIdentityId: string,
  slug: string,
): Promise<void> {
  await execution.run(
    platformAdminTenantContext({
      identityId: ownerIdentityId,
      correlationId: `correlation-seed-${slug}`,
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () =>
      rls.transaction(async (tx) => {
        await tx.organization.create({
          data: organizationInput(organizationId, ownerIdentityId, slug),
        });
      }),
  );
}

function tenantContext(tenantId: string, identityId: string, correlationId: string) {
  return organizationTenantContext({
    tenantId,
    identityId,
    membershipId: `${tenantId.slice(0, 8)}-1111-4111-8111-111111111111`,
    role: 'OWNER',
    correlationId,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}

function organizationInput(
  organizationId: string,
  ownerIdentityId: string,
  slug: string,
): Prisma.OrganizationCreateInput {
  return {
    id: organizationId,
    publicId: `public-${slug}`,
    displayName: `Organization ${slug}`,
    slug,
    status: 'ACTIVE',
    defaultLocale: 'en',
    timezone: 'Africa/Lome',
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    memberships: {
      create: {
        id: `${organizationId.slice(0, 8)}-1111-4111-8111-111111111111`,
        identityId: ownerIdentityId,
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
        lastChangedBy: ownerIdentityId,
      },
    },
  };
}

function invitationInput(
  organizationId: string,
  invitedBy: string,
  email: string,
): Prisma.OrganizationInvitationCreateInput {
  const suffix = hexSuffix(email);

  return {
    id: `${organizationId.slice(0, 8)}-2222-4222-8222-${suffix.padEnd(12, '0').slice(0, 12)}`,
    organization: {
      connect: {
        id: organizationId,
      },
    },
    normalizedRecipientEmail: email,
    intendedRole: 'VIEWER',
    status: 'PENDING',
    tokenId: `${organizationId.slice(0, 8)}-3333-4333-8333-${suffix.padEnd(12, '1').slice(0, 12)}`,
    tokenHash: `hmac-sha256:${organizationId}:${email}`,
    invitedByIdentity: {
      connect: {
        id: invitedBy,
      },
    },
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date('2026-07-22T11:00:00.000Z'),
  };
}

function hexSuffix(value: string): string {
  return [...value]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(12, '0')
    .slice(0, 12);
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
    },
  });
}

async function cleanupTables(): Promise<void> {
  await execution.run(
    platformAdminTenantContext({
      identityId: identityA,
      correlationId: 'correlation-cleanup',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () =>
      rls.transaction(async (tx) => {
        await tx.organizationMembership.deleteMany();
        await tx.organizationInvitation.deleteMany();
        await tx.organization.deleteMany();
      }),
  );
  await prisma.identityEmail.deleteMany();
  await prisma.user.deleteMany();
  await prisma.identity.deleteMany();
}
