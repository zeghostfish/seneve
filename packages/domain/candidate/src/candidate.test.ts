import { describe, expect, it } from 'vitest';

import { Candidate } from './candidate.js';
import { CandidateDomainError } from './domain-error.js';
import { CampaignId, CandidateId, IdentityRef, OrganizationId } from './value-objects.js';

const candidateId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const actorId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-07-17T08:00:00.000Z');

function metadata() {
  return {
    eventId: '55555555-5555-4555-8555-555555555555',
    correlationId: 'corr_candidate_test',
    actorIdentityId: actorId,
    occurredAt: now,
  };
}

function createCandidate() {
  return Candidate.create({
    id: CandidateId.from(candidateId),
    organizationId: OrganizationId.from(organizationId),
    campaignId: CampaignId.from(campaignId),
    displayName: 'Jane Candidate',
    slug: 'jane-candidate',
    shortDescription: 'Candidate profile.',
    position: 1,
    createdBy: IdentityRef.from(actorId),
    createdAt: now,
    eventMetadata: metadata(),
  });
}

describe('Candidate aggregate', () => {
  it('creates a draft candidate and emits a creation event', () => {
    const candidate = createCandidate();

    expect(candidate.toSnapshot()).toMatchObject({
      id: candidateId,
      organizationId,
      campaignId,
      displayName: 'Jane Candidate',
      slug: 'jane-candidate',
      status: 'DRAFT',
      position: 1,
      version: 1,
    });
    expect(candidate.pullDomainEvents()).toHaveLength(1);
  });

  it('rejects invalid names, slugs and positions', () => {
    expect(() =>
      Candidate.create({
        id: CandidateId.from(candidateId),
        organizationId: OrganizationId.from(organizationId),
        campaignId: CampaignId.from(campaignId),
        displayName: 'x',
        slug: 'not valid',
        position: 0,
        createdBy: IdentityRef.from(actorId),
        createdAt: now,
        eventMetadata: metadata(),
      }),
    ).toThrow(CandidateDomainError);
  });

  it('allows approved transitions and rejects forbidden restoration', () => {
    const eligible = createCandidate().markEligible({ updatedAt: now, eventMetadata: metadata() });
    const suspended = eligible.suspend({
      reason: 'Policy review',
      updatedAt: now,
      eventMetadata: metadata(),
    });
    const reactivated = suspended.reactivate({ updatedAt: now, eventMetadata: metadata() });
    const withdrawn = reactivated.withdraw({
      reason: 'Candidate request',
      updatedAt: now,
      eventMetadata: metadata(),
    });
    const archived = withdrawn.archive({ updatedAt: now, eventMetadata: metadata() });

    expect(archived.toSnapshot().status).toBe('ARCHIVED');
    expect(() => archived.markEligible({ updatedAt: now, eventMetadata: metadata() })).toThrow(
      CandidateDomainError,
    );
  });

  it('requires explicit bounded reasons for suspension, withdrawal and disqualification', () => {
    const eligible = createCandidate().markEligible({ updatedAt: now, eventMetadata: metadata() });

    expect(() =>
      eligible.disqualify({
        reason: '',
        updatedAt: now,
        eventMetadata: metadata(),
      }),
    ).toThrow(CandidateDomainError);
  });

  it('blocks foundational updates after eligibility and all updates after archival', () => {
    const eligible = createCandidate().markEligible({ updatedAt: now, eventMetadata: metadata() });

    expect(() =>
      eligible.update({
        displayName: 'New Name',
        slug: 'new-name',
        updatedAt: now,
        eventMetadata: metadata(),
      }),
    ).toThrow(CandidateDomainError);

    const archived = createCandidate().archive({ updatedAt: now, eventMetadata: metadata() });
    expect(() => archived.reposition(2, now)).toThrow(CandidateDomainError);
  });
});
