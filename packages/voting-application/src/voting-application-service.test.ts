import { describe, expect, it } from 'vitest';

import type { IdentityRepository } from '@seneve/domain-identity';
import type {
  VoteAttemptSnapshot,
  VotingRepositories,
  VotingUnitOfWork,
} from '@seneve/domain-voting';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
} from '@seneve/tenant-context';

import type { VotingApplicationDependencies } from './contracts.js';
import { VotingApplicationService } from './voting-application-service.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const voterIdentityId = '55555555-5555-4555-8555-555555555555';
const requestId = '77777777-7777-4777-8777-777777777777';
const now = new Date('2026-07-23T12:00:00.000Z');

describe('VotingApplicationService', () => {
  it('confirms a free vote atomically and records meaningful audit events', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);
    const result = await service.submitFreeVote(command());

    expect(result).toMatchObject({ replayed: false, vote: { status: 'CONFIRMED' } });
    expect(deps.recordedEvents).toEqual(['VoteAttemptCreated', 'VoteConfirmed']);
  });

  it('returns an idempotent replay without creating or auditing another vote', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);
    const first = await service.submitFreeVote(command());
    const second = await service.submitFreeVote(command());

    expect(second).toMatchObject({ replayed: true, vote: { id: first.vote.id } });
    expect(deps.votes.size).toBe(1);
    expect(deps.recordedEvents).toHaveLength(2);
  });

  it('rejects reuse of a request id for another candidate', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);
    await service.submitFreeVote(command());

    await expect(
      service.submitFreeVote({
        ...command(),
        candidateId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'VOTE_REQUEST_CONFLICT' }));
  });

  it('enforces the configured per-voter quota', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);
    await service.submitFreeVote(command());

    await expect(
      service.submitFreeVote({
        ...command(),
        requestId: '88888888-8888-4888-8888-888888888888',
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'VOTING_QUOTA_REACHED' }));
  });

  it('returns a safe ordered ballot with the remaining quota', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);

    const result = await service.getBallot({
      voterIdentityId,
      organizationId,
      campaignId,
      correlationId: 'corr-ballot-application',
    });

    expect(result).toMatchObject({
      campaign: { id: campaignId, name: 'Seneve Awards' },
      candidates: [{ id: candidateId, displayName: 'Candidate One', position: 1 }],
      confirmedVoteCount: 0,
      remainingVotes: 1,
    });
  });

  it('does not expose private campaigns as a ballot', async () => {
    const deps = dependencies({ campaignVisibility: 'PRIVATE' });
    const service = new VotingApplicationService(deps);

    await expect(
      service.getBallot({
        voterIdentityId,
        organizationId,
        campaignId,
        correlationId: 'corr-private-ballot',
      }),
    ).rejects.toThrowError(expect.objectContaining({ code: 'VOTING_CAMPAIGN_PRIVATE' }));
  });

  it('lists only the authenticated identity confirmed vote receipts', async () => {
    const deps = dependencies();
    const service = new VotingApplicationService(deps);
    await service.submitFreeVote(command());

    const result = await service.listOwnVotes({
      voterIdentityId,
      organizationId,
      limit: 25,
      cursor: null,
      correlationId: 'corr-voting-history',
    });

    expect(result).toEqual({
      receipts: [
        expect.objectContaining({
          campaignName: 'Seneve Awards',
          candidateDisplayName: 'Candidate One',
          status: 'CONFIRMED',
        }),
      ],
      nextCursor: null,
    });
  });

  it('confirms a multi-candidate ballot atomically and replays it idempotently', async () => {
    const deps = dependencies({ allowMultipleCandidates: true, votesPerVoter: 3 });
    const service = new VotingApplicationService(deps);
    const ballot = {
      voterIdentityId,
      organizationId,
      campaignId,
      selections: [
        { candidateId, requestId },
        {
          candidateId: '99999999-9999-4999-8999-999999999999',
          requestId: '88888888-8888-4888-8888-888888888888',
        },
      ],
      correlationId: 'corr-multi-ballot',
    };

    const first = await service.submitFreeBallot(ballot);
    const replay = await service.submitFreeBallot(ballot);

    expect(first).toMatchObject({
      replayed: false,
      votes: [
        { candidateId, status: 'CONFIRMED' },
        { candidateId: '99999999-9999-4999-8999-999999999999', status: 'CONFIRMED' },
      ],
    });
    expect(replay).toMatchObject({ replayed: true, votes: first.votes });
    expect(deps.votes.size).toBe(2);
    expect(deps.recordedEvents).toHaveLength(4);
  });

  it('rejects multiple candidates when campaign rules require one candidate', async () => {
    const deps = dependencies({ allowMultipleCandidates: false, votesPerVoter: 3 });
    const service = new VotingApplicationService(deps);

    await expect(
      service.submitFreeBallot({
        voterIdentityId,
        organizationId,
        campaignId,
        selections: [
          { candidateId, requestId },
          {
            candidateId: '99999999-9999-4999-8999-999999999999',
            requestId: '88888888-8888-4888-8888-888888888888',
          },
        ],
        correlationId: 'corr-single-candidate-ballot',
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'VOTING_MULTIPLE_CANDIDATES_NOT_ALLOWED' }),
    );
  });

  it('prevents later votes from switching candidates when multiple candidates are disabled', async () => {
    const deps = dependencies({ allowMultipleCandidates: false, votesPerVoter: 3 });
    const service = new VotingApplicationService(deps);
    await service.submitFreeVote(command());

    await expect(
      service.submitFreeVote({
        ...command(),
        candidateId: '99999999-9999-4999-8999-999999999999',
        requestId: '88888888-8888-4888-8888-888888888888',
      }),
    ).rejects.toThrowError(
      expect.objectContaining({ code: 'VOTING_MULTIPLE_CANDIDATES_NOT_ALLOWED' }),
    );
  });
});

