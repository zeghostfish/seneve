import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
  authenticatedVotingTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

import { PrismaVotingRlsUnitOfWork } from './prisma-voting-repository.js';

const enabled =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = enabled ? describe : describe.skip;
const prisma = new PrismaClient();
const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
const rls = new PrismaTenantRlsTransactionBoundary(prisma, execution);
const unitOfWork = new PrismaVotingRlsUnitOfWork(rls, () => ({ async record() {} }));

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const voterA = '55555555-5555-4555-8555-555555555555';
const voterB = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-07-23T12:00:00.000Z');

describePostgres('Prisma voting persistence and RLS', () => {
  beforeEach(async () => {
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('persists and replays confirmed votes by request id', async () => {
    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(async ({ votes }) => {
        await votes.create(attempt());
        await expect(
          votes.findByRequest({
            organizationId,
            campaignId,
            voterIdentityId: voterA,
            requestId: attempt().requestId,
          }),
        ).resolves.toMatchObject({ status: 'CONFIRMED', candidateId });
        await expect(
          votes.countConfirmed({ organizationId, campaignId, voterIdentityId: voterA }),
        ).resolves.toBe(1);
      }),
    );
  });

  it('reads the campaign and eligible candidates inside the voting tenant context', async () => {
    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(async (repositories) => {
        await expect(
          repositories.findCampaign({ organizationId, campaignId }),
        ).resolves.toMatchObject({
          id: campaignId,
          name: 'Voting campaign',
        });
        await expect(
          repositories.listEligibleCandidates({ organizationId, campaignId }),
        ).resolves.toEqual([
          expect.objectContaining({
            id: candidateId,
            displayName: 'Eligible candidate',
            position: 1,
          }),
        ]);
      }),
    );
  });

  it('isolates vote attempts by authenticated identity through RLS', async () => {
    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(({ votes }) => votes.create(attempt())),
    );

    await execution.run(voterContext(voterB), () =>
      unitOfWork.transaction(async ({ votes }) => {
        await expect(
          votes.findOwnedById({
            organizationId,
            voterIdentityId: voterB,
            voteAttemptId: attempt().id,
          }),
        ).resolves.toBeNull();
      }),
    );
  });

  it('lists paginated confirmed receipts for only the authenticated identity', async () => {
    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(({ votes }) => votes.create(attempt())),
    );

    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(async ({ votes }) => {
        await expect(
          votes.listOwned({
            organizationId,
            voterIdentityId: voterA,
            limit: 25,
            cursor: null,
          }),
        ).resolves.toEqual({
          receipts: [
            expect.objectContaining({
              id: attempt().id,
              campaignName: 'Voting campaign',
              candidateDisplayName: 'Eligible candidate',
            }),
          ],
          nextCursor: null,
        });
      }),
    );

    await execution.run(voterContext(voterB), () =>
      unitOfWork.transaction(async ({ votes }) => {
        await expect(
          votes.listOwned({
            organizationId,
            voterIdentityId: voterB,
            limit: 25,
            cursor: null,
          }),
        ).resolves.toEqual({ receipts: [], nextCursor: null });
      }),
    );
  });

  it('fails closed without tenant execution context', async () => {
    await expect(unitOfWork.transaction(async () => undefined)).rejects.toThrow();
  });

  it('prevents mutation of a confirmed vote', async () => {
    await execution.run(voterContext(voterA), () =>
      unitOfWork.transaction(({ votes }) => votes.create(attempt())),
    );
    await expect(
      prisma.voteAttempt.update({
        where: { id: attempt().id },
        data: { version: { increment: 1 } },
      }),
    ).rejects.toThrow();
  });
});

function voterContext(identityId: string) {
  return authenticatedVotingTenantContext({
    tenantId: organizationId,
    identityId,
    correlationId: `corr-voting-${identityId.slice(0, 8)}`,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}

function attempt() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    organizationId,
    campaignId,
    candidateId,
    voterIdentityId: voterA,
    requestId: '88888888-8888-4888-8888-888888888888',
    status: 'CONFIRMED' as const,
    rejectionCode: null,
    createdAt: now,
    confirmedAt: now,
    rejectedAt: null,
    version: 2,
  };
}

async function seed(): Promise<void> {
  for (const [id, email] of [
    [voterA, 'voter-a@example.com'],
    [voterB, 'voter-b@example.com'],
  ] as const) {
    await prisma.identity.create({
      data: {
        id,
        status: 'ACTIVE',
        normalizedLoginEmail: email,
        user: {
          create: {
            id: `${id.slice(0, 8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
            displayName: email,
          },
        },
        emails: {
          create: {
            id: `${id.slice(0, 8)}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
            email,
            normalizedEmail: email,
            isPrimary: true,
            verifiedAt: now,
          },
        },
      },
    });
  }

  await execution.run(
    platformAdminTenantContext({
      identityId: voterA,
      correlationId: 'correlation-voting-seed',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () =>
      rls.transaction(async (tx) => {
        await tx.organization.create({
          data: {
            id: organizationId,
            publicId: 'public-voting-tenant',
            displayName: 'Voting tenant',
            slug: 'voting-tenant',
            status: 'ACTIVE',
            defaultLocale: 'en',
            timezone: 'Africa/Lome',
            createdAt: now,
            updatedAt: now,
            activatedAt: now,
          },
        });
        await tx.campaign.create({
          data: {
            id: campaignId,
            organizationId,
            name: 'Voting campaign',
            slug: 'voting-campaign',
            status: 'ACTIVE',
            visibility: 'PRIVATE',
            timezone: 'Africa/Lome',
            locale: 'en',
            startsAt: new Date('2026-07-23T10:00:00.000Z'),
            endsAt: new Date('2026-07-23T14:00:00.000Z'),
            votingMode: 'FREE',
            votesPerVoter: 1,
            allowMultipleCandidates: false,
            requiresEmailVerification: true,
            resultsVisibility: 'AFTER_CAMPAIGN',
            createdBy: voterA,
          },
        });
        await tx.candidate.create({
          data: {
            id: candidateId,
            organizationId,
            campaignId,
            displayName: 'Eligible candidate',
            slug: 'eligible-candidate',
            status: 'ELIGIBLE',
            position: 1,
            createdBy: voterA,
          },
        });
      }),
  );
}

async function cleanup(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "vote_attempts", "candidates", "campaigns", "organization_memberships",
      "organization_invitations", "organizations", "identity_emails", "users", "identities"
    RESTART IDENTITY CASCADE
  `);
}
