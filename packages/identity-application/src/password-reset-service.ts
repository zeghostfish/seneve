import { PasswordPolicy } from '@seneve/domain-identity';
import type { IdentityRepository, IdentityTokenRepository } from '@seneve/domain-identity';

import { IdentityApplicationError } from './application-error.js';
import type {
  Clock,
  IdentityUnitOfWork,
  PasswordHasher,
  PasswordResetNotificationCommand,
  PasswordResetPolicy,
  PasswordResetRequestResult,
  SecurityEventRecorder,
  TokenGenerator,
  TokenHasher,
} from './contracts.js';

export interface PasswordResetServiceDependencies {
  readonly unitOfWork: IdentityUnitOfWork;
  readonly identities: IdentityRepository;
  readonly tokens: IdentityTokenRepository;
  readonly passwordHasher: PasswordHasher;
  readonly tokenGenerator: TokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly securityEvents: SecurityEventRecorder;
  readonly clock: Clock;
  readonly tokenTtlSeconds: number;
  readonly policy: PasswordResetPolicy;
}

export interface RequestPasswordResetCommand {
  readonly email: string;
  readonly correlationId: string;
}

export interface CompletePasswordResetCommand {
  readonly tokenId: string;
  readonly rawToken: string;
  readonly newPlaintextPassword: string;
  readonly correlationId: string;
}

export class RequestPasswordResetService {
  constructor(private readonly deps: PasswordResetServiceDependencies) {}

  async request(command: RequestPasswordResetCommand): Promise<PasswordResetRequestResult> {
    const normalizedEmail = normalizeEmail(command.email);
    const identity = await this.deps.identities.findByNormalizedLoginEmail(normalizedEmail);

    if (!identity) {
      await this.deps.passwordHasher.equivalentHash();
      return acceptedWithoutNotification();
    }

    if (!isPasswordResetAllowed(identity.status, identity.activeCredentials.length)) {
      await this.recordResetFailure(identity.id, command.correlationId, 'IDENTITY_NOT_ALLOWED');
      return acceptedWithoutNotification();
    }

    const now = this.deps.clock.now();
    const latest = await this.deps.tokens.findLatestPasswordResetToken(identity.id);
    const requestWindowStart = addSeconds(now, -this.deps.policy.requestWindowSeconds);
    const requestsInWindow = await this.deps.tokens.countPasswordResetTokensCreatedSince({
      identityId: identity.id,
      since: requestWindowStart,
    });

    if (requestsInWindow >= this.deps.policy.maximumRequestsPerWindow) {
      await this.recordResetFailure(identity.id, command.correlationId, 'REQUEST_RATE_LIMITED');
      throw new IdentityApplicationError(
        'PASSWORD_RESET_REQUEST_THROTTLED',
        'Password reset request is throttled.',
      );
    }

    if (latest?.status === 'PENDING' && latest.expiresAt > now) {
      const nextAllowedAt = addSeconds(
        latest.createdAt,
        this.deps.policy.minimumRequestDelaySeconds,
      );

      if (nextAllowedAt > now) {
        await this.recordResetFailure(identity.id, command.correlationId, 'REQUEST_THROTTLED');
        throw new IdentityApplicationError(
          'PASSWORD_RESET_REQUEST_THROTTLED',
          'Password reset request is throttled.',
        );
      }
    }

    return {
      accepted: true,
      notification: await createPasswordResetChallenge(this.deps, {
        identityId: identity.id,
        recipientEmail: identity.primaryEmail.email,
        correlationId: command.correlationId,
        eventType: latest ? 'PASSWORD_RESET_RESENT' : 'PASSWORD_RESET_REQUESTED',
      }),
    };
  }

  private async recordResetFailure(
    identityId: string,
    correlationId: string,
    reason: string,
  ): Promise<void> {
    await this.deps.securityEvents.record({
      identityId,
      eventType: 'PASSWORD_RESET_FAILED',
      occurredAt: this.deps.clock.now(),
      correlationId,
      metadata: {
        reason,
      },
    });
  }
}

export class CompletePasswordResetService {
  constructor(private readonly deps: PasswordResetServiceDependencies) {}

  async complete(command: CompletePasswordResetCommand): Promise<void> {
    const passwordPolicy = PasswordPolicy.validatePlaintext(command.newPlaintextPassword);

    if (!passwordPolicy.valid) {
      throw new IdentityApplicationError(
        'PASSWORD_POLICY_VIOLATION',
        'Password does not satisfy the configured policy.',
      );
    }

    const now = this.deps.clock.now();
    const tokenHash = await this.deps.tokenHasher.hash(command.rawToken);
    const newCredentialId = this.deps.tokenGenerator.uuid();
    const newPasswordHash = await this.deps.passwordHasher.hash(command.newPlaintextPassword);

    try {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const consumed = await repositories.tokens.consumePasswordResetToken({
          tokenId: command.tokenId,
          tokenHash,
          consumedAt: now,
        });

        if (consumed.outcome === 'NOT_FOUND') {
          await recordResetTokenFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_NOT_FOUND',
          );
          throw new IdentityApplicationError(
            'PASSWORD_RESET_TOKEN_INVALID',
            'Password reset token is invalid.',
          );
        }

        if (consumed.outcome === 'EXPIRED') {
          await recordResetTokenFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_EXPIRED',
          );
          throw new IdentityApplicationError(
            'PASSWORD_RESET_TOKEN_EXPIRED',
            'Password reset token has expired.',
          );
        }

