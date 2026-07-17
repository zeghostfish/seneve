import type {
  PersistedOrganizationInvitationReadModel,
  PersistedOrganizationMembershipReadModel,
  PersistedOrganizationReadModel,
} from '@seneve/domain-organization';

export function organizationResponse(organization: PersistedOrganizationReadModel) {
  return {
    id: organization.id,
    publicId: organization.publicId,
    displayName: organization.displayName,
    slug: organization.slug,
    status: organization.status,
    defaultLocale: organization.defaultLocale,
    timezone: organization.timezone,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    version: organization.version,
  };
}

export function membershipResponse(membership: PersistedOrganizationMembershipReadModel) {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    identityId: membership.identityId,
    role: membership.role,
    status: membership.status,
    activatedAt: membership.activatedAt.toISOString(),
    suspendedAt: membership.suspendedAt?.toISOString() ?? null,
    createdAt: membership.createdAt.toISOString(),
  };
}

export function invitationResponse(invitation: PersistedOrganizationInvitationReadModel) {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    normalizedRecipientEmail: invitation.normalizedRecipientEmail,
    intendedRole: invitation.intendedRole,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}
