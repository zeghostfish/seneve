import { OrganizationAuditEventRecorder } from '@seneve/audit-application';
import type { PermissionId } from '@seneve/authorization-application';
import {
  IdentityRef,
  InvitationId,
  MembershipId,
  type OrganizationDomainEvent,
  Organization,
  OrganizationId,
  OrganizationProfile,
  type OrganizationRole,
  type PersistedOrganizationReadModel,
} from '@seneve/domain-organization';
import {
  authenticatedTenantContext,
  organizationTenantContext,
  type TenantContext,
} from '@seneve/tenant-context';

import { OrganizationApplicationError } from './application-error.js';
import type {
  InvitationCommandResult,
  OrganizationApplicationDependencies,
  OrganizationCommandResult,
} from './contracts.js';

export interface CreateOrganizationCommand {
  readonly actorIdentityId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly correlationId: string;
}

export interface OrganizationProfileCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly displayName: string;
  readonly slug: string;
  readonly defaultLocale: string;
  readonly timezone: string;
  readonly correlationId: string;
}

export interface OrganizationLifecycleCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly expectedVersion: number;
  readonly correlationId: string;
}

export interface MembershipRoleCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly role: OrganizationRole;
  readonly correlationId: string;
}

export interface MembershipMutationCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly correlationId: string;
}

export interface CreateInvitationCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly recipientEmail: string;
  readonly intendedRole: OrganizationRole;
  readonly correlationId: string;
}

export interface InvitationMutationCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly invitationId: string;
  readonly correlationId: string;
}

export interface AcceptInvitationCommand {
  readonly actorIdentityId: string;
  readonly tokenId: string;
  readonly rawInvitationToken: string;
  readonly recipientEmail: string;
  readonly correlationId: string;
}

export interface OwnershipTransferCommand {
  readonly actorIdentityId: string;
  readonly organizationId: string;
  readonly currentOwnerMembershipId: string;
  readonly targetMembershipId: string;
  readonly previousOwnerRole: Exclude<OrganizationRole, 'OWNER'>;
  readonly correlationId: string;
}

export class OrganizationApplicationService {
  constructor(private readonly deps: OrganizationApplicationDependencies) {}

  async createOrganization(command: CreateOrganizationCommand): Promise<OrganizationCommandResult> {
    const actor = await this.requireActor(command.actorIdentityId);
    const baseContext = authenticatedTenantContext({
      identityId: command.actorIdentityId,
      correlationId: command.correlationId,
      executionSource: 'HTTP_REQUEST',
    });
    const decision = this.deps.permissions.evaluate({
      actor: {
        identityId: actor.id,
        identityStatus: actor.status,
        emailVerified: Boolean(actor.primaryEmail.verifiedAt),
      },
      tenant: baseContext,
      permission: 'organization:create',
    });

    assertAllowed(decision.allowed);

    const now = this.deps.clock.now();
    const organizationId = this.deps.ids.uuid();
    const ownerMembershipId = this.deps.ids.uuid();
    const aggregate = Organization.create({
      id: OrganizationId.from(organizationId),
      publicId: null,
      profile: OrganizationProfile.create({
        displayName: command.displayName,
        slug: command.slug,
        defaultLocale: command.defaultLocale,
        timezone: command.timezone,
      }),
      ownerMembershipId: MembershipId.from(ownerMembershipId),
      ownerIdentityId: IdentityRef.from(command.actorIdentityId),
      createdAt: now,
      metadata: metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
    });
    const snapshot = aggregate.toSnapshot();

    await this.deps.executionContext.run(baseContext, async () => {
      await this.deps.unitOfWork.transaction(
        async (repositories) => {
          await repositories.organizations.createOrganization({
            organizationId: snapshot.id,
            publicId: snapshot.publicId,
            displayName: snapshot.profile.displayName,
            slug: snapshot.profile.slug,
            status: snapshot.status,
            defaultLocale: snapshot.profile.defaultLocale,
            timezone: snapshot.profile.timezone,
            createdAt: snapshot.createdAt,
            ownerMembership: {
              membershipId: ownerMembershipId,
              identityId: command.actorIdentityId,
              role: 'OWNER',
              createdAt: now,
              lastChangedBy: command.actorIdentityId,
            },
          });
          await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
        },
        { operation: 'ORGANIZATION_BOOTSTRAP', tenantId: organizationId },
      );
    });

    return {
      organization: await this.requireOrganization(organizationId),
    };
  }

