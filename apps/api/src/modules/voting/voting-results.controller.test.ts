import { describe, expect, it } from 'vitest';

import { VotingApplicationError } from '@seneve/voting-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { VotingResultsController } from './voting-results.controller.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const candidateId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-07-31T12:00:00.000Z');

describe('VotingResultsController', () => {
  it('returns private aggregate results without voter-level data or rankings', async () => {
    const controller = new VotingResultsController({
      async getPrivateResults() {
        return {
          results: {
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
          },
          generatedAt: now,
        };
      },
    } as never);

    const response = await controller.get({ organizationId, campaignId }, request());

    expect(response).toMatchObject({
      results: {
        campaign: { id: campaignId, resultsVisibility: 'HIDDEN' },
        totals: { confirmedVotes: 3, distinctVoters: 2 },
        candidates: [{ id: candidateId, confirmedVotes: 3 }],
        generatedAt: now.toISOString(),
      },
      correlationId: 'corr-private-results-http',
    });
    expect(response.results.candidates[0]).not.toHaveProperty('rank');
    expect(JSON.stringify(response)).not.toContain('voterIdentityId');
  });

  it('maps permission denial to a stable forbidden response', async () => {
    const controller = new VotingResultsController({
      async getPrivateResults() {
        throw new VotingApplicationError('VOTING_RESULTS_PERMISSION_DENIED', 'Permission denied.');
      },
    } as never);

    await expect(controller.get({ organizationId, campaignId }, request())).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'VOTING_RESULTS_PERMISSION_DENIED',
        correlationId: 'corr-private-results-http',
      },
    });
  });
});

function request(): AuthenticatedHttpRequest {
  return {
    auth: {
      identityId: '55555555-5555-4555-8555-555555555555',
      sessionId: '66666666-6666-4666-8666-666666666666',
    },
    headers: { 'x-correlation-id': 'corr-private-results-http' },
  } as unknown as AuthenticatedHttpRequest;
}
