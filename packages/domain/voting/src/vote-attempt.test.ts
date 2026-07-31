import { describe, expect, it } from 'vitest';

import { VotingDomainError } from './domain-error.js';
import { VoteAttempt } from './vote-attempt.js';
import { assertVotingCampaignAccess, assertVotingEligibility } from './voting-policy.js';

const now = new Date('2026-07-23T12:00:00.000Z');
const metadata = {
  eventId: '66666666-6666-4666-8666-666666666666',
  correlationId: 'corr-vote-test',
  actorIdentityId: '55555555-5555-4555-8555-555555555555',
  occurredAt: now,
};

function createAttempt() {
  return VoteAttempt.create({
    id: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    campaignId: '33333333-3333-4333-8333-333333333333',
    candidateId: '44444444-4444-4444-8444-444444444444',
    voterIdentityId: metadata.actorIdentityId,
    requestId: '77777777-7777-4777-8777-777777777777',
    createdAt: now,
    metadata,
  });
}

describe('VoteAttempt', () => {
  it('creates and confirms an immutable vote attempt', () => {
    const confirmed = createAttempt().confirm({ confirmedAt: now, metadata });
    expect(confirmed.toSnapshot()).toMatchObject({ status: 'CONFIRMED', version: 2 });
    expect(confirmed.pullDomainEvents().map((event) => event.name)).toEqual(['VoteConfirmed']);
    expect(() => confirmed.reject({ code: 'LATE', rejectedAt: now, metadata })).toThrow(
      VotingDomainError,
    );
  });

  it('rejects malformed identifiers', () => {
    expect(() =>
      VoteAttempt.create({
        ...createAttempt().toSnapshot(),
        id: 'vote-1',
        metadata,
      }),
    ).toThrowError(expect.objectContaining({ code: 'VOTE_ID_INVALID' }));
  });
});

describe('Voting eligibility policy', () => {
  const eligible = {
    identityStatus: 'ACTIVE',
    emailVerified: true,
    campaignStatus: 'ACTIVE',
    campaignVisibility: 'UNLISTED',
    votingMode: 'FREE',
    requiresEmailVerification: true,
    startsAt: new Date('2026-07-23T10:00:00.000Z'),
    endsAt: new Date('2026-07-23T14:00:00.000Z'),
    candidateStatus: 'ELIGIBLE',
    confirmedVoteCount: 0,
    votesPerVoter: 1,
    now,
  };

  it('accepts a free vote satisfying campaign rules', () => {
    expect(() => assertVotingEligibility(eligible)).not.toThrow();
  });

  it('allows an eligible identity to read the ballot without candidate state', () => {
    const {
      candidateStatus: _candidateStatus,
      confirmedVoteCount: _count,
      votesPerVoter: _quota,
      ...campaign
    } = eligible;

    expect(() => assertVotingCampaignAccess(campaign)).not.toThrow();
  });

  it.each([
    ['VOTING_IDENTITY_INACTIVE', { identityStatus: 'SUSPENDED' }],
    ['VOTING_EMAIL_VERIFICATION_REQUIRED', { emailVerified: false }],
    ['VOTING_CAMPAIGN_NOT_ACTIVE', { campaignStatus: 'PAUSED' }],
    ['VOTING_CAMPAIGN_PRIVATE', { campaignVisibility: 'PRIVATE' }],
    ['VOTING_CAMPAIGN_OUTSIDE_WINDOW', { now: new Date('2026-07-23T15:00:00.000Z') }],
    ['VOTING_CANDIDATE_NOT_ELIGIBLE', { candidateStatus: 'SUSPENDED' }],
    ['VOTING_PAYMENT_REQUIRED', { votingMode: 'PAID' }],
    ['VOTING_QUOTA_REACHED', { confirmedVoteCount: 1 }],
  ])('rejects %s', (code, change) => {
    expect(() => assertVotingEligibility({ ...eligible, ...change })).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});