        if (consumed.outcome === 'ALREADY_CONSUMED_OR_REVOKED') {
          await recordResetTokenFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_CONSUMED',
          );
          throw new IdentityApplicationError(
            'PASSWORD_RESET_TOKEN_CONSUMED',
            'Password reset token has already been used.',
          );
        }

        const identity = await repositories.identities.findById(consumed.identityId);

        if (
          !identity ||
          !isPasswordResetAllowed(identity.status, identity.activeCredentials.length)
        ) {
          await recordResetTokenFailure(
            this.deps.securityEvents,
            consumed.identityId,
            command.correlationId,
            now,
            'IDENTITY_NOT_ALLOWED',
          );
          throw new IdentityApplicationError(
            'PASSWORD_RESET_NOT_ALLOWED',
            'Password reset is not allowed.',
          );
        }

        if (this.deps.policy.preventPasswordReuseCount > 0) {
          const activePasswordCredential = identity.activeCredentials.find(
            (credential) => credential.type === 'PASSWORD',
          );
          const reusedCurrentPassword = activePasswordCredential
            ? await this.deps.passwordHasher.verify({
                plaintext: command.newPlaintextPassword,
                hash: activePasswordCredential.secretHash,
              })
            : false;

          if (reusedCurrentPassword) {
            throw new IdentityApplicationError(
              'PASSWORD_REUSE_NOT_ALLOWED',
              'Password reuse is not allowed.',
            );
          }
        }

        const replaced = await repositories.identities.replacePasswordCredential({
          identityId: consumed.identityId,
          newCredentialId,
          passwordHash: newPasswordHash,
          replacedAt: now,
        });

        if (!replaced) {
          throw new IdentityApplicationError(
            'PASSWORD_RESET_TRANSACTION_FAILED',
            'Password reset transaction failed.',
          );
        }

        await repositories.tokens.revokePendingPasswordResetTokens({
          identityId: consumed.identityId,
          revokedAt: now,
          exceptTokenId: command.tokenId,
        });
        const revoked = await repositories.sessions.revokeAllSessionsAndRefreshTokensForIdentity(
          consumed.identityId,
          now,
          'PASSWORD_RESET',
        );
        await this.deps.securityEvents.record({
          identityId: consumed.identityId,
          eventType: 'PASSWORD_CREDENTIAL_REPLACED',
          occurredAt: now,
          correlationId: command.correlationId,
          metadata: {
            credentialId: newCredentialId,
          },
        });
        await this.deps.securityEvents.record({
          identityId: consumed.identityId,
          eventType: 'SESSIONS_REVOKED_AFTER_PASSWORD_RESET',
          occurredAt: now,
          correlationId: command.correlationId,
          metadata: revoked,
        });
        await this.deps.securityEvents.record({
          identityId: consumed.identityId,
          eventType: 'PASSWORD_RESET_COMPLETED',
          occurredAt: now,
          correlationId: command.correlationId,
        });
      });
    } catch (error) {
      if (error instanceof IdentityApplicationError) {
        throw error;
      }

      throw new IdentityApplicationError(
        'PASSWORD_RESET_TRANSACTION_FAILED',
        'Password reset transaction failed.',
      );
    }
  }
}

async function createPasswordResetChallenge(
  deps: PasswordResetServiceDependencies,
  input: {
    readonly identityId: string;
    readonly recipientEmail: string;
    readonly correlationId: string;
    readonly eventType: 'PASSWORD_RESET_REQUESTED' | 'PASSWORD_RESET_RESENT';
  },
): Promise<PasswordResetNotificationCommand> {
  const now = deps.clock.now();
  const rawToken = deps.tokenGenerator.opaqueToken();
  const tokenRecordId = deps.tokenGenerator.uuid();
  const tokenHash = await deps.tokenHasher.hash(rawToken.rawToken);
  const expiresAt = addSeconds(now, deps.tokenTtlSeconds);

  try {
    await deps.unitOfWork.transaction(async (repositories) => {
      if (deps.policy.supersedePreviousTokens) {
        await repositories.tokens.revokePendingPasswordResetTokens({
          identityId: input.identityId,
          revokedAt: now,
        });
      }

      await repositories.tokens.createPasswordResetToken({
        id: tokenRecordId,
        identityId: input.identityId,
        tokenId: rawToken.tokenId,
        tokenHash,
        createdAt: now,
        expiresAt,
      });
      await deps.securityEvents.record({
        identityId: input.identityId,
        eventType: input.eventType,
        occurredAt: now,
        correlationId: input.correlationId,
        metadata: {
          expiresAt: expiresAt.toISOString(),
        },
      });
    });
  } catch (error) {
    if (error instanceof IdentityApplicationError) {
      throw error;
    }

    throw new IdentityApplicationError(
      'PASSWORD_RESET_TRANSACTION_FAILED',
      'Password reset transaction failed.',
    );
  }

  return {
    recipientEmail: input.recipientEmail,
    template: 'identity.password_reset',
    locale: deps.policy.locale,
    rawResetToken: rawToken.rawToken,
    resetTokenId: rawToken.tokenId,
    expiresAt,
    correlationId: input.correlationId,
  };
}

function acceptedWithoutNotification(): PasswordResetRequestResult {
  return {
    accepted: true,
    notification: null,
  };
}

function isPasswordResetAllowed(status: string, activeCredentialCount: number): boolean {
  return status !== 'SUSPENDED' && status !== 'CLOSED' && activeCredentialCount > 0;
}

async function recordResetTokenFailure(
  securityEvents: SecurityEventRecorder,
  identityId: string | null,
  correlationId: string,
  occurredAt: Date,
  reason: string,
): Promise<void> {
  await securityEvents.record({
    identityId,
    eventType: reason === 'TOKEN_EXPIRED' ? 'PASSWORD_RESET_EXPIRED' : 'PASSWORD_RESET_FAILED',
    occurredAt,
    correlationId,
    metadata: {
      reason,
    },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
