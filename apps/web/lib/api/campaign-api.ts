import { apiClient } from './client';
import type {
  CampaignResultsVisibility,
  CampaignStatus,
  CampaignSummary,
  CampaignVisibility,
  CampaignVotingMode,
} from './types';

export interface CampaignListFilters {
  readonly status?: CampaignStatus;
  readonly visibility?: CampaignVisibility;
  readonly search?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface CampaignMutationRequest {
  readonly expectedVersion: number;
}

export interface CampaignDetailsRequest {
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly visibility: CampaignVisibility;
}

export interface CampaignScheduleRequest {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly locale: string;
}

export interface CampaignRulesRequest {
  readonly votingMode: CampaignVotingMode;
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly resultsVisibility: CampaignResultsVisibility;
  readonly resultRevealAt?: string | null;
}

export type CreateCampaignRequest = CampaignDetailsRequest &
  CampaignScheduleRequest &
  CampaignRulesRequest;

export const campaignApi = {
  list(accessToken: string, organizationId: string, filters: CampaignListFilters = {}) {
    return apiClient.request<{
      readonly campaigns: readonly CampaignSummary[];
      readonly nextCursor: string | null;
    }>(`/organizations/${organizationId}/campaigns${query(filters)}`, { accessToken });
  },

  get(accessToken: string, organizationId: string, campaignId: string) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}`,
      { accessToken },
    );
  },

  create(accessToken: string, organizationId: string, input: CreateCampaignRequest) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },

  update(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    input: CampaignDetailsRequest & CampaignMutationRequest,
  ) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}`,
      {
        method: 'PATCH',
        accessToken,
        body: input,
      },
    );
  },

  updateRules(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    input: CampaignRulesRequest & CampaignMutationRequest,
  ) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/rules`,
      {
        method: 'PATCH',
        accessToken,
        body: input,
      },
    );
  },

  schedule(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    input: CampaignScheduleRequest & CampaignMutationRequest,
  ) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/schedule`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },

  transition(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    action: 'activate' | 'pause' | 'complete' | 'cancel' | 'archive',
    input: CampaignMutationRequest,
  ) {
    return apiClient.request<{ readonly campaign: CampaignSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/${action}`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },
};

function query(filters: CampaignListFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}
