import { afterEach, describe, expect, it, vi } from 'vitest';

import { votingApi } from './voting-api';

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('Voting API client', () => {
  it('loads an authenticated ballot and submits an idempotent vote', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(json({ ballot: { candidates: [] } }));

    await votingApi.getBallot('access-token', 'org-1', 'campaign-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/voting/organizations/org-1/campaigns/campaign-1/ballot',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );

    fetchMock.mockResolvedValue(json({ vote: { status: 'CONFIRMED' }, replayed: false }));
    await votingApi.submitFreeVote(
      'access-token',
      'org-1',
      'campaign-1',
      'candidate-1',
      'request-1',
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3000/api/v1/voting/organizations/org-1/campaigns/campaign-1/votes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidateId: 'candidate-1', requestId: 'request-1' }),
      }),
    );
  });

  it('loads paginated receipts for the authenticated identity', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(json({ receipts: [], nextCursor: null }));

    await votingApi.listOwnVotes('access-token', 'org-1', {
      limit: 10,
      cursor: 'receipt-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/voting/organizations/org-1/votes?limit=10&cursor=receipt-1',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
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
