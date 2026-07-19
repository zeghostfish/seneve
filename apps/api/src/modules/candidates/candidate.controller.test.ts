import { describe, expect, it } from 'vitest';

import { CandidateApplicationError } from '@seneve/candidate-application';

import type { AuthenticatedHttpRequest } from '../auth/auth-http.types.js';
import { CandidateController } from './candidate.controller.js';

const organizationId = '22222222-2222-4222-8222-222222222222';
const campaignId = '33333333-3333-4333-8333-333333333333';
const candidateId = '66666666-6666-4666-8666-666666666666';
const actorId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-07-17T08:00:00.000Z');

describe('CandidateController', () => {
  it('maps candidate creation to the public response contract', async () => {
    const controller = new CandidateController({
      async createCandidate() {
        return { candidate: candidateSnapshot() };
      },
    } as never);

    const response = await controller.create(
      { organizationId, campaignId },
      {
        displayName: 'Jane Candidate',
        slug: 'jane-candidate',
      },
      request(),
    );

    expect(response.candidate).toMatchObject({
      id: candidateId,
      organizationId,
      campaignId,
      slug: 'jane-candidate',
      status: 'DRAFT',
    });
    expect(response.correlationId).toBe('corr_candidate_http');
  });

  it('maps permission denials to a public HTTP error', async () => {
    const controller = new CandidateController({
      async createCandidate() {
        throw new CandidateApplicationError('CANDIDATE_PERMISSION_DENIED', 'Permission denied.');
      },
    } as never);

    await expect(
      controller.create(
        { organizationId, campaignId },
        {
          displayName: 'Jane Candidate',
          slug: 'jane-candidate',
        },
        request(),
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'CANDIDATE_PERMISSION_DENIED',
        correlationId: 'corr_candidate_http',
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
      'x-correlation-id': 'corr_candidate_http',
    },
  } as unknown as AuthenticatedHttpRequest;
}

function candidateSnapshot() {
  return {
    id: candidateId,
    organizationId,
    campaignId,
    displayName: 'Jane Candidate',
    slug: 'jane-candidate',
    shortDescription: null,
    description: null,
    status: 'DRAFT' as const,
    position: 1,
    imageAssetId: null,
    externalReference: null,
    metadata: {},
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    statusReason: null,
    archivedAt: null,
    version: 1,
  };
}
