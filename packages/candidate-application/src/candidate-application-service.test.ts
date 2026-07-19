import { describe, expect, it } from 'vitest';

import { PermissionEvaluationService } from '@seneve/authorization-application';
import type { PersistedCampaignReadModel } from '@seneve/domain-campaign';
import type { CandidateSnapshot } from '@seneve/domain-candidate';
import type { IdentityRepository } from '@seneve/domain-identity';
import type { PersistedOrganizationReadModel } from '@seneve/domain-organization';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
} from '@seneve/tenant-context';

import { CandidateApplicationError } from './application-error.js';
import { CandidateApplicationService } from './candidate-application-service.js';
import type { CandidateApplicationDependencies } from './contracts.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const actorId = '44444444-4444-4444-8444-444444444444';
const memberId = '55555555-5555-4555-8555-555555555555';
const candidateId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-07-17T08:00:00.000Z');

describe('CandidateApplicationService', () => {
  it('creates candidates in a draft campaign and records audit events', async () => {
    const deps = dependencies();
    const service = new CandidateApplicationService(deps);

    const result = await service.createCandidate({
      actorIdentityId: actorId,
      organizationId,
      campaignId,
      displayName: 'Jane Candidate',
      slug: 'jane-candidate',
      correlationId: 'corr_create_candidate',
    });

    expect(result.candidate).toMatchObject({
      id: candidateId,
      organizationId,
      campaignId,
      status: 'DRAFT',
      position: 1,
    });
    expect(deps.auditEvents.recorded.map((event) => event.name)).toEqual(['CandidateCreated']);
  });

  it('enforces candidate limits before creating another record', async () => {
    const deps = dependencies({ maxCandidatesPerCampaign: 0 });
    const service = new CandidateApplicationService(deps);

    await expect(
      service.createCandidate({
        actorIdentityId: actorId,
        organizationId,
        campaignId,
        displayName: 'Jane Candidate',
        slug: 'jane-candidate',
        correlationId: 'corr_limit_candidate',
      }),
    ).rejects.toMatchObject({ code: 'CANDIDATE_LIMIT_REACHED' });
  });

  it('blocks candidate creation when the campaign lifecycle is active', async () => {
    const deps = dependencies({ campaignStatus: 'ACTIVE' });
    const service = new CandidateApplicationService(deps);

    await expect(
      service.createCandidate({
        actorIdentityId: actorId,
        organizationId,
        campaignId,
        displayName: 'Jane Candidate',
        slug: 'jane-candidate',
        correlationId: 'corr_active_candidate',
      }),
    ).rejects.toThrow(CandidateApplicationError);
  });

  it('requires full campaign ordering during reorder', async () => {
    const deps = dependencies();
    const service = new CandidateApplicationService(deps);
    await service.createCandidate({
      actorIdentityId: actorId,
      organizationId,
      campaignId,
      displayName: 'Jane Candidate',
      slug: 'jane-candidate',
      correlationId: 'corr_create_for_reorder',
    });

    await expect(
      service.reorderCandidates({
        actorIdentityId: actorId,
        organizationId,
        campaignId,
        candidateIds: [],
        correlationId: 'corr_reorder_invalid',
      }),
    ).rejects.toMatchObject({ code: 'CANDIDATE_REORDER_INVALID' });
  });
});

