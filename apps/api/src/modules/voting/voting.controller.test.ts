import { describe, expect, it } from 'vitest';

import { VotingApplicationError } from '@seneve/voting-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { VotingController } from './voting.controller.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const identityId = '55555555-5555-4555-8555-555555555555';
const requestId = '77777777-7777-4777-8777-777777777777';
const voteAttemptId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-07-23T12:00:00.000Z');

describe('VotingController', () => {
  it('returns a safe authenticated ballot view', async () => {
    const controller = new VotingController({
      async getBallot() {
        return {
          campaign: {
            id: campaignId,
            organizationId,
            name: 'Seneve Awards',
            description: null,
            status: 'ACTIVE',
            visibility: 'UNLISTED',
            timezone: 'Africa/Lome',
            locale: 'en',
            votingMode: 'FREE',
            votesPerVoter: 1,
            allowMultipleCandidates: false,
            requiresEmailVerification: true,
            startsAt: now,
            endsAt: new Date('2026-07-23T14:00:00.000Z'),
          },
          candidates: [
            {
              id: candidateId,
              organizationId,
              campaignId,
              displayName: 'Candidate One',
              slug: 'candidate-one',
              shortDescription: null,
              imageAssetId: null,
              position: 1,
              status: 'ELIGIBLE',
            },
          ],
          confirmedVoteCount: 0,
          remainingVotes: 1,
        };
      },
    } as never);

    const response = await controller.getBallot({ organizationId, campaignId }, request());

    expect(response).toMatchObject({
      ballot: {
        campaign: { id: campaignId, name: 'Seneve Awards' },
        candidates: [{ id: candidateId, displayName: 'Candidate One' }],
        remainingVotes: 1,
      },
      correlationId: 'corr-vote-http',
    });
    expect(response.ballot.candidates[0]).not.toHaveProperty('organizationId');
  });

  it('maps confirmed votes without exposing voter identity or request identifiers', async () => {
    const controller = new VotingController({
      async submitFreeVote() {
        return { vote: vote(), replayed: false };
      },
    } as never);
    const response = await controller.submit(
      { organizationId, campaignId },
      { candidateId, requestId },
      request(),
    );

    expect(response).toMatchObject({
      vote: { id: voteAttemptId, status: 'CONFIRMED' },
      replayed: false,
      correlationId: 'corr-vote-http',
    });
    expect(response.vote).not.toHaveProperty('voterIdentityId');
    expect(response.vote).not.toHaveProperty('requestId');
  });

  it('maps quota rejection to a stable conflict response', async () => {
    const controller = new VotingController({
      async submitFreeVote() {
        throw new VotingApplicationError('VOTING_QUOTA_REACHED', 'Quota reached.');
      },
    } as never);

    await expect(
      controller.submit({ organizationId, campaignId }, { candidateId, requestId }, request()),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'VOTING_QUOTA_REACHED', correlationId: 'corr-vote-http' },
    });
  });

  it('maps paginated own-vote receipts without exposing voter identity', async () => {
    const controller = new VotingController({
      async listOwnVotes() {
        return {
          receipts: [
            {
              id: voteAttemptId,
              organizationId,
              campaignId,
              campaignName: 'Seneve Awards',
              candidateId,
              candidateDisplayName: 'Candidate One',
              status: 'CONFIRMED',
              createdAt: now,
              confirmedAt: now,
            },
          ],
          nextCursor: null,
        };
      },
    } as never);

    const response = await controller.listOwn({ organizationId }, { limit: 25 }, request());

    expect(response).toMatchObject({
      receipts: [
        {
          id: voteAttemptId,
          campaignName: 'Seneve Awards',
          candidateDisplayName: 'Candidate One',
          status: 'CONFIRMED',
        },
      ],
      nextCursor: null,
      correlationId: 'corr-vote-http',
    });
    expect(response.receipts[0]).not.toHaveProperty('voterIdentityId');
  });
});

function request(): AuthenticatedHttpRequest {
  return {
    auth: { identityId, sessionId: 'session-test', accessTokenExpiresAt: now },
    headers: { 'x-correlation-id': 'corr-vote-http' },
  } as unknown as AuthenticatedHttpRequest;
}

function vote() {
  return {
    id: voteAttemptId,
    organizationId,
    campaignId,
    candidateId,
    voterIdentityId: identityId,
    requestId,
    status: 'CONFIRMED' as const,
    rejectionCode: null,
    createdAt: now,
    confirmedAt: now,
    rejectedAt: null,
    version: 2,
  };
}