  async listOrganizations(identityId: string): Promise<readonly PersistedOrganizationReadModel[]> {
    return this.deps.organizations.listOrganizationsForIdentity(identityId);
  }

  async getOrganization(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly correlationId: string;
  }): Promise<OrganizationCommandResult> {
    const organization = await this.requireOrganization(input.organizationId);
    await this.authorize(
      input.actorIdentityId,
      organization,
      'organization:read',
      input.correlationId,
    );
    return { organization };
  }

  async updateProfile(command: OrganizationProfileCommand): Promise<OrganizationCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'organization:update',
      command.correlationId,
    );
    const aggregate = Organization.rehydrate(toSnapshot(organization)).updateProfile(
      OrganizationProfile.create({
        displayName: command.displayName,
        slug: command.slug,
        defaultLocale: command.defaultLocale,
        timezone: command.timezone,
      }),
      metadata(
        command.correlationId,
        command.actorIdentityId,
        this.deps.ids.uuid(),
        this.deps.clock.now(),
      ),
    );
    const snapshot = aggregate.toSnapshot();

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.organizations.updateOrganizationProfile({
          organizationId: organization.id,
          expectedVersion: command.expectedVersion,
          displayName: snapshot.profile.displayName,
          slug: snapshot.profile.slug,
          defaultLocale: snapshot.profile.defaultLocale,
          timezone: snapshot.profile.timezone,
          changedAt: this.deps.clock.now(),
        });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    return { organization: await this.requireOrganization(organization.id) };
  }

  async transition(
    command: OrganizationLifecycleCommand,
    target: 'activate' | 'suspend' | 'reactivate' | 'close' | 'archive',
  ): Promise<OrganizationCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const permission: PermissionId =
      target === 'suspend'
        ? 'organization:suspend'
        : target === 'archive'
          ? 'organization:archive'
          : target === 'close'
            ? 'organization:close'
            : 'organization:update';
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      permission,
      command.correlationId,
    );
    const now = this.deps.clock.now();
    const aggregate = Organization.rehydrate(toSnapshot(organization));
    const next =
      target === 'activate'
        ? aggregate.activate(
            now,
            metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
          )
        : target === 'suspend'
          ? aggregate.suspend(
              now,
              metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
            )
          : target === 'reactivate'
            ? aggregate.reactivate(
                now,
                metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
              )
            : target === 'close'
              ? aggregate.close(
                  now,
                  metadata(
                    command.correlationId,
                    command.actorIdentityId,
                    this.deps.ids.uuid(),
                    now,
                  ),
                )
              : aggregate.archive(
                  now,
                  metadata(
                    command.correlationId,
                    command.actorIdentityId,
                    this.deps.ids.uuid(),
                    now,
                  ),
                );

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.organizations.updateOrganizationStatus({
          organizationId: organization.id,
          expectedVersion: command.expectedVersion,
          status: next.toSnapshot().status,
          changedAt: now,
        });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, next.pullDomainEvents());
      });
    });

    return { organization: await this.requireOrganization(organization.id) };
  }

  async listMemberships(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly correlationId: string;
  }) {
    const { organization } = await this.getOrganization(input);
    await this.authorize(
      input.actorIdentityId,
      organization,
      'membership:read',
      input.correlationId,
    );
    return organization.memberships;
  }

  async listInvitations(input: {
    readonly actorIdentityId: string;
    readonly organizationId: string;
    readonly correlationId: string;
  }) {
    const organization = await this.requireOrganization(input.organizationId);
    await this.authorize(
      input.actorIdentityId,
      organization,
      'invitation:read',
      input.correlationId,
    );
    return organization.invitations;
  }

  async updateMembershipRole(command: MembershipRoleCommand): Promise<void> {
    await this.mutateMembership(command, 'membership:update', (aggregate, now) =>
      aggregate.changeMembershipRole({
        membershipId: MembershipId.from(command.membershipId),
        role: command.role,
        changedAt: now,
        actorId: IdentityRef.from(command.actorIdentityId),
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async suspendMembership(command: MembershipMutationCommand): Promise<void> {
    await this.mutateMembership(command, 'membership:suspend', (aggregate, now) =>
      aggregate.suspendMembership({
        membershipId: MembershipId.from(command.membershipId),
        suspendedAt: now,
        actorId: IdentityRef.from(command.actorIdentityId),
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async removeMembership(command: MembershipMutationCommand): Promise<void> {
    await this.mutateMembership(command, 'membership:remove', (aggregate, now) =>
      aggregate.removeMembership({
        membershipId: MembershipId.from(command.membershipId),
        removedAt: now,
        actorId: IdentityRef.from(command.actorIdentityId),
        metadata: metadata(
          command.correlationId,
          command.actorIdentityId,
          this.deps.ids.uuid(),
          now,
        ),
      }),
    );
  }

  async createInvitation(command: CreateInvitationCommand): Promise<InvitationCommandResult> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'invitation:create',
      command.correlationId,
    );
    const now = this.deps.clock.now();
    const token = this.deps.invitationTokens.opaqueToken();
    const tokenHash = await this.deps.tokenHasher.hash(token.rawToken);
    const invitationId = this.deps.ids.uuid();
    const expiresAt = new Date(now.getTime() + this.deps.invitationTtlSeconds * 1000);
    const aggregate = Organization.rehydrate(toSnapshot(organization)).createInvitation({
      invitationId: InvitationId.from(invitationId),
      recipientEmail: command.recipientEmail,
      intendedRole: command.intendedRole,
      tokenId: token.tokenId,
      invitedBy: IdentityRef.from(command.actorIdentityId),
      createdAt: now,
      expiresAt,
      metadata: metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
    });

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        await repositories.invitations.createInvitation({
          invitationId,
          organizationId: organization.id,
          normalizedRecipientEmail: command.recipientEmail.trim().toLowerCase(),
          intendedRole: command.intendedRole,
          tokenId: token.tokenId,
          tokenHash,
          invitedBy: command.actorIdentityId,
          createdAt: now,
          expiresAt,
        });
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });

    const created = (await this.requireOrganization(organization.id)).invitations.find(
      (invitation) => invitation.id === invitationId,
    );

    if (!created) {
      throw new OrganizationApplicationError(
        'ORGANIZATION_TRANSACTION_FAILED',
        'Invitation missing.',
      );
    }

    return {
      invitation: created,
      notification: {
        recipientEmail: command.recipientEmail,
        template: 'organization.invitation',
        organizationId: organization.id,
        invitationId,
        rawInvitationToken: token.rawToken,
        invitationTokenId: token.tokenId,
        expiresAt,
        correlationId: command.correlationId,
      },
    };
  }

  async revokeInvitation(command: InvitationMutationCommand): Promise<void> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'invitation:revoke',
      command.correlationId,
    );
    const now = this.deps.clock.now();
    const aggregate = Organization.rehydrate(toSnapshot(organization)).revokeInvitation({
      invitationId: InvitationId.from(command.invitationId),
      revokedAt: now,
      metadata: metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
    });

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.invitations.revokeInvitation({
          invitationId: command.invitationId,
          expectedOrganizationId: organization.id,
          changedAt: now,
        });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });
  }

  async acceptInvitation(command: AcceptInvitationCommand): Promise<OrganizationCommandResult> {
    const tokenHash = await this.deps.tokenHasher.hash(command.rawInvitationToken);
    const invitation = await this.deps.unitOfWork.transaction((repositories) =>
      repositories.invitations.findInvitationByToken({
        tokenId: command.tokenId,
        tokenHash,
      }),
    );

    if (!invitation) {
      throw new OrganizationApplicationError('INVITATION_TOKEN_INVALID', 'Invitation is invalid.');
    }

    const organization = await this.requireOrganization(invitation.organizationId);
    const now = this.deps.clock.now();
    const membershipId = this.deps.ids.uuid();
    const aggregate = Organization.rehydrate(toSnapshot(organization)).acceptInvitation({
      invitationId: InvitationId.from(invitation.id),
      acceptingIdentityId: IdentityRef.from(command.actorIdentityId),
      recipientEmail: command.recipientEmail,
      membershipId: MembershipId.from(membershipId),
      acceptedAt: now,
      metadata: metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
    });
    const context = authenticatedTenantContext({
      identityId: command.actorIdentityId,
      correlationId: command.correlationId,
      executionSource: 'HTTP_REQUEST',
    });

    await this.deps.executionContext.run(context, async () => {
      await this.deps.unitOfWork.transaction(
        async (repositories) => {
          const result = await repositories.invitations.acceptInvitationWithMembership({
            invitationId: invitation.id,
            expectedOrganizationId: invitation.organizationId,
            changedAt: now,
            acceptingIdentityId: command.actorIdentityId,
            recipientEmail: command.recipientEmail,
            membershipId,
          });
          assertMutation(result.outcome);
          await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
        },
        { operation: 'INVITATION_ACCEPTANCE', tenantId: invitation.organizationId },
      );
    });

    return { organization: await this.requireOrganization(invitation.organizationId) };
  }

  async transferOwnership(command: OwnershipTransferCommand): Promise<void> {
    const organization = await this.requireOrganization(command.organizationId);
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      'ownership:transfer',
      command.correlationId,
    );
    const now = this.deps.clock.now();
    const aggregate = Organization.rehydrate(toSnapshot(organization)).transferOwnership({
      currentOwnerMembershipId: MembershipId.from(command.currentOwnerMembershipId),
      targetMembershipId: MembershipId.from(command.targetMembershipId),
      previousOwnerRole: command.previousOwnerRole,
      transferredAt: now,
      actorId: IdentityRef.from(command.actorIdentityId),
      metadata: metadata(command.correlationId, command.actorIdentityId, this.deps.ids.uuid(), now),
    });

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result = await repositories.memberships.transferOwnership({
          organizationId: organization.id,
          currentOwnerMembershipId: command.currentOwnerMembershipId,
          targetMembershipId: command.targetMembershipId,
          previousOwnerRole: command.previousOwnerRole,
          transferredAt: now,
          actorId: command.actorIdentityId,
        });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });
  }

  private async mutateMembership(
    command: MembershipMutationCommand | MembershipRoleCommand,
    permission: PermissionId,
    mutate: (aggregate: Organization, now: Date) => Organization,
  ): Promise<void> {
    const organization = await this.requireOrganization(command.organizationId);
    const targetMembership = organization.memberships.find(
      (membership) => membership.id === command.membershipId,
    );
    const context = await this.authorize(
      command.actorIdentityId,
      organization,
      permission,
      command.correlationId,
      targetMembership ?? null,
    );
    const now = this.deps.clock.now();
    const aggregate = mutate(Organization.rehydrate(toSnapshot(organization)), now);

    await this.withTenantContext(context, async () => {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const result =
          permission === 'membership:update'
            ? await repositories.memberships.changeMembershipRole({
                membershipId: command.membershipId,
                expectedOrganizationId: organization.id,
                changedAt: now,
                actorId: command.actorIdentityId,
                role: (command as MembershipRoleCommand).role,
              })
            : permission === 'membership:suspend'
              ? await repositories.memberships.suspendMembership({
                  membershipId: command.membershipId,
                  expectedOrganizationId: organization.id,
                  changedAt: now,
                  actorId: command.actorIdentityId,
                })
              : await repositories.memberships.removeMembership({
                  membershipId: command.membershipId,
                  expectedOrganizationId: organization.id,
                  changedAt: now,
                  actorId: command.actorIdentityId,
                });
        assertMutation(result.outcome);
        await recordEvents(this.deps.auditEvents, aggregate.pullDomainEvents());
      });
    });
  }

  private async authorize(
    actorIdentityId: string,
    organization: PersistedOrganizationReadModel,
    permission: PermissionId,
    correlationId: string,
    targetMembership = organization.memberships.find(
      (membership) => membership.identityId === actorIdentityId,
    ) ?? null,
  ): Promise<TenantContext> {
    const actor = await this.requireActor(actorIdentityId);
    const actorMembership =
      organization.memberships.find(
        (membership) => membership.identityId === actorIdentityId && membership.status === 'ACTIVE',
      ) ?? null;

    if (!actorMembership) {
      throw new OrganizationApplicationError('PERMISSION_DENIED', 'Permission denied.');
    }

    const context = organizationTenantContext({
      tenantId: organization.id,
      identityId: actorIdentityId,
      membershipId: actorMembership.id,
      role: actorMembership.role,
      correlationId,
      executionSource: 'HTTP_REQUEST',
    });
    const activeOwnerCount = organization.memberships.filter(
      (membership) => membership.role === 'OWNER' && membership.status === 'ACTIVE',
    ).length;
    const decision = this.deps.permissions.evaluate({
      actor: {
        identityId: actor.id,
        identityStatus: actor.status,
        emailVerified: Boolean(actor.primaryEmail.verifiedAt),
      },
      tenant: context,
      permission,
      organization: {
        id: organization.id,
        status: organization.status,
      },
      membership: {
        organizationId: organization.id,
        identityId: actorMembership.identityId,
        role: actorMembership.role,
        status: actorMembership.status,
      },
      resource: {
        organizationId: organization.id,
        targetMembership: targetMembership
          ? {
              organizationId: organization.id,
              identityId: targetMembership.identityId,
              role: targetMembership.role,
              status: targetMembership.status,
            }
          : null,
        isLastOwnerTarget:
          targetMembership?.role === 'OWNER' &&
          targetMembership.status === 'ACTIVE' &&
          activeOwnerCount === 1,
      },
    });

    assertAllowed(decision.allowed);
    return context;
  }

  private async withTenantContext<T>(context: TenantContext, work: () => Promise<T>): Promise<T> {
    return this.deps.executionContext.run(context, work);
  }

  private async requireActor(identityId: string) {
    const actor = await this.deps.identities.findById(identityId);

    if (!actor) {
      throw new OrganizationApplicationError('PERMISSION_DENIED', 'Permission denied.');
    }

    return actor;
  }

  private async requireOrganization(
    organizationId: string,
  ): Promise<PersistedOrganizationReadModel> {
    const organization = await this.deps.organizations.findOrganizationById(organizationId);

    if (!organization) {
      throw new OrganizationApplicationError('ORGANIZATION_NOT_FOUND', 'Organization not found.');
    }

    return organization;
  }
}

