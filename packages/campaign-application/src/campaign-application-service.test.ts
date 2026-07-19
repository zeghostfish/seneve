import { describe, expect, it } from 'vitest';

import { PermissionEvaluationService } from '@seneve/authorization-application';
import type { PersistedCampaignCreate, PersistedCampaignReadModel } from '@seneve/domain-campaign';
import type { IdentityRepository } from '@seneve/domain-identity';
import type { PersistedOrganizationReadModel } from '@seneve/domain-organization';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
} from '@seneve/tenant-context';

import { CampaignApplicationError } from './application-error.js';
import { CampaignApplicationService } from './campaign-application-service.js';
import type { CampaignApplicationDependencies } from './contracts.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const campaignId = '55555555-5555-4555-8555-555555555555';
const now = new Date('2026-07-17T08:00:00.000Z');

describe('CampaignApplicationService', () => {
  it('creates campaigns inside the active organization context and records audit events', async () => {
    const deps = dependencies();
    const service = new CampaignApplicationService(deps);

    const result = await service.createCampaign({
      actorIdentityId: actorId,
      organizationId,
      name: 'Seneve Awards',
      slug: 'seneve-awards',
      description: 'Annual awards.',
      visibility: 'PRIVATE',
      startsAt: new Date('2026-08-01T10:00:00.000Z'),
      endsAt: new Date('2026-08-31T22:00:00.000Z'),
      timezone: 'Africa/Lome',
      locale: 'en',
      votingMode: 'FREE',
      votesPerVoter: 1,
      allowMultipleCandidates: false,
      requiresEmailVerification: true,
      resultsVisibility: 'AFTER_CAMPAIGN',
      correlationId: 'corr_create_campaign',
    });

    expect(result.campaign).toMatchObject({
      id: campaignId,
      organizationId,
      slug: 'seneve-awards',
      status: 'DRAFT',
    });
    expect(deps.auditEvents.recorded.map((event) => event.name)).toEqual(['CampaignCreated']);
  });

  it('denies campaign creation for inactive memberships', async () => {
    const deps = dependencies({
      membershipStatus: 'SUSPENDED',
    });
    const service = new CampaignApplicationService(deps);

    await expect(
      service.createCampaign({
        actorIdentityId: actorId,
        organizationId,
        name: 'Seneve Awards',
        slug: 'seneve-awards',
        visibility: 'PRIVATE',
        startsAt: new Date('2026-08-01T10:00:00.000Z'),
        endsAt: new Date('2026-08-31T22:00:00.000Z'),
        timezone: 'Africa/Lome',
        locale: 'en',
        votingMode: 'FREE',
        votesPerVoter: 1,
        allowMultipleCandidates: false,
        requiresEmailVerification: true,
        resultsVisibility: 'AFTER_CAMPAIGN',
        correlationId: 'corr_denied_campaign',
      }),
    ).rejects.toThrow(CampaignApplicationError);
  });
});

function dependencies(options: { readonly membershipStatus?: 'ACTIVE' | 'SUSPENDED' } = {}) {
  const campaigns = new Map<string, PersistedCampaignReadModel>();
  const recorded: Parameters<CampaignApplicationDependencies['auditEvents']['record']>[0][] = [];
  const organization = organizationReadModel(options.membershipStatus ?? 'ACTIVE');
  const campaignRepo = {
    createCampaign,
    findCampaignById,
    listCampaigns,
    updateCampaign,
    updateCampaignRules: updateCampaign,
    updateCampaignSchedule: updateCampaign,
    updateCampaignStatus: updateCampaign,
  };

  return {
    unitOfWork: {
      async transaction<T>(work: (repositories: { campaigns: typeof campaignRepo }) => Promise<T>) {
        return work({ campaigns: campaignRepo });
      },
    },
    campaigns: campaignRepo,
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
          campaignId,
          '66666666-6666-4666-8666-666666666666',
          '77777777-7777-4777-8777-777777777777',
        ];
        return () => values.shift() ?? '88888888-8888-4888-8888-888888888888';
      })(),
    },
    clock: {
      now: () => now,
    },
  } satisfies CampaignApplicationDependencies & {
    readonly auditEvents: CampaignApplicationDependencies['auditEvents'] & {
      readonly recorded: typeof recorded;
    };
  };

  async function createCampaign(input: PersistedCampaignCreate) {
    campaigns.set(input.id, readModel(input));
  }

  async function findCampaignById(input: { readonly campaignId: string }) {
    return campaigns.get(input.campaignId) ?? null;
  }

  async function listCampaigns() {
    return {
      campaigns: [...campaigns.values()],
      nextCursor: null,
    };
  }

  async function updateCampaign() {
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

function organizationReadModel(status: 'ACTIVE' | 'SUSPENDED'): PersistedOrganizationReadModel {
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
        status,
        invitationId: null,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
        suspendedAt: status === 'SUSPENDED' ? now : null,
        removedAt: null,
        lastChangedBy: actorId,
      },
    ],
    invitations: [],
  };
}

function readModel(input: PersistedCampaignCreate): PersistedCampaignReadModel {
  return {
    id: input.id,
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    description: input.description,
    status: input.status,
    visibility: input.visibility,
    timezone: input.timezone,
    locale: input.locale,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    rules: input.rules,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    archivedAt: null,
    cancelledAt: null,
    version: input.version,
  };
}
