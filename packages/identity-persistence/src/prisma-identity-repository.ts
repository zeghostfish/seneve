import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateSessionWithRefreshTokenInput,
  IdentityRepository,
  IdentitySessionRepository,
  IdentityTokenRepository,
  OneTimeTokenConsumptionInput,
  OneTimeTokenConsumptionResult,
  PersistedIdentityReadModel,
  PersistedIdentityRegistration,
  RefreshTokenRotationResult,
  RotateRefreshTokenInput,
} from '@seneve/domain-identity';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

type IdentityWithChildren = Prisma.IdentityGetPayload<{
  include: {
    user: true;
    emails: true;
    credentials: true;
  };
}>;

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createRegisteredIdentity(input: PersistedIdentityRegistration): Promise<void> {
    await this.prisma.identity.create({
      data: {
        id: input.identityId,
        status: 'PENDING_EMAIL_VERIFICATION',
        normalizedLoginEmail: input.normalizedEmail,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        user: {
          create: {
            id: input.userId,
            displayName: input.displayName,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          },
        },
        emails: {
          create: {
            id: input.emailId,
            email: input.email,
            normalizedEmail: input.normalizedEmail,
            isPrimary: true,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          },
        },
        credentials: {
          create: {
            id: input.passwordCredentialId,
            type: 'PASSWORD',
            secretHash: input.passwordHash,
            status: 'ACTIVE',
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
          },
        },
      },
    });
  }

  async findById(identityId: string): Promise<PersistedIdentityReadModel | null> {
    const record = await this.prisma.identity.findUnique({
      where: { id: identityId },
      include: { user: true, emails: true, credentials: true },
    });

    return record ? toReadModel(record) : null;
  }

  async findByNormalizedLoginEmail(
    normalizedEmail: string,
  ): Promise<PersistedIdentityReadModel | null> {
    const record = await this.prisma.identity.findFirst({
      where: {
        normalizedLoginEmail: normalizedEmail,
        status: {
          not: 'CLOSED',
        },
      },
      include: { user: true, emails: true, credentials: true },
    });

    return record ? toReadModel(record) : null;
  }

  async markPrimaryEmailVerified(identityId: string, verifiedAt: Date): Promise<boolean> {
    const [emailResult, identityResult] = await inTransaction(this.prisma, (tx) =>
      Promise.all([
        tx.identityEmail.updateMany({
          where: {
            identityId,
            isPrimary: true,
            verifiedAt: null,
          },
          data: {
            verifiedAt,
            updatedAt: verifiedAt,
          },
        }),
        tx.identity.updateMany({
          where: {
            id: identityId,
            status: 'PENDING_EMAIL_VERIFICATION',
          },
          data: {
            status: 'ACTIVE',
            updatedAt: verifiedAt,
            version: {
              increment: 1,
            },
          },
        }),
      ]),
    );

    return emailResult.count === 1 || identityResult.count === 1;
  }

  async suspendIdentityAndRevokeSessions(identityId: string, suspendedAt: Date): Promise<boolean> {
    const [identityResult] = await inTransaction(this.prisma, (tx) =>
      Promise.all([
        tx.identity.updateMany({
          where: {
            id: identityId,
            status: {
              not: 'CLOSED',
            },
          },
          data: {
            status: 'SUSPENDED',
            suspendedAt,
            updatedAt: suspendedAt,
            version: {
              increment: 1,
            },
          },
        }),
        tx.session.updateMany({
          where: {
            identityId,
            status: 'ACTIVE',
          },
          data: {
            status: 'REVOKED',
            revokedAt: suspendedAt,
            updatedAt: suspendedAt,
            version: {
              increment: 1,
            },
          },
        }),
      ]),
    );

    return identityResult.count === 1;
  }
}