function command() {
  return {
    voterIdentityId,
    organizationId,
    campaignId,
    candidateId,
    requestId,
    correlationId: 'corr-vote-application',
  };
}

function dependencies(
  options: {
    campaignVisibility?: string;
    allowMultipleCandidates?: boolean;
    votesPerVoter?: number;
  } = {},
) {
  const votes = new Map<string, VoteAttemptSnapshot>();
  const recordedEvents: string[] = [];
  const repositories: VotingRepositories = {
    auditEvents: {
      async record(event) {
        recordedEvents.push(event.name);
      },
    },
    votes: {
      async lockVoter() {},
      async findByRequest(input) {
        return (
          [...votes.values()].find(
            (vote) =>
              vote.organizationId === input.organizationId &&
              vote.campaignId === input.campaignId &&
              vote.voterIdentityId === input.voterIdentityId &&
              vote.requestId === input.requestId,
          ) ?? null
        );
      },
      async countConfirmed(input) {
        return [...votes.values()].filter(
          (vote) =>
            vote.organizationId === input.organizationId &&
            vote.campaignId === input.campaignId &&
            vote.voterIdentityId === input.voterIdentityId &&
            vote.status === 'CONFIRMED',
        ).length;
      },
      async listConfirmedCandidateIds(input) {
        return [
          ...new Set(
            [...votes.values()]
              .filter(
                (vote) =>
                  vote.organizationId === input.organizationId &&
                  vote.campaignId === input.campaignId &&
                  vote.voterIdentityId === input.voterIdentityId &&
                  vote.status === 'CONFIRMED',
              )
              .map((vote) => vote.candidateId),
          ),
        ];
      },
      async create(vote) {
        votes.set(vote.id, vote);
      },
      async findOwnedById(input) {
        const vote = votes.get(input.voteAttemptId);
        return vote?.organizationId === input.organizationId &&
          vote.voterIdentityId === input.voterIdentityId
          ? vote
          : null;
      },
      async listOwned(input) {
        const receipts = [...votes.values()]
          .filter(
            (vote) =>
              vote.organizationId === input.organizationId &&
              vote.voterIdentityId === input.voterIdentityId &&
              vote.status === 'CONFIRMED',
          )
          .slice(0, input.limit)
          .map((vote) => ({
            id: vote.id,
            organizationId: vote.organizationId,
            campaignId: vote.campaignId,
            campaignName: 'Seneve Awards',
            candidateId: vote.candidateId,
            candidateDisplayName: 'Candidate One',
            status: vote.status,
            createdAt: vote.createdAt,
            confirmedAt: vote.confirmedAt,
          }));
        return { receipts, nextCursor: null };
      },
    },
    async findCampaign() {
      return {
        id: campaignId,
        organizationId,
        name: 'Seneve Awards',
        description: 'Choose one eligible candidate.',
        status: 'ACTIVE',
        visibility: options.campaignVisibility ?? 'UNLISTED',
        timezone: 'Africa/Lome',
        locale: 'en',
        votingMode: 'FREE',
        votesPerVoter: options.votesPerVoter ?? 1,
        allowMultipleCandidates: options.allowMultipleCandidates ?? false,
        requiresEmailVerification: true,
        startsAt: new Date('2026-07-23T10:00:00.000Z'),
        endsAt: new Date('2026-07-23T14:00:00.000Z'),
      };
    },
    async findCandidate(input) {
      return {
        id: input.candidateId,
        organizationId,
        campaignId,
        displayName: 'Candidate One',
        slug: 'candidate-one',
        shortDescription: 'Candidate summary',
        imageAssetId: null,
        position: 1,
        status: 'ELIGIBLE',
      };
    },
    async listEligibleCandidates() {
      return [
        {
          id: candidateId,
          organizationId,
          campaignId,
          displayName: 'Candidate One',
          slug: 'candidate-one',
          shortDescription: 'Candidate summary',
          imageAssetId: null,
          position: 1,
          status: 'ELIGIBLE',
        },
      ];
    },
  };
  let idIndex = 0;
  const generatedIds = [
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666661',
    '66666666-6666-4666-8666-666666666662',
    '11111111-1111-4111-8111-111111111112',
    '66666666-6666-4666-8666-666666666663',
    '66666666-6666-4666-8666-666666666664',
    '11111111-1111-4111-8111-111111111113',
    '66666666-6666-4666-8666-666666666665',
    '66666666-6666-4666-8666-666666666666',
  ];
  const deps = {
    unitOfWork: {
      async transaction<T>(work: (repositories: VotingRepositories) => Promise<T>) {
        return work(repositories);
      },
    } satisfies VotingUnitOfWork,
    identities: {
      async findById() {
        return {
          id: voterIdentityId,
          status: 'ACTIVE',
          normalizedLoginEmail: 'voter@example.com',
          version: 1,
          createdAt: now,
          updatedAt: now,
          suspendedAt: null,
          closedAt: null,
          user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Voter' },
          primaryEmail: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            email: 'voter@example.com',
            normalizedEmail: 'voter@example.com',
            verifiedAt: now,
          },
          activeCredentials: [],
        };
      },
    } as unknown as IdentityRepository,
    executionContext: new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider()),
    ids: { uuid: () => generatedIds[idIndex++] ?? crypto.randomUUID() },
    clock: { now: () => now },
  } satisfies VotingApplicationDependencies;

  return { ...deps, votes, recordedEvents };
}
