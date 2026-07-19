import { apiClient } from './client';
import type { InvitationSummary, MembershipSummary, OrganizationSummary } from './types';

export interface CreateOrganizationRequest {
  readonly displayName: string;
  readonly slug: string;
  readonly defaultLocale: string;
  readonly timezone: string;
}

export interface InviteMemberRequest {
  readonly email: string;
  readonly role: string;
}

export interface TransferOwnershipRequest {
  readonly targetMembershipId: string;
  readonly previousOwnerRole?: string;
}

export const organizationApi = {
  create(accessToken: string, input: CreateOrganizationRequest) {
    return apiClient.request<{ organization: OrganizationSummary }>('/organizations', {
      method: 'POST',
      accessToken,
      body: input,
    });
  },

  list(accessToken: string) {
    return apiClient.request<{ organizations: readonly OrganizationSummary[] }>('/organizations', {
      accessToken,
    });
  },

  get(accessToken: string, organizationId: string) {
    return apiClient.request<{ organization: OrganizationSummary }>(
      `/organizations/${organizationId}`,
      { accessToken },
    );
  },

  listMemberships(accessToken: string, organizationId: string) {
    return apiClient.request<{ memberships: readonly MembershipSummary[] }>(
      `/organizations/${organizationId}/memberships`,
      { accessToken },
    );
  },

  updateMembershipRole(
    accessToken: string,
    organizationId: string,
    membershipId: string,
    role: string,
  ) {
    return apiClient.request<{ accepted: boolean }>(
      `/organizations/${organizationId}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        accessToken,
        body: { role },
      },
    );
  },

  suspendMembership(accessToken: string, organizationId: string, membershipId: string) {
    return apiClient.request<{ accepted: boolean }>(
      `/organizations/${organizationId}/memberships/${membershipId}/suspend`,
      {
        method: 'POST',
        accessToken,
      },
    );
  },

  removeMembership(accessToken: string, organizationId: string, membershipId: string) {
    return apiClient.request<void>(`/organizations/${organizationId}/memberships/${membershipId}`, {
      method: 'DELETE',
      accessToken,
    });
  },

  listInvitations(accessToken: string, organizationId: string) {
    return apiClient.request<{ invitations: readonly InvitationSummary[] }>(
      `/organizations/${organizationId}/invitations`,
      { accessToken },
    );
  },

  invite(accessToken: string, organizationId: string, input: InviteMemberRequest) {
    return apiClient.request<{ invitation: InvitationSummary }>(
      `/organizations/${organizationId}/invitations`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },

  revokeInvitation(accessToken: string, organizationId: string, invitationId: string) {
    return apiClient.request<{ accepted: boolean }>(
      `/organizations/${organizationId}/invitations/${invitationId}/revoke`,
      {
        method: 'POST',
        accessToken,
      },
    );
  },

  acceptInvitation(
    accessToken: string,
    input: { readonly tokenId: string; readonly token: string; readonly recipientEmail: string },
  ) {
    return apiClient.request<{ organization: OrganizationSummary }>('/invitations/accept', {
      method: 'POST',
      accessToken,
      body: input,
    });
  },

  transferOwnership(accessToken: string, organizationId: string, input: TransferOwnershipRequest) {
    return apiClient.request<{ accepted: boolean }>(
      `/organizations/${organizationId}/ownership-transfer`,
      {
        method: 'POST',
        accessToken,
        body: input,
      },
    );
  },
};