export class PrismaIdentitySessionRepository implements IdentitySessionRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createSessionWithRefreshToken(input: CreateSessionWithRefreshTokenInput): Promise<void> {
    await this.prisma.session.create({
      data: {
        id: input.sessionId,
        identityId: input.identityId,
        status: 'ACTIVE',
        createdAt: input.issuedAt,
        updatedAt: input.issuedAt,
        expiresAt: input.sessionExpiresAt,
        refreshTokens: {
          create: {
            id: input.refreshTokenId,
            familyId: input.refreshTokenFamilyId,
            tokenHash: input.refreshTokenHash,
            status: 'ACTIVE',
            issuedAt: input.issuedAt,
            expiresAt: input.refreshTokenExpiresAt,
          },
        },
      },
    });
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRotationResult> {
    return inTransaction(this.prisma, async (tx) => {
      const rotationResult = await tx.refreshToken.updateMany({
        where: {
          id: input.currentRefreshTokenId,
          tokenHash: input.currentRefreshTokenHash,
          status: 'ACTIVE',
          expiresAt: {
            gt: input.rotatedAt,
          },
        },
        data: {
          status: 'ROTATED',
          consumedAt: input.rotatedAt,
          version: {
            increment: 1,
          },
        },
      });

      const current = await tx.refreshToken.findUnique({
        where: {
          id: input.currentRefreshTokenId,
        },
      });

      if (!current || current.tokenHash !== input.currentRefreshTokenHash) {
        return { outcome: 'NOT_FOUND' };
      }

      if (rotationResult.count === 1) {
        await tx.refreshToken.create({
          data: {
            id: input.nextRefreshTokenId,
            sessionId: current.sessionId,
            familyId: current.familyId,
            tokenHash: input.nextRefreshTokenHash,
            status: 'ACTIVE',
            issuedAt: input.rotatedAt,
            expiresAt: input.nextRefreshTokenExpiresAt,
          },
        });

        return {
          outcome: 'ROTATED',
          sessionId: current.sessionId,
          familyId: current.familyId,
        };
      }

      if (current.expiresAt <= input.rotatedAt || current.status === 'EXPIRED') {
        return { outcome: 'EXPIRED' };
      }

      await revokeRefreshTokenFamily(tx, current.familyId, input.rotatedAt);

      return {
        outcome: 'REUSED',
        sessionId: current.sessionId,
        familyId: current.familyId,
      };
    });
  }
}

export class PrismaIdentityTokenRepository implements IdentityTokenRepository {
  constructor(private readonly prisma: PrismaExecutor) {}

