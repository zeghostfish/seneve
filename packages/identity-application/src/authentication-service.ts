import { PasswordPolicy } from '@seneve/domain-identity';

import { IdentityApplicationError } from './application-error.js';
import type { AuthenticationServiceDependencies } from './contracts.js';

export interface RegisterIdentityCommand {
  readonly email: string;
  readonly displayName: string;
  readonly plaintextPassword: string;
  readonly correlationId: string;
}

export interface RegisterIdentityResult {
  readonly identityId: string;
  readonly userId: string;
  readonly emailVerification: {
    readonly tokenId: string;
    readonly rawToken: string;
    readonly expiresAt: Date;
  };
}

export interface LoginCommand {
  readonly email: string;
  readonly plaintextPassword: string;
  readonly correlationId: string;
}

export interface AuthenticatedSessionResult {
  readonly identityId: string;
  readonly sessionId: string;
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: {
    readonly tokenId: string;
    readonly rawToken: string;
    readonly expiresAt: Date;
  };
}

export interface RefreshSessionCommand {
  readonly refreshTokenId: string;
  readonly rawRefreshToken: string;
  readonly correlationId: string;
}

export interface LogoutCommand {
  readonly sessionId: string;
  readonly correlationId: string;
}

export class AuthenticationService {
  constructor(private readonly deps: AuthenticationServiceDependencies) {}

