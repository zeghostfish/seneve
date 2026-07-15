import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  OrganizationInvitationRepository,
  OrganizationMembershipRepository,
  OrganizationPersistenceRepositories,
  OrganizationRepository,
  PersistedInvitationAcceptance,
  PersistedInvitationCreate,
  PersistedInvitationMutation,
  PersistedMembershipCreate,
  PersistedMembershipMutation,
  PersistedMembershipRoleChange,
  PersistedOrganizationCreate,
  PersistedOrganizationInvitationReadModel,
  PersistedOrganizationMembershipReadModel,
  PersistedOrganizationReadModel,
  PersistedOrganizationStatusUpdate,
  PersistedOwnershipTransfer,
  PersistenceMutationResult,
} from '@seneve/domain-organization';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

type OrganizationWithChildren = Prisma.OrganizationGetPayload<{
  include: {
    memberships: true;
    invitations: true;
  };
}>;

type OrganizationMembershipRecord = Prisma.OrganizationMembershipGetPayload<Record<string, never>>;
type OrganizationInvitationRecord = Prisma.OrganizationInvitationGetPayload<Record<string, never>>;

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createOrganization(input: PersistedOrganizationCreate): Promise<void> {
    await this.prisma.organization.create({
      data: {
        id: input.organizationId,
        publicId: input.publicId,
        displayName: input.displayName,
        slug: input.slug,
        status: input.status,
        defaultLocale: input.defaultLocale,
        timezone: input.timezone,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        activatedAt: input.status === 'ACTIVE' ? input.createdAt : null,
        memberships: {
          create: {
            id: input.ownerMembership.membershipId,
            identityId: input.ownerMembership.identityId,
            role: input.ownerMembership.role,
            status: 'ACTIVE',
            createdAt: input.ownerMembership.createdAt,
            updatedAt: input.ownerMembership.createdAt,
            activatedAt: input.ownerMembership.createdAt,
            lastChangedBy: input.ownerMembership.lastChangedBy,
          },
        },
      },
    });
  }

  async findOrganizationById(
    organizationId: string,
  ): Promise<PersistedOrganizationReadModel | null> {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      include: organizationInclude,
    });

    return organization ? toOrganizationReadModel(organization) : null;
  }

  async findOrganizationBySlug(slug: string): Promise<PersistedOrganizationReadModel | null> {
    const organization = await this.prisma.organization.findUnique({
      where: {
        slug,
      },
      include: organizationInclude,
    });

    return organization ? toOrganizationReadModel(organization) : null;
  }

  async updateOrganizationStatus(
    input: PersistedOrganizationStatusUpdate,
  ): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organization.updateMany({
      where: {
        id: input.organizationId,
        version: input.expectedVersion,
      },
      data: {
        status: input.status,
        updatedAt: input.changedAt,
        activatedAt: input.status === 'ACTIVE' ? input.changedAt : undefined,
        suspendedAt: input.status === 'SUSPENDED' ? input.changedAt : undefined,
        closedAt:
          input.status === 'CLOSED' || input.status === 'ARCHIVED' ? input.changedAt : undefined,
        archivedAt: input.status === 'ARCHIVED' ? input.changedAt : undefined,
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 1) {
      return { outcome: 'UPDATED' };
    }

    return this.exists('organization', input.organizationId);
  }

  private async exists(model: 'organization', id: string): Promise<PersistenceMutationResult> {
    const existing = await this.prisma.organization.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    return existing ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
  }
}

