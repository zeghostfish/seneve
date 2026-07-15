import { IdentityApplicationError } from './application-error.js';
import type {
  Clock,
  EmailVerificationNotificationCommand,
  EmailVerificationPolicy,
  IdentityUnitOfWork,
  SecurityEventRecorder,
  TokenGenerator,
  TokenHasher,
} from './contracts.js';
import type { IdentityRepository, IdentityTokenRepository } from '@seneve/domain-identity';

export interface EmailVerificationServiceDependencies {
  readonly unitOfWork: IdentityUnitOfWork;
  readonly identities: IdentityRepository;
  readonly tokens: IdentityTokenRepository;
  readonly tokenGenerator: TokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly securityEvents: SecurityEventRecorder;
  readonly clock: Clock;
  readonly tokenTtlSeconds: number;
  readonly policy: EmailVerificationPolicy;
}

export interface RequestEmailVerificationCommand {
  readonly identityId: string;
  readonly correlationId: string;
}

export interface CompleteEmailVerificationCommand {
  readonly tokenId: string;
  readonly rawToken: string;
  readonly correlationId: string;
}

export interface ResendEmailVerificationCommand {
  readonly identityId: string;
  readonly correlationId: string;
}

export class RequestEmailVerificationService {
  constructor(private readonly deps: EmailVerificationServiceDependencies) {}

  async request(
    command: RequestEmailVerificationCommand,
  ): Promise<EmailVerificationNotificationCommand> {
    const identity = await requireIdentity(this.deps.identities, command.identityId);
    assertEmailVerificationAllowed(identity.status, Boolean(identity.primaryEmail.verifiedAt));

    return this.createChallenge({
      identityId: identity.id,
      recipientEmail: identity.primaryEmail.email,
      correlationId: command.correlationId,
      eventType: 'EMAIL_VERIFICATION_REQUESTED',
    });
  }

  private async createChallenge(input: {
    readonly identityId: string;
    readonly recipientEmail: string;
    readonly correlationId: string;
    readonly eventType: 'EMAIL_VERIFICATION_REQUESTED';
  }): Promise<EmailVerificationNotificationCommand> {
    return createVerificationChallenge(this.deps, input);
  }
}

export class ResendEmailVerificationService {
  constructor(private readonly deps: EmailVerificationServiceDependencies) {}

  async resend(
    command: ResendEmailVerificationCommand,
  ): Promise<EmailVerificationNotificationCommand> {
    const identity = await requireIdentity(this.deps.identities, command.identityId);
    assertEmailVerificationAllowed(identity.status, Boolean(identity.primaryEmail.verifiedAt));

    const now = this.deps.clock.now();
    const latest = await this.deps.tokens.findLatestEmailVerificationToken(identity.id);
    const requestWindowStart = addSeconds(now, -this.deps.policy.requestWindowSeconds);
    const requestsInWindow = await this.deps.tokens.countEmailVerificationTokensCreatedSince({
      identityId: identity.id,
      since: requestWindowStart,
    });

    if (requestsInWindow >= this.deps.policy.maximumRequestsPerWindow) {
      await this.deps.securityEvents.record({
        identityId: identity.id,
        eventType: 'EMAIL_VERIFICATION_FAILED',
        occurredAt: now,
        correlationId: command.correlationId,
        metadata: {
          reason: 'RESEND_RATE_LIMITED',
        },
      });
      throw new IdentityApplicationError(
        'EMAIL_VERIFICATION_REQUEST_THROTTLED',
        'Email verification resend is throttled.',
      );
    }

    if (latest?.status === 'PENDING' && latest.expiresAt > now) {
      const nextAllowedAt = addSeconds(
        latest.createdAt,
        this.deps.policy.minimumResendDelaySeconds,
      );

      if (nextAllowedAt > now) {
        await this.deps.securityEvents.record({
          identityId: identity.id,
          eventType: 'EMAIL_VERIFICATION_FAILED',
          occurredAt: now,
          correlationId: command.correlationId,
          metadata: {
            reason: 'RESEND_THROTTLED',
          },
        });
        throw new IdentityApplicationError(
          'EMAIL_VERIFICATION_REQUEST_THROTTLED',
          'Email verification resend is throttled.',
        );
      }
    }

    return createVerificationChallenge(this.deps, {
      identityId: identity.id,
      recipientEmail: identity.primaryEmail.email,
      correlationId: command.correlationId,
      eventType: 'EMAIL_VERIFICATION_RESENT',
    });
  }
}

export class CompleteEmailVerificationService {
  constructor(private readonly deps: EmailVerificationServiceDependencies) {}

