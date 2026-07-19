import { describe, expect, it } from 'vitest';

import { CampaignApplicationError } from '@seneve/campaign-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { CampaignController } from './campaign.controller.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '55555555-5555-4555-8555-555555555555';
const actorId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-07-17T08:00:00.000Z');

describe('CampaignController', () => {
  it('maps campaign creation to the public response contract', async () => {
    const controller = new CampaignController({
      async createCampaign() {
        return { campaign: campaignReadModel() };
      },
    } as never);

    const response = await controller.create(
      { organizationId },
      {
        name: 'Seneve Awards',
        slug: 'seneve-awards',
        visibility: 'PRIVATE',
        startsAt: '2026-08-01T10:00:00.000Z',
        endsAt: '2026-08-31T22:00:00.000Z',
        timezone: 'Africa/Lome',
        locale: 'en',
        votingMode: 'FREE',
        votesPerVoter: 1,
        allowMultipleCandidates: false,
        requiresEmailVerification: true,
        resultsVisibility: 'AFTER_CAMPAIGN',
      },
      request(),
    );

    expect(response.campaign).toMatchObject({
      id: campaignId,
      organizationId,
      slug: 'seneve-awards',
      status: 'DRAFT',
    });
    expect(response.correlationId).toBe('corr_campaign_http');
  });

  it('maps permission denials to a public HTTP error', async () => {
    const controller = new CampaignController({
      async createCampaign() {
        throw new CampaignApplicationError('CAMPAIGN_PERMISSION_DENIED', 'Permission denied.');
      },
    } as never);

    await expect(
      controller.create(
        { organizationId },
        {
          name: 'Seneve Awards',
          slug: 'seneve-awards',
          visibility: 'PRIVATE',
          startsAt: '2026-08-01T10:00:00.000Z',
          endsAt: '2026-08-31T22:00:00.000Z',
          timezone: 'Africa/Lome',
          locale: 'en',
          votingMode: 'FREE',
          votesPerVoter: 1,
          allowMultipleCandidates: false,
          requiresEmailVerification: true,
          resultsVisibility: 'AFTER_CAMPAIGN',
        },
        request(),
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'CAMPAIGN_PERMISSION_DENIED',
        correlationId: 'corr_campaign_http',
      },
    });
  });
});

function request(): AuthenticatedHttpRequest {
  return {
    auth: {
      identityId: actorId,
      sessionId: 'session_test',
      accessTokenExpiresAt: now,
    },
    headers: {
      'x-correlation-id': 'corr_campaign_http',
    },
  } as unknown as AuthenticatedHttpRequest;
}

function campaignReadModel() {
  return {
    id: campaignId,
    organizationId,
    name: 'Seneve Awards',
    slug: 'seneve-awards',
    description: null,
    status: 'DRAFT' as const,
    visibility: 'PRIVATE' as const,
    timezone: 'Africa/Lome',
    locale: 'en',
    startsAt: new Date('2026-08-01T10:00:00.000Z'),
    endsAt: new Date('2026-08-31T22:00:00.000Z'),
    rules: {
      votingMode: 'FREE' as const,
      votesPerVoter: 1,
      allowMultipleCandidates: false,
      requiresEmailVerification: true,
      results: {
        visibility: 'AFTER_CAMPAIGN' as const,
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
