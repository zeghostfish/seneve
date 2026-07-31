import { describe, expect, it } from 'vitest';

import { PermissionEvaluationService } from '@seneve/authorization-application';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
} from '@seneve/tenant-context';

import { VotingResultsApplicationService } from './voting-results-application-service.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const actorIdentityId = '33333333-3333-4333-8333-333333333333';
const campaignId = '44444444-4444-4444-8444-444444444444';
const candidateId = '55555555-5555-4555-8555-555555555555';
const now = new Date('2026-07-31T12:00:00.000Z');

describe('VotingResultsApplicationService', () => {
  it('returns an aggregate-only result projection to an authorized organization member', async () => {
    const service = new VotingResultsApplicationService(dependencies('OWNER'));

    const result = await service.getPrivateResults({
      actorIdentityId,
      organizationId,
      campaignId,
      correlationId: 'corr-private-results',
    });

    expect(result).toEqual({
      results: expect.objectContaining({
        campaignId,
        totalConfirmedVotes: 3,
        distinctVoterCount: 2,
        candidates: [
          expect.objectContaining({
            candidateId,
            confirmedVotes: 3,
          }),
        ],
      }),
      generatedAt: now,
    });
    expect(result.results).not.toHaveProperty('voterIdentityId');
  });

  it('denies a role without the private-results permission', async () => {
    const service = new VotingResultsApplicationService(dependencies('VIEWER'));

    await expect(
      service.getPrivateResults({
        actorIdentityId,
        organizationId,
        campaignId,
        correlationId: 'corr-private-results-denied',
      }),
    ).rejects.toMatchObject({ code: 'VOTING_RESULTS_PERMISSION_DENIED' });
  });

  it('conceals campaigns outside the authorized organization', async () => {
    const service = new VotingResultsApplicationService(dependencies('AUDITOR', null));

    await expect(
      service.getPrivateResults({
        actorIdentityId,
        organizationId,
        campaignId,
        correlationId: 'corr-private-results-missing',
      }),
    ).rejects.toMatchObject({ code: 'VOTING_RESULTS_NOT_FOUND' });
  });
});

function dependencies(
  role: 'OWNER' | 'VIEWER' | 'AUDITOR',
  results: ReturnType<typeof resultProjection> | null = resultProjection(),
) {
  return {
    unitOfWork: {
      async transaction<T>(
        work: (repository: {
          getPrivateResults(): Promise<ReturnType<typeof resultProjection> | null>;
        }) => Promise<T>,
      ) {
        return work({
          async getPrivateResults() {
            return results;
          },
        });
      },
    },
    organizations: {
      async findOrganizationById() {
        return {
          id: organizationId,
          publicId: null,
          displayName: 'Seneve Organization',
          slug: 'seneve-organization',
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
              id: '66666666-6666-4666-8666-666666666666',
              organizationId,
              identityId: actorIdentityId,
              role,
              status: 'ACTIVE',
              invitationId: null,
              createdAt: now,
              updatedAt: now,
              activatedAt: now,
              suspendedAt: null,
              removedAt: null,
              lastChangedBy: actorIdentityId,
            },
          ],
          invitations: [],
        };
      },
    },
    identities: {
      async findById() {
        return {
          id: actorIdentityId,
          status: 'ACTIVE',
          normalizedLoginEmail: 'owner@example.com',
          version: 1,
          createdAt: now,
          updatedAt: now,
          suspendedAt: null,
          closedAt: null,
          user: {
            id: '77777777-7777-4777-8777-777777777777',
            displayName: 'Owner',
          },
          primaryEmail: {
            id: '88888888-8888-4888-8888-888888888888',
            email: 'owner@example.com',
            normalizedEmail: 'owner@example.com',
            verifiedAt: now,
          },
          activeCredentials: [],
        };
      },
    },
    permissions: new PermissionEvaluationService(),
    executionContext: new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider()),
    clock: { now: () => now },
  } as never;
}

function resultProjection() {
  return {
    organizationId,
    campaignId,
    campaignName: 'Seneve Awards',
    campaignStatus: 'ACTIVE',
    resultsVisibility: 'HIDDEN',
    resultRevealAt: null,
    totalConfirmedVotes: 3,
    distinctVoterCount: 2,
    candidates: [
      {
        candidateId,
        displayName: 'Candidate One',
        status: 'ELIGIBLE',
        position: 1,
        confirmedVotes: 3,
      },
    ],
  };
}
