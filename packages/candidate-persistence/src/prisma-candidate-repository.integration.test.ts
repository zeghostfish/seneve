import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
  organizationTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';

import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

import { PrismaCandidateRepository } from './prisma-candidate-repository.js';

const shouldRunPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = shouldRunPostgres ? describe : describe.skip;

const prisma = new PrismaClient();
const provider = new AsyncLocalStorageTenantContextProvider();
const execution = new TenantExecutionContext(provider);
const rls = new PrismaTenantRlsTransactionBoundary(prisma, execution);

const now = new Date('2026-07-17T08:00:00.000Z');
const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const identityA = '11111111-1111-4111-8111-111111111111';
const identityB = '22222222-2222-4222-8222-222222222222';
const campaignA = '33333333-3333-4333-8333-333333333333';
const campaignB = '44444444-4444-4444-8444-444444444444';

describePostgres('PrismaCandidateRepository PostgreSQL isolation', () => {
  beforeEach(async () => {
    await cleanupTables();
    await createIdentity(identityA, 'candidate-owner-a@example.com');
    await createIdentity(identityB, 'candidate-owner-b@example.com');
    await seedTenant(tenantA, identityA, 'candidate-tenant-a', campaignA);
    await seedTenant(tenantB, identityB, 'candidate-tenant-b', campaignB);
  });

  afterAll(async () => {
    await cleanupTables();
    await prisma.$disconnect();
  });

  it('persists candidates only inside the active tenant context', async () => {
    await execution.run(tenantContext(tenantA, identityA, 'candidate-correlation-a'), () =>
      rls.transaction(async (tx) => {
        const repository = new PrismaCandidateRepository(tx);
        await repository.createCandidate(candidateSnapshot(tenantA, campaignA, 'candidate-a', 1));

        await expect(
          repository.listCandidates({
            organizationId: tenantA,
            campaignId: campaignA,
            filters: { limit: 50 },
          }),
        ).resolves.toMatchObject({
          candidates: [expect.objectContaining({ organizationId: tenantA, campaignId: campaignA })],
        });
        await expect(tx.candidate.findMany()).resolves.toHaveLength(1);
      }),
    );

    await execution.run(tenantContext(tenantB, identityB, 'candidate-correlation-b'), () =>
      rls.transaction(async (tx) => {
        await expect(tx.candidate.findMany()).resolves.toEqual([]);
      }),
    );
  });

  it('enforces campaign-scoped slug uniqueness and full-list reorder atomically', async () => {
    await expect(
      execution.run(tenantContext(tenantA, identityA, 'candidate-correlation-duplicate'), () =>
        rls.transaction(async (tx) => {
          const repository = new PrismaCandidateRepository(tx);
          await repository.createCandidate(candidateSnapshot(tenantA, campaignA, 'candidate-a', 1));
          await repository.createCandidate(candidateSnapshot(tenantA, campaignA, 'candidate-a', 2));
        }),
      ),
    ).rejects.toThrow();

    await execution.run(tenantContext(tenantA, identityA, 'candidate-correlation-reorder'), () =>
      rls.transaction(async (tx) => {
        const repository = new PrismaCandidateRepository(tx);
        const first = candidateSnapshot(tenantA, campaignA, 'candidate-a', 1);
        const second = candidateSnapshot(tenantA, campaignA, 'candidate-b', 2);
        await repository.createCandidate(first);
        await repository.createCandidate(second);

        await expect(
          repository.reorderCandidates({
            organizationId: tenantA,
            campaignId: campaignA,
            candidateIds: [second.id, first.id],
            updatedAt: now,
          }),
        ).resolves.toEqual({ outcome: 'UPDATED' });
        await expect(
          repository.listCandidates({
            organizationId: tenantA,
            campaignId: campaignA,
            filters: { limit: 50 },
          }),
        ).resolves.toMatchObject({
          candidates: [
            expect.objectContaining({ id: second.id, position: 1 }),
            expect.objectContaining({ id: first.id, position: 2 }),
          ],
        });
      }),
    );
  });
});

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

async function seedTenant(
  organizationId: string,
  ownerIdentityId: string,
  slug: string,
  campaignId: string,
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
        await tx.campaign.create({
          data: campaignInput(organizationId, ownerIdentityId, campaignId, slug),
        });
      }),
  );
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

function campaignInput(
  organizationId: string,
  ownerIdentityId: string,
  campaignId: string,
  slug: string,
): Prisma.CampaignUncheckedCreateInput {
  return {
    id: campaignId,
    organizationId,
    name: `Campaign ${slug}`,
    slug,
    status: 'DRAFT',
    visibility: 'PRIVATE',
    timezone: 'Africa/Lome',
    locale: 'en',
    startsAt: new Date('2026-08-01T10:00:00.000Z'),
    endsAt: new Date('2026-08-31T22:00:00.000Z'),
    votingMode: 'FREE',
    votesPerVoter: 1,
    allowMultipleCandidates: false,
    requiresEmailVerification: true,
    resultsVisibility: 'AFTER_CAMPAIGN',
    createdBy: ownerIdentityId,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function candidateSnapshot(
  organizationId: string,
  campaignId: string,
  slug: string,
  position: number,
) {
  const suffix = slug.endsWith('b')
    ? 'bbbbbbbbbbbb'
    : slug.endsWith('a')
      ? 'aaaaaaaaaaaa'
      : 'cccccccccccc';

  return {
    id: `55555555-5555-4555-8555-${suffix}`,
    organizationId,
    campaignId,
    displayName: `Candidate ${slug}`,
    slug,
    shortDescription: null,
    description: null,
    status: 'DRAFT' as const,
    position,
    imageAssetId: null,
    externalReference: null,
    metadata: {},
    createdBy: identityA,
    createdAt: now,
    updatedAt: now,
    statusReason: null,
    archivedAt: null,
    version: 1,
  };
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
      correlationId: 'correlation-candidate-cleanup',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () =>
      rls.transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          TRUNCATE TABLE
            "vote_attempts", "candidates", "campaigns", "organization_memberships",
            "organization_invitations", "organizations"
          RESTART IDENTITY CASCADE
        `);
      }),
  );
  await prisma.identityEmail.deleteMany();
  await prisma.user.deleteMany();
  await prisma.identity.deleteMany();
}
