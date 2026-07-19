import { describe, expect, it } from 'vitest';

import { Campaign } from './campaign.js';
import { CampaignDomainError } from './domain-error.js';
import {
  CampaignId,
  CampaignRules,
  CampaignSchedule,
  IdentityRef,
  OrganizationId,
} from './value-objects.js';

const campaignId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-07-17T08:00:00.000Z');

function metadata() {
  return {
    eventId: '44444444-4444-4444-8444-444444444444',
    correlationId: 'corr_campaign_test',
    actorIdentityId: actorId,
    occurredAt: now,
  };
}

function schedule() {
  return CampaignSchedule.create({
    startsAt: new Date('2026-08-01T10:00:00.000Z'),
    endsAt: new Date('2026-08-31T22:00:00.000Z'),
    timezone: 'Africa/Lome',
    locale: 'en',
  });
}

function rules() {
  return CampaignRules.create({
    votingMode: 'FREE',
    votesPerVoter: 1,
    allowMultipleCandidates: false,
    requiresEmailVerification: true,
    results: {
      visibility: 'AFTER_CAMPAIGN',
      revealAt: null,
    },
  });
}

function createCampaign() {
  return Campaign.create({
    id: CampaignId.from(campaignId),
    organizationId: OrganizationId.from(organizationId),
    name: 'Seneve Awards',
    slug: 'seneve-awards',
    description: 'Annual awards campaign.',
    visibility: 'PRIVATE',
    schedule: schedule(),
    rules: rules(),
    createdBy: IdentityRef.from(actorId),
    createdAt: now,
    metadata: metadata(),
  });
}

describe('Campaign aggregate', () => {
  it('creates a draft campaign and emits a creation event', () => {
    const campaign = createCampaign();

    expect(campaign.toSnapshot()).toMatchObject({
      id: campaignId,
      organizationId,
      name: 'Seneve Awards',
      slug: 'seneve-awards',
      status: 'DRAFT',
      version: 1,
    });
    expect(campaign.pullDomainEvents()).toHaveLength(1);
  });

  it('rejects invalid names, slugs and schedules', () => {
    expect(() =>
      Campaign.create({
        id: CampaignId.from(campaignId),
        organizationId: OrganizationId.from(organizationId),
        name: 'x',
        slug: 'not valid',
        visibility: 'PRIVATE',
        schedule: schedule(),
        rules: rules(),
        createdBy: IdentityRef.from(actorId),
        createdAt: now,
        metadata: metadata(),
      }),
    ).toThrow(CampaignDomainError);

    expect(() =>
      CampaignSchedule.create({
        startsAt: new Date('2026-08-31T22:00:00.000Z'),
        endsAt: new Date('2026-08-01T10:00:00.000Z'),
        timezone: 'Africa/Lome',
        locale: 'en',
      }),
    ).toThrow(CampaignDomainError);
  });

  it('allows the approved lifecycle transitions and rejects forbidden transitions', () => {
    const scheduled = createCampaign().schedule({
      schedule: schedule(),
      updatedAt: now,
      metadata: metadata(),
    });
    const active = scheduled.activate({ updatedAt: now, metadata: metadata() });
    const paused = active.pause({ updatedAt: now, metadata: metadata() });
    const completed = paused.complete({ updatedAt: now, metadata: metadata() });
    const archived = completed.archive({ updatedAt: now, metadata: metadata() });

    expect(archived.toSnapshot().status).toBe('ARCHIVED');
    expect(() => createCampaign().activate({ updatedAt: now, metadata: metadata() })).toThrow(
      CampaignDomainError,
    );
  });

  it('blocks archival mutations and active foundational rule changes', () => {
    const archived = createCampaign()
      .schedule({ schedule: schedule(), updatedAt: now, metadata: metadata() })
      .activate({ updatedAt: now, metadata: metadata() })
      .complete({ updatedAt: now, metadata: metadata() })
      .archive({ updatedAt: now, metadata: metadata() });

    expect(() =>
      archived.updateDetails({
        name: 'Updated',
        slug: 'updated',
        visibility: 'PUBLIC',
        updatedAt: now,
        metadata: metadata(),
      }),
    ).toThrow(CampaignDomainError);

    const active = createCampaign()
      .schedule({ schedule: schedule(), updatedAt: now, metadata: metadata() })
      .activate({ updatedAt: now, metadata: metadata() });

    expect(() =>
      active.updateRules({
        rules: rules(),
        updatedAt: now,
        metadata: metadata(),
      }),
    ).toThrow(CampaignDomainError);
  });

  it('requires internally consistent result visibility configuration', () => {
    expect(() =>
      CampaignRules.create({
        votingMode: 'FREE',
        votesPerVoter: 1,
        allowMultipleCandidates: false,
        requiresEmailVerification: true,
        results: {
          visibility: 'SCHEDULED',
          revealAt: null,
        },
      }),
    ).toThrow(CampaignDomainError);
  });
});
