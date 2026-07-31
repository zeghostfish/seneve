import { apiClient } from './client';
import type { VotingBallot, VotingReceipt } from './types';

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
};
