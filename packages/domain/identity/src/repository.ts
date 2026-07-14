import type { CredentialStatus, CredentialType } from './credential.js';
import type { IdentityStatus } from './identity.js';
import type { RefreshTokenStatus, SessionStatus } from './session.js';
import type { OneTimeTokenStatus } from './verification.js';

export interface PersistedIdentityRegistration {
  readonly identityId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly emailId: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly passwordCredentialId: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
}

export interface PersistedIdentityReadModel {
  readonly id: string;
  readonly status: IdentityStatus;
  readonly normalizedLoginEmail: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly suspendedAt: Date | null;
  readonly closedAt: Date | null;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
  readonly primaryEmail: {
    readonly id: string;
    readonly email: string;
    readonly normalizedEmail: string;
    readonly verifiedAt: Date | null;
  };
  readonly activeCredentials: readonly {
    readonly id: string;
    readonly type: CredentialType;
    readonly status: CredentialStatus;
    readonly secretHash: string;
  }[];
}

export interface CreateSessionWithRefreshTokenInput {
  readonly sessionId: string;
  readonly identityId: string;
  readonly refreshTokenId: string;
  readonly refreshTokenFamilyId: string;
  readonly refreshTokenHash: string;
  readonly issuedAt: Date;
  readonly sessionExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
}

export interface RotateRefreshTokenInput {
  readonly currentRefreshTokenId: string;
  readonly currentRefreshTokenHash: string;
  readonly nextRefreshTokenId: string;
  readonly nextRefreshTokenHash: string;
  readonly rotatedAt: Date;
  readonly nextRefreshTokenExpiresAt: Date;
}

export type RefreshTokenRotationResult =
  | {
      readonly outcome: 'ROTATED';
      readonly sessionId: string;
      readonly familyId: string;
    }
  | {
      readonly outcome: 'REUSED';
      readonly sessionId: string;
      readonly familyId: string;
    }
  | {
      readonly outcome: 'EXPIRED';
    }
  | {
      readonly outcome: 'NOT_FOUND';
    };

export interface OneTimeTokenConsumptionInput {
  readonly tokenId: string;
  readonly tokenHash: string;
  readonly consumedAt: Date;
}

export type OneTimeTokenConsumptionResult =
  | {
      readonly outcome: 'CONSUMED';
      readonly identityId: string;
    }
  | {
      readonly outcome: 'EXPIRED';
    }
  | {
      readonly outcome: 'ALREADY_CONSUMED_OR_REVOKED';
    }
  | {
      readonly outcome: 'NOT_FOUND';
    };

export interface IdentityRepository {
  createRegisteredIdentity(input: PersistedIdentityRegistration): Promise<void>;
  findById(identityId: string): Promise<PersistedIdentityReadModel | null>;
  findByNormalizedLoginEmail(normalizedEmail: string): Promise<PersistedIdentityReadModel | null>;
  markPrimaryEmailVerified(identityId: string, verifiedAt: Date): Promise<boolean>;
  suspendIdentityAndRevokeSessions(identityId: string, suspendedAt: Date): Promise<boolean>;
}

export interface IdentitySessionRepository {
  createSessionWithRefreshToken(input: CreateSessionWithRefreshTokenInput): Promise<void>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRotationResult>;
}

export interface IdentityTokenRepository {
  createEmailVerificationToken(input: {
    readonly id: string;
    readonly identityId: string;
    readonly tokenId: string;
    readonly tokenHash: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Promise<void>;
  consumeEmailVerificationToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult>;
  createPasswordResetToken(input: {
    readonly id: string;
    readonly identityId: string;
    readonly tokenId: string;
    readonly tokenHash: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Promise<void>;
  consumePasswordResetToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult>;
}

export type IdentityPersistenceStatus =
  IdentityStatus | CredentialStatus | SessionStatus | RefreshTokenStatus | OneTimeTokenStatus;