  async createEmailVerificationToken(input: {
    readonly id: string;
    readonly identityId: string;
    readonly tokenId: string;
    readonly tokenHash: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Promise<void> {
    await this.prisma.emailVerificationToken.create({
      data: {
        id: input.id,
        identityId: input.identityId,
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        status: 'PENDING',
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  async consumeEmailVerificationToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult> {
    return consumeEmailVerificationToken(this.prisma, input);
  }

  async createPasswordResetToken(input: {
    readonly id: string;
    readonly identityId: string;
    readonly tokenId: string;
    readonly tokenHash: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: {
        id: input.id,
        identityId: input.identityId,
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        status: 'PENDING',
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      },
    });
  }

  async consumePasswordResetToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult> {
    return consumePasswordResetToken(this.prisma, input);
  }
}

export class PrismaIdentityUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async transaction<T>(
    work: (repositories: {
      readonly identities: PrismaIdentityRepository;
      readonly sessions: PrismaIdentitySessionRepository;
      readonly tokens: PrismaIdentityTokenRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        identities: new PrismaIdentityRepository(tx),
        sessions: new PrismaIdentitySessionRepository(tx),
        tokens: new PrismaIdentityTokenRepository(tx),
      }),
    );
  }
}

function toReadModel(record: IdentityWithChildren): PersistedIdentityReadModel {
  const primaryEmail = record.emails.find((email) => email.isPrimary);

  if (!record.user) {
    throw new Error(`Identity ${record.id} has no user profile.`);
  }

  if (!primaryEmail) {
    throw new Error(`Identity ${record.id} has no primary email.`);
  }

  return {
    id: record.id,
    status: record.status,
    normalizedLoginEmail: record.normalizedLoginEmail,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    suspendedAt: record.suspendedAt,
    closedAt: record.closedAt,
    user: {
      id: record.user.id,
      displayName: record.user.displayName,
    },
    primaryEmail: {
      id: primaryEmail.id,
      email: primaryEmail.email,
      normalizedEmail: primaryEmail.normalizedEmail,
      verifiedAt: primaryEmail.verifiedAt,
    },
    activeCredentials: record.credentials
      .filter((credential) => credential.status === 'ACTIVE')
      .map((credential) => ({
        id: credential.id,
        type: credential.type,
        status: credential.status,
        secretHash: credential.secretHash,
      })),
  };
}

async function consumeEmailVerificationToken(
  prisma: PrismaExecutor,
  input: OneTimeTokenConsumptionInput,
): Promise<OneTimeTokenConsumptionResult> {
  return inTransaction(prisma, async (tx) => {
    const result = await tx.emailVerificationToken.updateMany({
      where: {
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        status: 'PENDING',
        expiresAt: {
          gt: input.consumedAt,
        },
      },
      data: {
        status: 'CONSUMED',
        consumedAt: input.consumedAt,
      },
    });

    const token = await tx.emailVerificationToken.findUnique({
      where: {
        tokenId: input.tokenId,
      },
    });

    if (!token || token.tokenHash !== input.tokenHash) {
      return { outcome: 'NOT_FOUND' };
    }

    if (result.count === 1) {
      return {
        outcome: 'CONSUMED',
        identityId: token.identityId,
      };
    }

    if (token.expiresAt <= input.consumedAt || token.status === 'EXPIRED') {
      return { outcome: 'EXPIRED' };
    }

    return { outcome: 'ALREADY_CONSUMED_OR_REVOKED' };
  });
}

async function consumePasswordResetToken(
  prisma: PrismaExecutor,
  input: OneTimeTokenConsumptionInput,
): Promise<OneTimeTokenConsumptionResult> {
  return inTransaction(prisma, async (tx) => {
    const result = await tx.passwordResetToken.updateMany({
      where: {
        tokenId: input.tokenId,
        tokenHash: input.tokenHash,
        status: 'PENDING',
        expiresAt: {
          gt: input.consumedAt,
        },
      },
      data: {
        status: 'CONSUMED',
        consumedAt: input.consumedAt,
      },
    });

    const token = await tx.passwordResetToken.findUnique({
      where: {
        tokenId: input.tokenId,
      },
    });

    if (!token || token.tokenHash !== input.tokenHash) {
      return { outcome: 'NOT_FOUND' };
    }

    if (result.count === 1) {
      return {
        outcome: 'CONSUMED',
        identityId: token.identityId,
      };
    }

    if (token.expiresAt <= input.consumedAt || token.status === 'EXPIRED') {
      return { outcome: 'EXPIRED' };
    }

    return { outcome: 'ALREADY_CONSUMED_OR_REVOKED' };
  });
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

async function revokeRefreshTokenFamily(
  tx: Prisma.TransactionClient,
  familyId: string,
  revokedAt: Date,
): Promise<void> {
  const tokens = await tx.refreshToken.findMany({
    where: { familyId },
    select: { sessionId: true },
  });
  const sessionIds = [...new Set(tokens.map((token) => token.sessionId))];

  await tx.refreshToken.updateMany({
    where: {
      familyId,
      status: {
        in: ['ACTIVE', 'ROTATED'],
      },
    },
    data: {
      status: 'REVOKED',
      revokedAt,
      version: {
        increment: 1,
      },
    },
  });

  if (sessionIds.length > 0) {
    await tx.session.updateMany({
      where: {
        id: {
          in: sessionIds,
        },
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt,
        version: {
          increment: 1,
        },
      },
    });
  }
}
