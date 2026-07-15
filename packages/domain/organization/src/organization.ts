import { OrganizationDomainError } from './domain-error.js';
import {
  type OrganizationDomainEvent,
  type OrganizationEventMetadata,
  createOrganizationEvent,
} from './domain-event.js';
import {
  IdentityRef,
  InvitationId,
  type InvitationStatus,
  MembershipId,
  type MembershipStatus,
  NormalizedEmail,
  OrganizationId,
  OrganizationProfile,
  type OrganizationProfileSnapshot,
  type OrganizationRole,
  type OrganizationStatus,
  assertValidRole,
} from './value-objects.js';

export interface MembershipSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly identityId: string;
  readonly role: OrganizationRole;
  readonly status: MembershipStatus;
  readonly invitationId: string | null;
  readonly createdAt: Date;
  readonly activatedAt: Date;
  readonly suspendedAt: Date | null;
  readonly removedAt: Date | null;
  readonly lastChangedBy: string;
}

export interface InvitationSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly normalizedRecipientEmail: string;
  readonly intendedRole: OrganizationRole;
  readonly status: InvitationStatus;
  readonly tokenId: string;
  readonly invitedBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly acceptedAt: Date | null;
}

export interface OrganizationSnapshot {
  readonly id: string;
  readonly publicId: string | null;
  readonly status: OrganizationStatus;
  readonly profile: OrganizationProfileSnapshot;
  readonly createdAt: Date;
  readonly activatedAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly closedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly memberships: readonly MembershipSnapshot[];
  readonly invitations: readonly InvitationSnapshot[];
}

export class Membership {
  private constructor(private readonly snapshot: MembershipSnapshot) {}

