import type {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
} from './value-objects.js';

export interface PersistedOrganizationCreate {
  readonly organizationId: string;
  readonly publicId: string | null;
  readonly displayName: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly createdAt: Date;
  readonly ownerMembership: {
    readonly membershipId: string;
    readonly identityId: string;
    readonly role: 'OWNER';
    readonly createdAt: Date;
    readonly lastChangedBy: string;
  };
}

export interface PersistedOrganizationStatusUpdate {
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly status: OrganizationStatus;
  readonly changedAt: Date;
}

export interface PersistedOrganizationProfileUpdate {
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly displayName: string;
  readonly slug: string;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly changedAt: Date;
}

export interface PersistedOrganizationReadModel {
  readonly id: string;
  readonly publicId: string | null;
  readonly displayName: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly version: number;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly activatedAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly closedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly memberships: readonly PersistedOrganizationMembershipReadModel[];
  readonly invitations: readonly PersistedOrganizationInvitationReadModel[];
}

export interface PersistedOrganizationMembershipReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly identityId: string;
  readonly role: OrganizationRole;
  readonly status: MembershipStatus;
  readonly invitationId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly activatedAt: Date;
  readonly suspendedAt: Date | null;
  readonly removedAt: Date | null;
  readonly lastChangedBy: string;
}

export interface PersistedOrganizationInvitationReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly normalizedRecipientEmail: string;
  readonly intendedRole: OrganizationRole;
  readonly status: InvitationStatus;
  readonly tokenId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly acceptedAt: Date | null;
  readonly invitedBy: string;
}

export interface PersistedMembershipCreate {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly identityId: string;
  readonly role: OrganizationRole;
  readonly invitationId?: string | null;
  readonly createdAt: Date;
  readonly lastChangedBy: string;
}

export interface PersistedMembershipMutation {
  readonly membershipId: string;
  readonly expectedOrganizationId: string;
  readonly changedAt: Date;
  readonly actorId: string;
}

export interface PersistedMembershipRoleChange extends PersistedMembershipMutation {
  readonly role: OrganizationRole;
}

export interface PersistedOwnershipTransfer {
  readonly organizationId: string;
  readonly currentOwnerMembershipId: string;
  readonly targetMembershipId: string;
  readonly previousOwnerRole: Exclude<OrganizationRole, 'OWNER'>;
  readonly transferredAt: Date;
  readonly actorId: string;
}

export interface PersistedInvitationCreate {
  readonly invitationId: string;
  readonly organizationId: string;
  readonly normalizedRecipientEmail: string;
  readonly intendedRole: OrganizationRole;
  readonly tokenId: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface PersistedInvitationMutation {
  readonly invitationId: string;
  readonly expectedOrganizationId: string;
  readonly changedAt: Date;
}

export interface PersistedInvitationAcceptance extends PersistedInvitationMutation {
  readonly acceptingIdentityId: string;
  readonly recipientEmail: string;
  readonly membershipId: string;
}

export type PersistenceMutationResult =
  | { readonly outcome: 'UPDATED' }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'CONFLICT' };

export interface OrganizationRepository {
  createOrganization(input: PersistedOrganizationCreate): Promise<void>;
  findOrganizationById(organizationId: string): Promise<PersistedOrganizationReadModel | null>;
  findOrganizationBySlug(slug: string): Promise<PersistedOrganizationReadModel | null>;
  listOrganizationsForIdentity(
    identityId: string,
  ): Promise<readonly PersistedOrganizationReadModel[]>;
  updateOrganizationProfile(
    input: PersistedOrganizationProfileUpdate,
  ): Promise<PersistenceMutationResult>;
  updateOrganizationStatus(
    input: PersistedOrganizationStatusUpdate,
  ): Promise<PersistenceMutationResult>;
}

export interface OrganizationMembershipRepository {
  createMembership(input: PersistedMembershipCreate): Promise<void>;
  changeMembershipRole(input: PersistedMembershipRoleChange): Promise<PersistenceMutationResult>;
  suspendMembership(input: PersistedMembershipMutation): Promise<PersistenceMutationResult>;
  removeMembership(input: PersistedMembershipMutation): Promise<PersistenceMutationResult>;
  transferOwnership(input: PersistedOwnershipTransfer): Promise<PersistenceMutationResult>;
}

export interface OrganizationInvitationRepository {
  createInvitation(input: PersistedInvitationCreate): Promise<void>;
  findInvitationByToken(input: {
    readonly tokenId: string;
    readonly tokenHash: string;
  }): Promise<PersistedOrganizationInvitationReadModel | null>;
  revokeInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult>;
  expireInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult>;
  acceptInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult>;
  acceptInvitationWithMembership(
    input: PersistedInvitationAcceptance,
  ): Promise<PersistenceMutationResult>;
}

export interface OrganizationPersistenceRepositories {
  readonly organizations: OrganizationRepository;
  readonly memberships: OrganizationMembershipRepository;
  readonly invitations: OrganizationInvitationRepository;
}

export interface OrganizationUnitOfWork {
  transaction<T>(
    work: (repositories: OrganizationPersistenceRepositories) => Promise<T>,
  ): Promise<T>;
}