function dependencies(
  options: {
    readonly campaignStatus?: PersistedCampaignReadModel['status'];
    readonly maxCandidatesPerCampaign?: number;
  } = {},
) {
  const candidates = new Map<string, CandidateSnapshot>();
  const recorded: Parameters<CandidateApplicationDependencies['auditEvents']['record']>[0][] = [];
  const organization = organizationReadModel();
  const campaign = campaignReadModel(options.campaignStatus ?? 'DRAFT');
  const candidateRepo = {
    createCandidate,
    countCandidates,
    findCandidateById,
    listCandidates,
    updateCandidate,
    reorderCandidates,
  };

  return {
    unitOfWork: {
      async transaction<T>(
        work: (repositories: { candidates: typeof candidateRepo }) => Promise<T>,
      ) {
        return work({ candidates: candidateRepo });
      },
    },
    candidates: candidateRepo,
    campaigns: {
      async createCampaign() {},
      async findCampaignById(input: {
        readonly organizationId: string;
        readonly campaignId: string;
      }) {
        return input.organizationId === organizationId && input.campaignId === campaignId
          ? campaign
          : null;
      },
      async listCampaigns() {
        return { campaigns: [campaign], nextCursor: null };
      },
      async updateCampaign() {
        return { outcome: 'UPDATED' as const };
      },
      async updateCampaignRules() {
        return { outcome: 'UPDATED' as const };
      },
      async updateCampaignSchedule() {
        return { outcome: 'UPDATED' as const };
      },
      async updateCampaignStatus() {
        return { outcome: 'UPDATED' as const };
      },
    },
    organizations: {
      async createOrganization() {},
      async findOrganizationById(id: string) {
        return id === organizationId ? organization : null;
      },
      async findOrganizationBySlug() {
        return null;
      },
      async listOrganizationsForIdentity() {
        return [organization];
      },
      async updateOrganizationProfile() {
        return { outcome: 'UPDATED' as const };
      },
      async updateOrganizationStatus() {
        return { outcome: 'UPDATED' as const };
      },
    },
    identities: identityRepo,
    permissions: new PermissionEvaluationService(),
    executionContext: new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider()),
    auditEvents: {
      recorded,
      async record(event: (typeof recorded)[number]) {
        recorded.push(event);
      },
    },
    ids: {
      uuid: (() => {
        const values = [
          candidateId,
          '77777777-7777-4777-8777-777777777777',
          '88888888-8888-4888-8888-888888888888',
        ];
        return () => values.shift() ?? '99999999-9999-4999-8999-999999999999';
      })(),
    },
    clock: {
      now: () => now,
    },
    maxCandidatesPerCampaign: options.maxCandidatesPerCampaign ?? 500,
  } satisfies CandidateApplicationDependencies & {
    readonly auditEvents: CandidateApplicationDependencies['auditEvents'] & {
      readonly recorded: typeof recorded;
    };
  };

  async function createCandidate(input: CandidateSnapshot) {
    candidates.set(input.id, input);
  }

  async function countCandidates() {
    return candidates.size;
  }

  async function findCandidateById(input: { readonly candidateId: string }) {
    return candidates.get(input.candidateId) ?? null;
  }

  async function listCandidates() {
    return {
      candidates: [...candidates.values()],
      nextCursor: null,
    };
  }

  async function updateCandidate(input: CandidateSnapshot & { readonly expectedVersion: number }) {
    const current = candidates.get(input.id);

    if (!current) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (current.version !== input.expectedVersion) {
      return { outcome: 'CONFLICT' as const };
    }

    candidates.set(input.id, input);
    return { outcome: 'UPDATED' as const };
  }

  async function reorderCandidates(input: { readonly candidateIds: readonly string[] }) {
    if (input.candidateIds.some((id) => !candidates.has(id))) {
      return { outcome: 'NOT_FOUND' as const };
    }

    return { outcome: 'UPDATED' as const };
  }
}

const identityRepo = {
  async createRegisteredIdentity() {},
  async findById(id: string) {
    return id === actorId
      ? {
          id: actorId,
          status: 'ACTIVE' as const,
          normalizedLoginEmail: 'owner@example.com',
          version: 1,
          createdAt: now,
          updatedAt: now,
          suspendedAt: null,
          closedAt: null,
          user: { id: actorId, displayName: 'Owner' },
          primaryEmail: {
            id: actorId,
            email: 'owner@example.com',
            normalizedEmail: 'owner@example.com',
            verifiedAt: now,
          },
          activeCredentials: [],
        }
      : null;
  },
  async findByNormalizedLoginEmail() {
    return null;
  },
  async markPrimaryEmailVerified() {
    return true;
  },
  async replacePasswordCredential() {
    return true;
  },
  async suspendIdentityAndRevokeSessions() {
    return true;
  },
} satisfies IdentityRepository;

function organizationReadModel(): PersistedOrganizationReadModel {
  return {
    id: organizationId,
    publicId: null,
    displayName: 'Seneve',
    slug: 'seneve',
    status: 'ACTIVE',
    version: 1,
    defaultLocale: 'en',
    timezone: 'Africa/Lome',
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    suspendedAt: null,
    closedAt: null,
    archivedAt: null,
    memberships: [
      {
        id: memberId,
        organizationId,
        identityId: actorId,
        role: 'OWNER',
        status: 'ACTIVE',
        invitationId: null,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
        suspendedAt: null,
        removedAt: null,
        lastChangedBy: actorId,
      },
    ],
    invitations: [],
  };
}

function campaignReadModel(
  status: PersistedCampaignReadModel['status'],
): PersistedCampaignReadModel {
  return {
    id: campaignId,
    organizationId,
    name: 'Seneve Awards',
    slug: 'seneve-awards',
    description: null,
    status,
    visibility: 'PRIVATE',
    timezone: 'Africa/Lome',
    locale: 'en',
    startsAt: new Date('2026-08-01T10:00:00.000Z'),
    endsAt: new Date('2026-08-31T22:00:00.000Z'),
    rules: {
      votingMode: 'FREE',
      votesPerVoter: 1,
      allowMultipleCandidates: false,
      requiresEmailVerification: true,
      results: {
        visibility: 'AFTER_CAMPAIGN',
        revealAt: null,
      },
    },
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    cancelledAt: null,
    version: 1,
  };
}