function metadata(correlationId: string, actorId: string, eventId: string, occurredAt: Date) {
  return {
    eventId,
    correlationId,
    actorId,
    occurredAt,
  };
}

function assertAllowed(allowed: boolean): void {
  if (!allowed) {
    throw new OrganizationApplicationError('PERMISSION_DENIED', 'Permission denied.');
  }
}

function assertMutation(outcome: 'UPDATED' | 'NOT_FOUND' | 'CONFLICT'): void {
  if (outcome === 'UPDATED') {
    return;
  }

  if (outcome === 'NOT_FOUND') {
    throw new OrganizationApplicationError('ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  throw new OrganizationApplicationError(
    'ORGANIZATION_VERSION_CONFLICT',
    'Organization mutation conflicted.',
  );
}

async function recordEvents(
  recorder: OrganizationAuditEventRecorder,
  events: readonly OrganizationDomainEvent[],
): Promise<void> {
  for (const event of events) {
    await recorder.record(event);
  }
}

function toSnapshot(organization: PersistedOrganizationReadModel) {
  return {
    id: organization.id,
    publicId: organization.publicId,
    status: organization.status,
    profile: {
      displayName: organization.displayName,
      slug: organization.slug,
      defaultLocale: organization.defaultLocale,
      timezone: organization.timezone,
    },
    createdAt: organization.createdAt,
    activatedAt: organization.activatedAt,
    suspendedAt: organization.suspendedAt,
    closedAt: organization.closedAt,
    archivedAt: organization.archivedAt,
    memberships: organization.memberships,
    invitations: organization.invitations,
  };
}
