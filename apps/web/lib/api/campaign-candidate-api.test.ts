import { afterEach, describe, expect, it, vi } from 'vitest';

import { campaignApi } from './campaign-api';
import { candidateApi } from './candidate-api';

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Campaign and Candidate API clients', () => {
  it('uses organization-scoped campaign list filters', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(json({ campaigns: [], nextCursor: null }));

    await campaignApi.list('access_token', 'org_1', {
      status: 'DRAFT',
      visibility: 'PRIVATE',
      search: 'awards',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/organizations/org_1/campaigns?status=DRAFT&visibility=PRIVATE&search=awards',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('uses campaign-scoped candidate lifecycle and reorder routes', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(json({ candidate: candidate() }));

    await candidateApi.transition(
      'access_token',
      'org_1',
      'campaign_1',
      'candidate_1',
      'withdraw',
      {
        expectedVersion: 3,
        reason: 'Candidate request',
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/organizations/org_1/campaigns/campaign_1/candidates/candidate_1/withdraw',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    fetchMock.mockResolvedValue(json({ candidates: [], nextCursor: null }));
    await candidateApi.reorder('access_token', 'org_1', 'campaign_1', [
      'candidate_2',
      'candidate_1',
    ]);

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/organizations/org_1/campaigns/campaign_1/candidates/reorder',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidateIds: ['candidate_2', 'candidate_1'] }),
      }),
    );
  });
});

function json(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  };
}

function candidate() {
  return {
    id: 'candidate_1',
    organizationId: 'org_1',
    campaignId: 'campaign_1',
    displayName: 'Candidate',
    slug: 'candidate',
    status: 'DRAFT',
    position: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}