export class PrismaOrganizationMembershipRepository implements OrganizationMembershipRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createMembership(input: PersistedMembershipCreate): Promise<void> {
    await this.prisma.organizationMembership.create({
      data: {
        id: input.membershipId,
        organizationId: input.organizationId,
        identityId: input.identityId,
        role: input.role,
        status: 'ACTIVE',
        invitationId: input.invitationId ?? null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        activatedAt: input.createdAt,
        lastChangedBy: input.lastChangedBy,
      },
    });
  }

  async changeMembershipRole(
    input: PersistedMembershipRoleChange,
  ): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationMembership.updateMany({
      where: {
        id: input.membershipId,
        organizationId: input.expectedOrganizationId,
        status: 'ACTIVE',
      },
      data: {
        role: input.role,
        updatedAt: input.changedAt,
        lastChangedBy: input.actorId,
      },
    });

    return this.mutationResult(input.membershipId, result.count);
  }

  async suspendMembership(input: PersistedMembershipMutation): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationMembership.updateMany({
      where: {
        id: input.membershipId,
        organizationId: input.expectedOrganizationId,
        status: 'ACTIVE',
      },
      data: {
        status: 'SUSPENDED',
        suspendedAt: input.changedAt,
        updatedAt: input.changedAt,
        lastChangedBy: input.actorId,
      },
    });

    return this.mutationResult(input.membershipId, result.count);
  }

  async removeMembership(input: PersistedMembershipMutation): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationMembership.updateMany({
      where: {
        id: input.membershipId,
        organizationId: input.expectedOrganizationId,
        status: {
          not: 'REMOVED',
        },
      },
      data: {
        status: 'REMOVED',
        removedAt: input.changedAt,
        updatedAt: input.changedAt,
        lastChangedBy: input.actorId,
      },
    });

    return this.mutationResult(input.membershipId, result.count);
  }

  async transferOwnership(input: PersistedOwnershipTransfer): Promise<PersistenceMutationResult> {
    return inTransaction(this.prisma, async (tx) => {
      const currentOwner = await tx.organizationMembership.updateMany({
        where: {
          id: input.currentOwnerMembershipId,
          organizationId: input.organizationId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        data: {
          role: input.previousOwnerRole,
          updatedAt: input.transferredAt,
          lastChangedBy: input.actorId,
        },
      });
      const targetOwner = await tx.organizationMembership.updateMany({
        where: {
          id: input.targetMembershipId,
          organizationId: input.organizationId,
          status: 'ACTIVE',
        },
        data: {
          role: 'OWNER',
          updatedAt: input.transferredAt,
          lastChangedBy: input.actorId,
        },
      });

      if (currentOwner.count === 1 && targetOwner.count === 1) {
        return { outcome: 'UPDATED' };
      }

      const existing = await tx.organizationMembership.count({
        where: {
          id: {
            in: [input.currentOwnerMembershipId, input.targetMembershipId],
          },
          organizationId: input.organizationId,
        },
      });

      return existing === 2 ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
    });
  }

  private async mutationResult(
    membershipId: string,
    count: number,
  ): Promise<PersistenceMutationResult> {
    if (count === 1) {
      return { outcome: 'UPDATED' };
    }

    const existing = await this.prisma.organizationMembership.findUnique({
      where: {
        id: membershipId,
      },
      select: {
        id: true,
      },
    });

    return existing ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
  }
}

