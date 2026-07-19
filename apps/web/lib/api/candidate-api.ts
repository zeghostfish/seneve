import { apiClient } from './client';
import type { CandidateStatus, CandidateSummary } from './types';

export interface CandidateListFilters {
  readonly status?: CandidateStatus;
  readonly search?: string;
  readonly eligibleOnly?: boolean;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface CandidateDetailsRequest {
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription?: string | null;
  readonly description?: string | null;
  readonly imageAssetId?: string | null;
  readonly externalReference?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CandidateMutationRequest {
  readonly expectedVersion: number;
}

export interface CandidateReasonRequest extends CandidateMutationRequest {
  readonly reason: string;
}

export const candidateApi = {
  list(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    filters: CandidateListFilters = {},
  ) {
    return apiClient.request<{
      readonly candidates: readonly CandidateSummary[];
      readonly nextCursor: string | null;
    }>(`/organizations/${organizationId}/campaigns/${campaignId}/candidates${query(filters)}`, {
      accessToken,
    });
  },

  get(accessToken: string, organizationId: string, campaignId: string, candidateId: string) {
    return apiClient.request<{ readonly candidate: CandidateSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/candidates/${candidateId}`,
      { accessToken },
    );
  },

  create(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    input: CandidateDetailsRequest,
  ) {
    return apiClient.request<{ readonly candidate: CandidateSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/candidates`,
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
    candidateId: string,
    input: CandidateDetailsRequest & CandidateMutationRequest,
  ) {
    return apiClient.request<{ readonly candidate: CandidateSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/candidates/${candidateId}`,
      {
        method: 'PATCH',
        accessToken,
        body: input,
      },
    );
  },

  transition(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    candidateId: string,
    action: 'eligible' | 'suspend' | 'reactivate' | 'withdraw' | 'disqualify' | 'archive',
    input: CandidateMutationRequest | CandidateReasonRequest,
  ) {
    return apiClient.request<{ readonly candidate: CandidateSummary }>(
      `/organizations/${organizationId}/campaigns/${campaignId}/candidates/${candidateId}/${action}`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },

  reorder(
    accessToken: string,
    organizationId: string,
    campaignId: string,
    candidateIds: readonly string[],
  ) {
    return apiClient.request<{
      readonly candidates: readonly CandidateSummary[];
      readonly nextCursor: string | null;
    }>(`/organizations/${organizationId}/campaigns/${campaignId}/candidates/reorder`, {
      method: 'POST',
      accessToken,
      body: { candidateIds },
    });
  },
};

function query(filters: CandidateListFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}