  async register(command: RegisterIdentityCommand): Promise<RegisterIdentityResult> {
    const normalizedEmail = normalizeEmail(command.email);
    const passwordPolicy = PasswordPolicy.validatePlaintext(command.plaintextPassword);

    if (!passwordPolicy.valid) {
      throw new IdentityApplicationError(
        'PASSWORD_POLICY_VIOLATION',
        'Password does not satisfy the configured policy.',
      );
    }

    const now = this.deps.clock.now();
    const identityId = this.deps.tokenGenerator.uuid();
    const userId = this.deps.tokenGenerator.uuid();
    const emailId = this.deps.tokenGenerator.uuid();
    const credentialId = this.deps.tokenGenerator.uuid();
    const verificationTokenRecordId = this.deps.tokenGenerator.uuid();
    const verificationToken = this.deps.tokenGenerator.opaqueToken();
    const passwordHash = await this.deps.passwordHasher.hash(command.plaintextPassword);
    const verificationTokenHash = await this.deps.tokenHasher.hash(verificationToken.rawToken);
    const verificationExpiresAt = addSeconds(now, this.deps.emailVerificationTokenTtlSeconds);

    try {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        await repositories.identities.createRegisteredIdentity({
          identityId,
          userId,
          displayName: command.displayName.trim(),
          emailId,
          email: command.email.trim(),
          normalizedEmail,
          passwordCredentialId: credentialId,
          passwordHash,
          createdAt: now,
        });
        await repositories.tokens.createEmailVerificationToken({
          id: verificationTokenRecordId,
          identityId,
          tokenId: verificationToken.tokenId,
          tokenHash: verificationTokenHash,
          createdAt: now,
          expiresAt: verificationExpiresAt,
        });
        await this.deps.securityEvents.record({
          identityId,
          eventType: 'IDENTITY_REGISTERED',
          occurredAt: now,
          correlationId: command.correlationId,
          metadata: {
            normalizedEmail,
          },
        });
      });
    } catch (error) {
      throw mapRegistrationError(error);
    }

    return {
      identityId,
      userId,
      emailVerification: {
        tokenId: verificationToken.tokenId,
        rawToken: verificationToken.rawToken,
        expiresAt: verificationExpiresAt,
      },
    };
  }

  async login(command: LoginCommand): Promise<AuthenticatedSessionResult> {
    const normalizedEmail = normalizeEmail(command.email);
    const now = this.deps.clock.now();
    const identity = await this.deps.identities.findByNormalizedLoginEmail(normalizedEmail);

    if (!identity) {
      await this.deps.passwordHasher.equivalentHash();
      await this.recordLoginFailed(null, command.correlationId, now, 'IDENTITY_NOT_FOUND');
      throw new IdentityApplicationError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    if (identity.status === 'SUSPENDED') {
      await this.recordLoginFailed(identity.id, command.correlationId, now, 'IDENTITY_SUSPENDED');
      throw new IdentityApplicationError('IDENTITY_SUSPENDED', 'Identity is suspended.');
    }

    if (identity.status === 'PENDING_EMAIL_VERIFICATION' || !identity.primaryEmail.verifiedAt) {
      await this.recordLoginFailed(identity.id, command.correlationId, now, 'EMAIL_NOT_VERIFIED');
      throw new IdentityApplicationError(
        'EMAIL_VERIFICATION_REQUIRED',
        'Email verification is required.',
      );
    }

    const passwordCredential = identity.activeCredentials.find(
      (credential) => credential.type === 'PASSWORD',
    );

    if (!passwordCredential) {
      await this.deps.passwordHasher.equivalentHash();
      await this.recordLoginFailed(
        identity.id,
        command.correlationId,
        now,
        'ACTIVE_CREDENTIAL_NOT_FOUND',
      );
      throw new IdentityApplicationError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    const validPassword = await this.deps.passwordHasher.verify({
      plaintext: command.plaintextPassword,
      hash: passwordCredential.secretHash,
    });

    if (!validPassword) {
      await this.recordLoginFailed(identity.id, command.correlationId, now, 'PASSWORD_MISMATCH');
      throw new IdentityApplicationError('INVALID_CREDENTIALS', 'Invalid credentials.');
    }

    const result = await this.createAuthenticatedSession({
      identityId: identity.id,
      tokenVersion: identity.version,
      correlationId: command.correlationId,
      now,
    });

    await this.deps.securityEvents.record({
      identityId: identity.id,
      eventType: 'LOGIN_SUCCEEDED',
      occurredAt: now,
      correlationId: command.correlationId,
    });

    return result;
  }

  async refresh(command: RefreshSessionCommand): Promise<AuthenticatedSessionResult> {
    const now = this.deps.clock.now();
    const currentRefreshTokenHash = await this.deps.tokenHasher.hash(command.rawRefreshToken);
    const nextRefreshToken = this.deps.tokenGenerator.opaqueToken();
    const nextRefreshTokenHash = await this.deps.tokenHasher.hash(nextRefreshToken.rawToken);
    const rotated = await this.deps.sessions.rotateRefreshToken({
      currentRefreshTokenId: command.refreshTokenId,
      currentRefreshTokenHash,
      nextRefreshTokenId: nextRefreshToken.tokenId,
      nextRefreshTokenHash,
      rotatedAt: now,
      nextRefreshTokenExpiresAt: addSeconds(now, this.deps.refreshTokenTtlSeconds),
    });

    if (rotated.outcome === 'NOT_FOUND') {
      throw new IdentityApplicationError('REFRESH_TOKEN_INVALID', 'Refresh token is invalid.');
    }

    if (rotated.outcome === 'EXPIRED') {
      throw new IdentityApplicationError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired.');
    }

    if (rotated.outcome === 'REUSED') {
      await this.deps.securityEvents.record({
        identityId: null,
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        occurredAt: now,
        correlationId: command.correlationId,
        metadata: {
          sessionId: rotated.sessionId,
          familyId: rotated.familyId,
        },
      });
      throw new IdentityApplicationError('REFRESH_TOKEN_REUSED', 'Refresh token cannot be reused.');
    }

    const identity = await this.findIdentityBySession(rotated.sessionId);
    const accessTokenExpiresAt = addSeconds(now, this.deps.accessTokenTtlSeconds);
    const accessToken = await this.deps.accessTokenIssuer.issue({
      sub: identity.id,
      identityId: identity.id,
      sessionId: rotated.sessionId,
      tokenVersion: identity.version,
      issuedAt: now,
      expiresAt: accessTokenExpiresAt,
    });

    await this.deps.securityEvents.record({
      identityId: identity.id,
      eventType: 'REFRESH_TOKEN_ROTATED',
      occurredAt: now,
      correlationId: command.correlationId,
      metadata: {
        sessionId: rotated.sessionId,
      },
    });

    return {
      identityId: identity.id,
      sessionId: rotated.sessionId,
      accessToken,
      accessTokenExpiresAt,
      refreshToken: {
        tokenId: nextRefreshToken.tokenId,
        rawToken: nextRefreshToken.rawToken,
        expiresAt: addSeconds(now, this.deps.refreshTokenTtlSeconds),
      },
    };
  }

  async logout(command: LogoutCommand): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.sessions.revokeSession(command.sessionId, now);
    await this.deps.securityEvents.record({
      identityId: null,
      eventType: 'SESSION_REVOKED',
      occurredAt: now,
      correlationId: command.correlationId,
      metadata: {
        sessionId: command.sessionId,
        reason: 'LOGOUT',
      },
    });
  }

  async revokeAllSessions(identityId: string, correlationId: string): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.sessions.revokeAllSessionsForIdentity(identityId, now);
    await this.deps.securityEvents.record({
      identityId,
      eventType: 'SESSION_REVOKED',
      occurredAt: now,
      correlationId,
      metadata: {
        reason: 'ALL_SESSIONS_REVOKED',
      },
    });
  }

  async suspendIdentity(identityId: string, correlationId: string): Promise<void> {
    const now = this.deps.clock.now();
    const suspended = await this.deps.identities.suspendIdentityAndRevokeSessions(identityId, now);

    if (!suspended) {
      throw new IdentityApplicationError('SESSION_INVALID', 'Identity could not be suspended.');
    }

    await this.deps.securityEvents.record({
      identityId,
      eventType: 'IDENTITY_SUSPENDED',
      occurredAt: now,
      correlationId,
    });
  }

  private async createAuthenticatedSession(input: {
    readonly identityId: string;
    readonly tokenVersion: number;
    readonly correlationId: string;
    readonly now: Date;
  }): Promise<AuthenticatedSessionResult> {
    const sessionId = this.deps.tokenGenerator.uuid();
    const refreshTokenFamilyId = this.deps.tokenGenerator.uuid();
    const refreshToken = this.deps.tokenGenerator.opaqueToken();
    const refreshTokenHash = await this.deps.tokenHasher.hash(refreshToken.rawToken);
    const accessTokenExpiresAt = addSeconds(input.now, this.deps.accessTokenTtlSeconds);
    const sessionExpiresAt = addSeconds(input.now, this.deps.sessionTtlSeconds);
    const refreshTokenExpiresAt = addSeconds(input.now, this.deps.refreshTokenTtlSeconds);

    await this.deps.unitOfWork.transaction(async (repositories) => {
      await repositories.sessions.createSessionWithRefreshToken({
        sessionId,
        identityId: input.identityId,
        refreshTokenId: refreshToken.tokenId,
        refreshTokenFamilyId,
        refreshTokenHash,
        issuedAt: input.now,
        sessionExpiresAt,
        refreshTokenExpiresAt,
      });
      await this.deps.securityEvents.record({
        identityId: input.identityId,
        eventType: 'SESSION_CREATED',
        occurredAt: input.now,
        correlationId: input.correlationId,
        metadata: {
          sessionId,
        },
      });
    });

    const accessToken = await this.deps.accessTokenIssuer.issue({
      sub: input.identityId,
      identityId: input.identityId,
      sessionId,
      tokenVersion: input.tokenVersion,
      issuedAt: input.now,
      expiresAt: accessTokenExpiresAt,
    });

    return {
      identityId: input.identityId,
      sessionId,
      accessToken,
      accessTokenExpiresAt,
      refreshToken: {
        tokenId: refreshToken.tokenId,
        rawToken: refreshToken.rawToken,
        expiresAt: refreshTokenExpiresAt,
      },
    };
  }

  private async findIdentityBySession(sessionId: string) {
    const session = await this.deps.sessions.findSessionById(sessionId);

    if (!session) {
      throw new IdentityApplicationError('SESSION_INVALID', 'Session is invalid.');
    }

    if (session.status === 'REVOKED') {
      throw new IdentityApplicationError('SESSION_REVOKED', 'Session has been revoked.');
    }

    const identity = await this.deps.identities.findById(session.identityId);

    if (!identity) {
      throw new IdentityApplicationError('SESSION_INVALID', 'Session identity is invalid.');
    }

    if (identity.status === 'SUSPENDED') {
      throw new IdentityApplicationError('IDENTITY_SUSPENDED', 'Identity is suspended.');
    }

    if (identity.status === 'PENDING_EMAIL_VERIFICATION') {
      throw new IdentityApplicationError(
        'EMAIL_VERIFICATION_REQUIRED',
        'Email verification is required.',
      );
    }

    return identity;
  }

  private async recordLoginFailed(
    identityId: string | null,
    correlationId: string,
    occurredAt: Date,
    reason: string,
  ): Promise<void> {
    await this.deps.securityEvents.record({
      identityId,
      eventType: 'LOGIN_FAILED',
      occurredAt,
      correlationId,
      metadata: {
        reason,
      },
    });
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function mapRegistrationError(error: unknown): IdentityApplicationError {
  if (isUniqueConstraintFailure(error)) {
    return new IdentityApplicationError(
      'REGISTRATION_CONFLICT',
      'Registration could not be completed.',
    );
  }

  if (error instanceof IdentityApplicationError) {
    return error;
  }

  return new IdentityApplicationError(
    'AUTHENTICATION_TRANSACTION_FAILED',
    'Registration transaction failed.',
  );
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
