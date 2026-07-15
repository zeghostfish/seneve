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
  readonly deviceId?: string | null;
  readonly refreshTokenId: string;
  readonly refreshTokenFamilyId: string;
  readonly refreshTokenHash: string;
  readonly issuedAt: Date;
  readonly sessionExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
}

export interface PersistedSessionReadModel {
  readonly id: string;
  readonly identityId: string;
  readonly status: SessionStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedReason: string | null;
  readonly device: PersistedTrustedDeviceReadModel | null;
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

export interface PersistedOneTimeTokenReadModel {
  readonly id: string;
  readonly identityId: string;
  readonly tokenId: string;
  readonly status: OneTimeTokenStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
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
  findSessionById(sessionId: string): Promise<PersistedSessionReadModel | null>;
  listActiveSessions(identityId: string, now: Date): Promise<readonly PersistedSessionReadModel[]>;
  countActiveSessions(identityId: string, now: Date): Promise<number>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRotationResult>;
  touchSession(sessionId: string, lastActivityAt: Date): Promise<boolean>;
  expireSessions(identityId: string, now: Date): Promise<number>;
  revokeSession(sessionId: string, revokedAt: Date, reason: string): Promise<boolean>;
  revokeAllSessionsForIdentity(
    identityId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<number>;
  revokeAllSessionsExcept(
    identityId: string,
    currentSessionId: string,
    revokedAt: Date,
    reason: string,
  ): Promise<number>;
}

export interface DeviceFingerprint {
  readonly hash: string;
  readonly displayName: string;
}

export interface PersistedTrustedDeviceReadModel {
  readonly id: string;
  readonly identityId: string;
  readonly fingerprintHash: string;
  readonly displayName: string;
  readonly status: 'TRUSTED' | 'REVOKED';
  readonly firstSeenAt: Date;
  readonly lastActivityAt: Date;
  readonly revokedAt: Date | null;
}

export interface TrustedDeviceRepository {
  findTrustedDevice(
    identityId: string,
    fingerprintHash: string,
  ): Promise<PersistedTrustedDeviceReadModel | null>;
  createTrustedDevice(input: {
    readonly id: string;
    readonly identityId: string;
    readonly fingerprintHash: string;
    readonly displayName: string;
    readonly firstSeenAt: Date;
  }): Promise<PersistedTrustedDeviceReadModel>;
  touchTrustedDevice(deviceId: string, lastActivityAt: Date): Promise<boolean>;
  revokeTrustedDevice(deviceId: string, revokedAt: Date): Promise<boolean>;
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
  findLatestEmailVerificationToken(
    identityId: string,
  ): Promise<PersistedOneTimeTokenReadModel | null>;
  countEmailVerificationTokensCreatedSince(input: {
    readonly identityId: string;
    readonly since: Date;
  }): Promise<number>;
  revokePendingEmailVerificationTokens(input: {
    readonly identityId: string;
    readonly revokedAt: Date;
    readonly exceptTokenId?: string;
  }): Promise<number>;
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