export class PrismaOrganizationInvitationRepository implements OrganizationInvitationRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createInvitation(input: PersistedInvitationCreate): Promise<void> {
    await this.prisma.organizationInvitation.create({
      data: {
        id: input.invitationId,
        organizationId: input.organizationId,
        normalizedRecipientEmail: input.normalizedRecipientEmail,
        intendedRole: input.intendedRole,
        status: 'PENDING',
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        invitedBy: input.invitedBy,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  async revokeInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationInvitation.updateMany({
      where: {
        id: input.invitationId,
        organizationId: input.expectedOrganizationId,
        status: 'PENDING',
      },
      data: {
        status: 'REVOKED',
        revokedAt: input.changedAt,
        updatedAt: input.changedAt,
      },
    });

    return this.mutationResult(input.invitationId, result.count);
  }

  async expireInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationInvitation.updateMany({
      where: {
        id: input.invitationId,
        organizationId: input.expectedOrganizationId,
        status: 'PENDING',
        expiresAt: {
          lte: input.changedAt,
        },
      },
      data: {
        status: 'EXPIRED',
        updatedAt: input.changedAt,
      },
    });

    return this.mutationResult(input.invitationId, result.count);
  }

  async acceptInvitation(input: PersistedInvitationMutation): Promise<PersistenceMutationResult> {
    const result = await this.prisma.organizationInvitation.updateMany({
      where: {
        id: input.invitationId,
        organizationId: input.expectedOrganizationId,
        status: 'PENDING',
        expiresAt: {
          gt: input.changedAt,
        },
      },
      data: {
        status: 'ACCEPTED',
        acceptedAt: input.changedAt,
        updatedAt: input.changedAt,
      },
    });

    return this.mutationResult(input.invitationId, result.count);
  }

  async acceptInvitationWithMembership(
    input: PersistedInvitationAcceptance,
  ): Promise<PersistenceMutationResult> {
    try {
      return await inTransaction(this.prisma, async (tx) => {
        const invitation = await tx.organizationInvitation.findUnique({
          where: {
            id: input.invitationId,
          },
        });

        if (!invitation || invitation.organizationId !== input.expectedOrganizationId) {
          return { outcome: 'NOT_FOUND' };
        }

        const normalizedRecipientEmail = input.recipientEmail.trim().toLowerCase();

        if (
          invitation.status !== 'PENDING' ||
          invitation.expiresAt <= input.changedAt ||
          invitation.normalizedRecipientEmail !== normalizedRecipientEmail
        ) {
          return { outcome: 'CONFLICT' };
        }

        const accepted = await tx.organizationInvitation.updateMany({
          where: {
            id: input.invitationId,
            organizationId: input.expectedOrganizationId,
            normalizedRecipientEmail,
            status: 'PENDING',
            expiresAt: {
              gt: input.changedAt,
            },
          },
          data: {
            status: 'ACCEPTED',
            acceptedAt: input.changedAt,
            updatedAt: input.changedAt,
          },
        });

        if (accepted.count !== 1) {
          return { outcome: 'CONFLICT' };
        }

        await tx.organizationMembership.create({
          data: {
            id: input.membershipId,
            organizationId: invitation.organizationId,
            identityId: input.acceptingIdentityId,
            role: invitation.intendedRole,
            status: 'ACTIVE',
            invitationId: invitation.id,
            createdAt: input.changedAt,
            updatedAt: input.changedAt,
            activatedAt: input.changedAt,
            lastChangedBy: input.acceptingIdentityId,
          },
        });

        return { outcome: 'UPDATED' };
      });
    } catch (error) {
      if (isUniqueConstraintFailure(error)) {
        return { outcome: 'CONFLICT' };
      }

      throw error;
    }
  }

  private async mutationResult(
    invitationId: string,
    count: number,
  ): Promise<PersistenceMutationResult> {
    if (count === 1) {
      return { outcome: 'UPDATED' };
    }

    const existing = await this.prisma.organizationInvitation.findUnique({
      where: {
        id: invitationId,
      },
      select: {
        id: true,
      },
    });

    return existing ? { outcome: 'CONFLICT' } : { outcome: 'NOT_FOUND' };
  }
}

export class PrismaOrganizationUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(
    work: (repositories: OrganizationPersistenceRepositories) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        organizations: new PrismaOrganizationRepository(tx),
        memberships: new PrismaOrganizationMembershipRepository(tx),
        invitations: new PrismaOrganizationInvitationRepository(tx),
      }),
    );
  }
}

const organizationInclude = {
  memberships: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  invitations: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

function toOrganizationReadModel(
  organization: OrganizationWithChildren,
): PersistedOrganizationReadModel {
  return {
    id: organization.id,
    publicId: organization.publicId,
    displayName: organization.displayName,
    slug: organization.slug,
    status: organization.status,
    version: organization.version,
    defaultLocale: organization.defaultLocale,
    timezone: organization.timezone,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
    activatedAt: organization.activatedAt,
    suspendedAt: organization.suspendedAt,
    closedAt: organization.closedAt,
    archivedAt: organization.archivedAt,
    memberships: organization.memberships.map(toMembershipReadModel),
    invitations: organization.invitations.map(toInvitationReadModel),
  };
}

function toMembershipReadModel(
  membership: OrganizationMembershipRecord,
): PersistedOrganizationMembershipReadModel {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    identityId: membership.identityId,
    role: membership.role,
    status: membership.status,
    invitationId: membership.invitationId,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    activatedAt: membership.activatedAt,
    suspendedAt: membership.suspendedAt,
    removedAt: membership.removedAt,
    lastChangedBy: membership.lastChangedBy,
  };
}

function toInvitationReadModel(
  invitation: OrganizationInvitationRecord,
): PersistedOrganizationInvitationReadModel {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    normalizedRecipientEmail: invitation.normalizedRecipientEmail,
    intendedRole: invitation.intendedRole,
    status: invitation.status,
    tokenId: invitation.tokenId,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    expiresAt: invitation.expiresAt,
    revokedAt: invitation.revokedAt,
    acceptedAt: invitation.acceptedAt,
    invitedBy: invitation.invitedBy,
  };
}

async function inTransaction<T>(
  prisma: PrismaExecutor,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ('$transaction' in prisma) {
    return prisma.$transaction((tx) => work(tx));
  }

  return work(prisma);
}

function isUniqueConstraintFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return (
    code === 'P2002' || (typeof message === 'string' && message.toLowerCase().includes('unique'))
  );
}