  static create(input: {
    readonly id: MembershipId;
    readonly organizationId: OrganizationId;
    readonly identityId: IdentityRef;
    readonly role: OrganizationRole;
    readonly invitationId?: InvitationId | null;
    readonly createdAt: Date;
    readonly actorId: IdentityRef;
  }): Membership {
    assertValidRole(input.role, 'MEMBERSHIP_ROLE_INVALID');
    return new Membership({
      id: input.id.value,
      organizationId: input.organizationId.value,
      identityId: input.identityId.value,
      role: input.role,
      status: 'ACTIVE',
      invitationId: input.invitationId?.value ?? null,
      createdAt: input.createdAt,
      activatedAt: input.createdAt,
      suspendedAt: null,
      removedAt: null,
      lastChangedBy: input.actorId.value,
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get identityId(): string {
    return this.snapshot.identityId;
  }

  get role(): OrganizationRole {
    return this.snapshot.role;
  }

  get status(): MembershipStatus {
    return this.snapshot.status;
  }

  changeRole(role: OrganizationRole, changedAt: Date, actorId: IdentityRef): Membership {
    assertValidRole(role, 'MEMBERSHIP_ROLE_INVALID');
    this.assertActive();

    return new Membership({
      ...this.snapshot,
      role,
      lastChangedBy: actorId.value,
      activatedAt: this.snapshot.activatedAt,
      suspendedAt: null,
      removedAt: null,
    });
  }

  suspend(suspendedAt: Date, actorId: IdentityRef): Membership {
    this.assertActive();
    return new Membership({
      ...this.snapshot,
      status: 'SUSPENDED',
      suspendedAt,
      lastChangedBy: actorId.value,
    });
  }

  remove(removedAt: Date, actorId: IdentityRef): Membership {
    if (this.snapshot.status === 'REMOVED') {
      throw new OrganizationDomainError(
        'MEMBERSHIP_INVALID_STATE',
        'Membership is already removed.',
      );
    }

    return new Membership({
      ...this.snapshot,
      status: 'REMOVED',
      removedAt,
      lastChangedBy: actorId.value,
    });
  }

  toSnapshot(): MembershipSnapshot {
    return { ...this.snapshot };
  }

  private assertActive(): void {
    if (this.snapshot.status !== 'ACTIVE') {
      throw new OrganizationDomainError('MEMBERSHIP_INVALID_STATE', 'Membership must be active.');
    }
  }
}

export class Invitation {
  private constructor(private readonly snapshot: InvitationSnapshot) {}

  static create(input: {
    readonly id: InvitationId;
    readonly organizationId: OrganizationId;
    readonly recipientEmail: string;
    readonly intendedRole: OrganizationRole;
    readonly tokenId: string;
    readonly invitedBy: IdentityRef;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Invitation {
    assertValidRole(input.intendedRole, 'INVITATION_ROLE_INVALID');

    if (input.expiresAt <= input.createdAt) {
      throw new OrganizationDomainError(
        'INVITATION_EXPIRED',
        'Invitation expiry must be after creation.',
      );
    }

    return new Invitation({
      id: input.id.value,
      organizationId: input.organizationId.value,
      normalizedRecipientEmail: NormalizedEmail.from(input.recipientEmail).value,
      intendedRole: input.intendedRole,
      status: 'PENDING',
      tokenId: input.tokenId,
      invitedBy: input.invitedBy.value,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      revokedAt: null,
      acceptedAt: null,
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get normalizedRecipientEmail(): string {
    return this.snapshot.normalizedRecipientEmail;
  }

  get intendedRole(): OrganizationRole {
    return this.snapshot.intendedRole;
  }

  get status(): InvitationStatus {
    return this.snapshot.status;
  }

  assertCanAccept(recipientEmail: string, acceptedAt: Date): void {
    if (this.snapshot.status === 'ACCEPTED') {
      throw new OrganizationDomainError(
        'INVITATION_ALREADY_ACCEPTED',
        'Invitation has already been accepted.',
      );
    }

    if (this.snapshot.status === 'REVOKED') {
      throw new OrganizationDomainError('INVITATION_REVOKED', 'Invitation has been revoked.');
    }

    if (this.snapshot.status === 'EXPIRED' || this.snapshot.expiresAt <= acceptedAt) {
      throw new OrganizationDomainError('INVITATION_EXPIRED', 'Invitation has expired.');
    }

    if (this.snapshot.normalizedRecipientEmail !== NormalizedEmail.from(recipientEmail).value) {
      throw new OrganizationDomainError(
        'INVITATION_RECIPIENT_MISMATCH',
        'Invitation recipient does not match.',
      );
    }
  }

  revoke(revokedAt: Date): Invitation {
    if (this.snapshot.status === 'ACCEPTED') {
      throw new OrganizationDomainError(
        'INVITATION_ALREADY_ACCEPTED',
        'Accepted invitation cannot be revoked.',
      );
    }

    if (this.snapshot.status === 'REVOKED') {
      return this;
    }

    return new Invitation({
      ...this.snapshot,
      status: 'REVOKED',
      revokedAt,
    });
  }

  expire(expiredAt: Date): Invitation {
    if (this.snapshot.status !== 'PENDING') {
      return this;
    }

    if (this.snapshot.expiresAt > expiredAt) {
      return this;
    }

    return new Invitation({
      ...this.snapshot,
      status: 'EXPIRED',
    });
  }

  accept(acceptedAt: Date): Invitation {
    return new Invitation({
      ...this.snapshot,
      status: 'ACCEPTED',
      acceptedAt,
    });
  }

  toSnapshot(): InvitationSnapshot {
    return { ...this.snapshot };
  }
}

export class Organization {
  private readonly events: OrganizationDomainEvent[];

  private constructor(
    private readonly id: OrganizationId,
    private readonly publicId: string | null,
    private readonly profile: OrganizationProfile,
    private readonly status: OrganizationStatus,
    private readonly createdAt: Date,
    private readonly activatedAt: Date | null,
    private readonly suspendedAt: Date | null,
    private readonly closedAt: Date | null,
    private readonly archivedAt: Date | null,
    private readonly memberships: readonly Membership[],
    private readonly invitations: readonly Invitation[],
    events: readonly OrganizationDomainEvent[] = [],
  ) {
    this.events = [...events];
  }

  static create(input: {
    readonly id: OrganizationId;
    readonly publicId?: string | null;
    readonly profile: OrganizationProfile;
    readonly ownerMembershipId: MembershipId;
    readonly ownerIdentityId: IdentityRef;
    readonly createdAt: Date;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    const owner = Membership.create({
      id: input.ownerMembershipId,
      organizationId: input.id,
      identityId: input.ownerIdentityId,
      role: 'OWNER',
      createdAt: input.createdAt,
      actorId: input.ownerIdentityId,
    });
    const organization = new Organization(
      input.id,
      input.publicId ?? null,
      input.profile,
      'DRAFT',
      input.createdAt,
      null,
      null,
      null,
      null,
      [owner],
      [],
    );

    organization.record('OrganizationCreated', input.metadata, {
      status: 'DRAFT',
      slug: input.profile.slug.value,
    });
    organization.record('MembershipCreated', input.metadata, {
      membershipId: owner.id,
      identityId: owner.identityId,
      role: owner.role,
    });

    return organization;
  }

  activate(activatedAt: Date, metadata: OrganizationEventMetadata): Organization {
    if (this.status === 'ACTIVE') {
      throw new OrganizationDomainError(
        'ORGANIZATION_ALREADY_ACTIVE',
        'Organization is already active.',
      );
    }

    this.assertStatus(
      'DRAFT',
      'ORGANIZATION_INVALID_STATE',
      'Only draft organizations can be activated.',
    );
    this.assertHasActiveOwner();

    const next = this.copy({ status: 'ACTIVE', activatedAt });
    next.record('OrganizationActivated', metadata, { status: 'ACTIVE' });
    return next;
  }

  suspend(suspendedAt: Date, metadata: OrganizationEventMetadata): Organization {
    this.assertStatus(
      'ACTIVE',
      'ORGANIZATION_INVALID_STATE',
      'Only active organizations can be suspended.',
    );

    const next = this.copy({ status: 'SUSPENDED', suspendedAt });
    next.record('OrganizationSuspended', metadata, { status: 'SUSPENDED' });
    return next;
  }

  reactivate(reactivatedAt: Date, metadata: OrganizationEventMetadata): Organization {
    this.assertStatus(
      'SUSPENDED',
      'ORGANIZATION_INVALID_STATE',
      'Only suspended organizations can be reactivated.',
    );

    const next = this.copy({ status: 'ACTIVE', suspendedAt: null });
    next.record('OrganizationReactivated', metadata, {
      status: 'ACTIVE',
      reactivatedAt: reactivatedAt.toISOString(),
    });
    return next;
  }

  close(closedAt: Date, metadata: OrganizationEventMetadata): Organization {
    if (this.status !== 'ACTIVE' && this.status !== 'SUSPENDED') {
      throw new OrganizationDomainError(
        'ORGANIZATION_INVALID_STATE',
        'Only active or suspended organizations can be closed.',
      );
    }

    const next = this.copy({ status: 'CLOSED', closedAt });
    next.record('OrganizationClosed', metadata, { status: 'CLOSED' });
    return next;
  }

  archive(archivedAt: Date, metadata: OrganizationEventMetadata): Organization {
    this.assertStatus(
      'CLOSED',
      'ORGANIZATION_INVALID_STATE',
      'Only closed organizations can be archived.',
    );

    const next = this.copy({ status: 'ARCHIVED', archivedAt });
    next.record('OrganizationArchived', metadata, { status: 'ARCHIVED' });
    return next;
  }

  updateProfile(profile: OrganizationProfile, metadata: OrganizationEventMetadata): Organization {
    this.assertMutable();
    const next = this.copy({ profile });
    next.record('OrganizationProfileUpdated', metadata, { slug: profile.slug.value });
    return next;
  }

  addMembership(input: {
    readonly membershipId: MembershipId;
    readonly identityId: IdentityRef;
    readonly role: OrganizationRole;
    readonly createdAt: Date;
    readonly actorId: IdentityRef;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    this.assertNoActiveMembership(input.identityId.value);

    const membership = Membership.create({
      id: input.membershipId,
      organizationId: this.id,
      identityId: input.identityId,
      role: input.role,
      createdAt: input.createdAt,
      actorId: input.actorId,
    });
    const next = this.copy({ memberships: [...this.memberships, membership] });
    next.record('MembershipCreated', input.metadata, {
      membershipId: membership.id,
      identityId: membership.identityId,
      role: membership.role,
    });
    return next;
  }

  changeMembershipRole(input: {
    readonly membershipId: MembershipId;
    readonly role: OrganizationRole;
    readonly changedAt: Date;
    readonly actorId: IdentityRef;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const membership = this.requireMembership(input.membershipId.value);

    if (membership.role === 'OWNER' && input.role !== 'OWNER') {
      this.assertOwnerCanBeChanged(
        membership.id,
        'LAST_OWNER_REQUIRED',
        'Last owner cannot be downgraded.',
      );
    }

    const changed = membership.changeRole(input.role, input.changedAt, input.actorId);
    const next = this.replaceMembership(changed);
    next.record('MembershipRoleChanged', input.metadata, {
      membershipId: changed.id,
      role: changed.role,
    });
    return next;
  }

  suspendMembership(input: {
    readonly membershipId: MembershipId;
    readonly suspendedAt: Date;
    readonly actorId: IdentityRef;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const membership = this.requireMembership(input.membershipId.value);

    if (membership.role === 'OWNER') {
      this.assertOwnerCanBeChanged(
        membership.id,
        'LAST_OWNER_SUSPENSION_FORBIDDEN',
        'Last owner cannot be suspended.',
      );
    }

    const suspended = membership.suspend(input.suspendedAt, input.actorId);
    const next = this.replaceMembership(suspended);
    next.record('MembershipSuspended', input.metadata, { membershipId: suspended.id });
    return next;
  }

  removeMembership(input: {
    readonly membershipId: MembershipId;
    readonly removedAt: Date;
    readonly actorId: IdentityRef;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const membership = this.requireMembership(input.membershipId.value);

    if (membership.role === 'OWNER') {
      this.assertOwnerCanBeChanged(
        membership.id,
        'LAST_OWNER_REMOVAL_FORBIDDEN',
        'Last owner cannot be removed.',
      );
    }

    const removed = membership.remove(input.removedAt, input.actorId);
    const next = this.replaceMembership(removed);
    next.record('MembershipRemoved', input.metadata, { membershipId: removed.id });
    return next;
  }

  transferOwnership(input: {
    readonly currentOwnerMembershipId: MembershipId;
    readonly targetMembershipId: MembershipId;
    readonly previousOwnerRole: Exclude<OrganizationRole, 'OWNER'>;
    readonly transferredAt: Date;
    readonly actorId: IdentityRef;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const currentOwner = this.requireMembership(input.currentOwnerMembershipId.value);
    const target = this.requireMembership(input.targetMembershipId.value);

    if (currentOwner.role !== 'OWNER' || currentOwner.status !== 'ACTIVE') {
      throw new OrganizationDomainError('OWNERSHIP_TRANSFER_INVALID', 'Current owner is invalid.');
    }

    if (target.status !== 'ACTIVE') {
      throw new OrganizationDomainError(
        'OWNERSHIP_TRANSFER_INVALID',
        'Target owner membership is invalid.',
      );
    }

    if (currentOwner.id === target.id) {
      throw new OrganizationDomainError(
        'OWNERSHIP_TRANSFER_INVALID',
        'Ownership target must differ from current owner.',
      );
    }

    assertValidRole(input.previousOwnerRole, 'MEMBERSHIP_ROLE_INVALID');

    const nextTarget = target.changeRole('OWNER', input.transferredAt, input.actorId);
    const nextPrevious = currentOwner.changeRole(
      input.previousOwnerRole,
      input.transferredAt,
      input.actorId,
    );
    const next = this.replaceMemberships([nextTarget, nextPrevious]);
    next.assertHasActiveOwner();
    next.record('OwnershipTransferred', input.metadata, {
      previousOwnerMembershipId: currentOwner.id,
      newOwnerMembershipId: target.id,
      previousOwnerRole: input.previousOwnerRole,
    });
    return next;
  }

  createInvitation(input: {
    readonly invitationId: InvitationId;
    readonly recipientEmail: string;
    readonly intendedRole: OrganizationRole;
    readonly tokenId: string;
    readonly invitedBy: IdentityRef;
    readonly createdAt: Date;
    readonly expiresAt: Date;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const normalizedRecipientEmail = NormalizedEmail.from(input.recipientEmail).value;

    if (
      this.invitations.some(
        (invitation) =>
          invitation.normalizedRecipientEmail === normalizedRecipientEmail &&
          invitation.status === 'PENDING',
      )
    ) {
      throw new OrganizationDomainError(
        'INVITATION_ALREADY_EXISTS',
        'An active invitation already exists.',
      );
    }

    const invitation = Invitation.create({
      id: input.invitationId,
      organizationId: this.id,
      recipientEmail: input.recipientEmail,
      intendedRole: input.intendedRole,
      tokenId: input.tokenId,
      invitedBy: input.invitedBy,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
    });
    const next = this.copy({ invitations: [...this.invitations, invitation] });
    next.record('InvitationCreated', input.metadata, {
      invitationId: invitation.id,
      normalizedRecipientEmail: invitation.normalizedRecipientEmail,
      intendedRole: invitation.intendedRole,
    });
    return next;
  }

  revokeInvitation(input: {
    readonly invitationId: InvitationId;
    readonly revokedAt: Date;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    const invitation = this.requireInvitation(input.invitationId.value);
    const revoked = invitation.revoke(input.revokedAt);
    const next = this.replaceInvitation(revoked);
    next.record('InvitationRevoked', input.metadata, { invitationId: revoked.id });
    return next;
  }

  expireInvitation(input: {
    readonly invitationId: InvitationId;
    readonly expiredAt: Date;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    const invitation = this.requireInvitation(input.invitationId.value);
    const expired = invitation.expire(input.expiredAt);

    if (expired.status !== 'EXPIRED') {
      return this;
    }

    const next = this.replaceInvitation(expired);
    next.record('InvitationExpired', input.metadata, { invitationId: expired.id });
    return next;
  }

  acceptInvitation(input: {
    readonly invitationId: InvitationId;
    readonly acceptingIdentityId: IdentityRef;
    readonly recipientEmail: string;
    readonly membershipId: MembershipId;
    readonly acceptedAt: Date;
    readonly metadata: OrganizationEventMetadata;
  }): Organization {
    this.assertOperational();
    const invitation = this.requireInvitation(input.invitationId.value);
    invitation.assertCanAccept(input.recipientEmail, input.acceptedAt);
    this.assertNoActiveMembership(input.acceptingIdentityId.value);

    const membership = Membership.create({
      id: input.membershipId,
      organizationId: this.id,
      identityId: input.acceptingIdentityId,
      role: invitation.intendedRole,
      invitationId: input.invitationId,
      createdAt: input.acceptedAt,
      actorId: input.acceptingIdentityId,
    });
    const next = this.copy({
      memberships: [...this.memberships, membership],
      invitations: this.invitations.map((existing) =>
        existing.id === invitation.id ? invitation.accept(input.acceptedAt) : existing,
      ),
    });
    next.record('InvitationAccepted', input.metadata, {
      invitationId: invitation.id,
      membershipId: membership.id,
      identityId: membership.identityId,
    });
    next.record('MembershipCreated', input.metadata, {
      membershipId: membership.id,
      identityId: membership.identityId,
      role: membership.role,
      invitationId: invitation.id,
    });
    return next;
  }

  pullDomainEvents(): readonly OrganizationDomainEvent[] {
    return [...this.events];
  }

  toSnapshot(): OrganizationSnapshot {
    return {
      id: this.id.value,
      publicId: this.publicId,
      status: this.status,
      profile: this.profile.toSnapshot(),
      createdAt: this.createdAt,
      activatedAt: this.activatedAt,
      suspendedAt: this.suspendedAt,
      closedAt: this.closedAt,
      archivedAt: this.archivedAt,
      memberships: this.memberships.map((membership) => membership.toSnapshot()),
      invitations: this.invitations.map((invitation) => invitation.toSnapshot()),
    };
  }

  private replaceMembership(membership: Membership): Organization {
    return this.copy({
      memberships: this.memberships.map((existing) =>
        existing.id === membership.id ? membership : existing,
      ),
    });
  }

  private replaceMemberships(memberships: readonly Membership[]): Organization {
    const replacements = new Map(memberships.map((membership) => [membership.id, membership]));
    return this.copy({
      memberships: this.memberships.map((existing) => replacements.get(existing.id) ?? existing),
    });
  }

  private replaceInvitation(invitation: Invitation): Organization {
    return this.copy({
      invitations: this.invitations.map((existing) =>
        existing.id === invitation.id ? invitation : existing,
      ),
    });
  }

  private requireMembership(membershipId: string): Membership {
    const membership = this.memberships.find((candidate) => candidate.id === membershipId);

    if (!membership) {
      throw new OrganizationDomainError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.');
    }

    return membership;
  }

  private requireInvitation(invitationId: string): Invitation {
    const invitation = this.invitations.find((candidate) => candidate.id === invitationId);

    if (!invitation) {
      throw new OrganizationDomainError('INVITATION_NOT_FOUND', 'Invitation was not found.');
    }

    return invitation;
  }

  private assertStatus(
    expected: OrganizationStatus,
    code: 'ORGANIZATION_INVALID_STATE' | 'ORGANIZATION_ALREADY_ACTIVE',
    message: string,
  ): void {
    if (this.status !== expected) {
      throw new OrganizationDomainError(code, message);
    }
  }

  private assertOperational(): void {
    if (this.status === 'DRAFT') {
      throw new OrganizationDomainError(
        'ORGANIZATION_INVALID_STATE',
        'Organization is not active yet.',
      );
    }

    if (this.status === 'SUSPENDED') {
      throw new OrganizationDomainError('ORGANIZATION_SUSPENDED', 'Organization is suspended.');
    }

    this.assertMutable();
  }

  private assertMutable(): void {
    if (this.status === 'CLOSED') {
      throw new OrganizationDomainError('ORGANIZATION_CLOSED', 'Organization is closed.');
    }

    if (this.status === 'ARCHIVED') {
      throw new OrganizationDomainError('ORGANIZATION_ARCHIVED', 'Organization is archived.');
    }
  }

  private assertNoActiveMembership(identityId: string): void {
    if (
      this.memberships.some(
        (membership) => membership.identityId === identityId && membership.status === 'ACTIVE',
      )
    ) {
      throw new OrganizationDomainError(
        'MEMBERSHIP_ALREADY_EXISTS',
        'Active membership already exists.',
      );
    }
  }

  private assertHasActiveOwner(): void {
    if (
      !this.memberships.some(
        (membership) => membership.role === 'OWNER' && membership.status === 'ACTIVE',
      )
    ) {
      throw new OrganizationDomainError(
        'LAST_OWNER_REQUIRED',
        'Organization must retain an active owner.',
      );
    }
  }

  private assertOwnerCanBeChanged(
    membershipId: string,
    code:
      'LAST_OWNER_REQUIRED' | 'LAST_OWNER_REMOVAL_FORBIDDEN' | 'LAST_OWNER_SUSPENSION_FORBIDDEN',
    message: string,
  ): void {
    const activeOwners = this.memberships.filter(
      (membership) => membership.role === 'OWNER' && membership.status === 'ACTIVE',
    );

    if (activeOwners.length === 1 && activeOwners[0]?.id === membershipId) {
      throw new OrganizationDomainError(code, message);
    }
  }

  private record(
    eventType: OrganizationDomainEvent['eventType'],
    metadata: OrganizationEventMetadata,
    payload: Record<string, unknown>,
  ): void {
    this.events.push(
      createOrganizationEvent({
        eventType,
        aggregateId: this.id.value,
        metadata,
        payload,
      }),
    );
  }

  private copy(input: {
    readonly profile?: OrganizationProfile;
    readonly status?: OrganizationStatus;
    readonly activatedAt?: Date | null;
    readonly suspendedAt?: Date | null;
    readonly closedAt?: Date | null;
    readonly archivedAt?: Date | null;
    readonly memberships?: readonly Membership[];
    readonly invitations?: readonly Invitation[];
  }): Organization {
    return new Organization(
      this.id,
      this.publicId,
      input.profile ?? this.profile,
      input.status ?? this.status,
      this.createdAt,
      input.activatedAt === undefined ? this.activatedAt : input.activatedAt,
      input.suspendedAt === undefined ? this.suspendedAt : input.suspendedAt,
      input.closedAt === undefined ? this.closedAt : input.closedAt,
      input.archivedAt === undefined ? this.archivedAt : input.archivedAt,
      input.memberships ?? this.memberships,
      input.invitations ?? this.invitations,
      this.events,
    );
  }
}