  async complete(command: CompleteEmailVerificationCommand): Promise<void> {
    const now = this.deps.clock.now();
    const tokenHash = await this.deps.tokenHasher.hash(command.rawToken);

    try {
      await this.deps.unitOfWork.transaction(async (repositories) => {
        const consumed = await repositories.tokens.consumeEmailVerificationToken({
          tokenId: command.tokenId,
          tokenHash,
          consumedAt: now,
        });

        if (consumed.outcome === 'NOT_FOUND') {
          await recordVerificationFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_NOT_FOUND',
          );
          throw new IdentityApplicationError(
            'EMAIL_VERIFICATION_TOKEN_INVALID',
            'Email verification token is invalid.',
          );
        }

        if (consumed.outcome === 'EXPIRED') {
          await recordVerificationFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_EXPIRED',
          );
          throw new IdentityApplicationError(
            'EMAIL_VERIFICATION_TOKEN_EXPIRED',
            'Email verification token has expired.',
          );
        }

        if (consumed.outcome === 'ALREADY_CONSUMED_OR_REVOKED') {
          await recordVerificationFailure(
            this.deps.securityEvents,
            null,
            command.correlationId,
            now,
            'TOKEN_CONSUMED',
          );
          throw new IdentityApplicationError(
            'EMAIL_VERIFICATION_TOKEN_CONSUMED',
            'Email verification token has already been used.',
          );
        }

        const identity = await repositories.identities.findById(consumed.identityId);

        if (!identity || identity.status === 'SUSPENDED') {
          await recordVerificationFailure(
            this.deps.securityEvents,
            consumed.identityId,
            command.correlationId,
            now,
            'IDENTITY_NOT_ALLOWED',
          );
          throw new IdentityApplicationError(
            'EMAIL_VERIFICATION_NOT_ALLOWED',
            'Email verification is not allowed.',
          );
        }

        if (identity.primaryEmail.verifiedAt) {
          throw new IdentityApplicationError(
            'EMAIL_ALREADY_VERIFIED',
            'Email is already verified.',
          );
        }

        const verified = await repositories.identities.markPrimaryEmailVerified(
          consumed.identityId,
          now,
        );

        if (!verified) {
          throw new IdentityApplicationError(
            'EMAIL_VERIFICATION_TRANSACTION_FAILED',
            'Email verification transaction failed.',
          );
        }

        await repositories.tokens.revokePendingEmailVerificationTokens({
          identityId: consumed.identityId,
          revokedAt: now,
          exceptTokenId: command.tokenId,
        });
        await this.deps.securityEvents.record({
          identityId: consumed.identityId,
          eventType: 'EMAIL_VERIFIED',
          occurredAt: now,
          correlationId: command.correlationId,
        });
      });
    } catch (error) {
      if (error instanceof IdentityApplicationError) {
        throw error;
      }

      throw new IdentityApplicationError(
        'EMAIL_VERIFICATION_TRANSACTION_FAILED',
        'Email verification transaction failed.',
      );
    }
  }
}

async function createVerificationChallenge(
  deps: EmailVerificationServiceDependencies,
  input: {
    readonly identityId: string;
    readonly recipientEmail: string;
    readonly correlationId: string;
    readonly eventType: 'EMAIL_VERIFICATION_REQUESTED' | 'EMAIL_VERIFICATION_RESENT';
  },
): Promise<EmailVerificationNotificationCommand> {
  const now = deps.clock.now();
  const rawToken = deps.tokenGenerator.opaqueToken();
  const tokenRecordId = deps.tokenGenerator.uuid();
  const tokenHash = await deps.tokenHasher.hash(rawToken.rawToken);
  const expiresAt = addSeconds(now, deps.tokenTtlSeconds);

  try {
    await deps.unitOfWork.transaction(async (repositories) => {
      if (deps.policy.supersedePreviousTokens) {
        await repositories.tokens.revokePendingEmailVerificationTokens({
          identityId: input.identityId,
          revokedAt: now,
        });
      }

      await repositories.tokens.createEmailVerificationToken({
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
      'EMAIL_VERIFICATION_TRANSACTION_FAILED',
      'Email verification transaction failed.',
    );
  }

  return {
    recipientEmail: input.recipientEmail,
    template: 'identity.email_verification',
    locale: deps.policy.locale,
    rawVerificationToken: rawToken.rawToken,
    verificationTokenId: rawToken.tokenId,
    expiresAt,
    correlationId: input.correlationId,
  };
}

async function requireIdentity(identities: IdentityRepository, identityId: string) {
  const identity = await identities.findById(identityId);

  if (!identity) {
    throw new IdentityApplicationError(
      'EMAIL_VERIFICATION_NOT_ALLOWED',
      'Email verification is not allowed.',
    );
  }

  return identity;
}

function assertEmailVerificationAllowed(status: string, alreadyVerified: boolean): void {
  if (alreadyVerified) {
    throw new IdentityApplicationError('EMAIL_ALREADY_VERIFIED', 'Email is already verified.');
  }

  if (status === 'SUSPENDED' || status === 'CLOSED') {
    throw new IdentityApplicationError(
      'EMAIL_VERIFICATION_NOT_ALLOWED',
      'Email verification is not allowed.',
    );
  }
}

async function recordVerificationFailure(
  securityEvents: SecurityEventRecorder,
  identityId: string | null,
  correlationId: string,
  occurredAt: Date,
  reason: string,
): Promise<void> {
  await securityEvents.record({
    identityId,
    eventType:
      reason === 'TOKEN_EXPIRED' ? 'EMAIL_VERIFICATION_EXPIRED' : 'EMAIL_VERIFICATION_FAILED',
    occurredAt,
    correlationId,
    metadata: {
      reason,
    },
  });
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
