import { apiClient } from './client';
import type { VotingBallot, VotingHistoryReceipt, VotingReceipt } from './types';

export const votingApi = {
  getBallot(accessToken: string, organizationId: string, campaignId: string) {
    return apiClient.request<{ readonly ballot: VotingBallot; readonly correlationId: string }>(
      `/voting/organizations/${organizationId}/campaigns/${campaignId}/ballot`,
      { accessToken },
    );
  },

  submitFreeVote(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    candidateId: string,
    requestId: string,
  ) {
    return apiClient.request<{
      readonly vote: VotingReceipt;
      readonly replayed: boolean;
      readonly correlationId: string;
    }>(`/voting/organizations/${organizationId}/campaigns/${campaignId}/votes`, {
      method: 'POST',
      accessToken,
      body: { candidateId, requestId },
    });
  },

  listOwnVotes(
    accessToken: string,
    organizationId: string,
    options: { readonly limit?: number; readonly cursor?: string | null } = {},
  ) {
    const query = new URLSearchParams({ limit: String(options.limit ?? 25) });
    if (options.cursor) {
      query.set('cursor', options.cursor);
    }
    return apiClient.request<{
      readonly receipts: readonly VotingHistoryReceipt[];
      readonly nextCursor: string | null;
      readonly correlationId: string;
    }>(`/voting/organizations/${organizationId}/votes?${query.toString()}`, { accessToken });
  },
};
