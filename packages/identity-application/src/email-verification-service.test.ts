import { beforeEach, describe, expect, it } from 'vitest';

import type {
  IdentityRepository,
  IdentitySessionRepository,
  IdentityTokenRepository,
  OneTimeTokenConsumptionInput,
  OneTimeTokenConsumptionResult,
  PersistedIdentityReadModel,
  PersistedOneTimeTokenReadModel,
  TrustedDeviceRepository,
} from '@seneve/domain-identity';

import type {
  IdentityApplicationRepositories,
  IdentityUnitOfWork,
  SecurityEventInput,
} from './contracts.js';
import {
  CompleteEmailVerificationService,
  RequestEmailVerificationService,
  ResendEmailVerificationService,
} from './email-verification-service.js';

const now = new Date('2026-07-15T00:00:00.000Z');
const later = new Date('2026-07-16T00:00:00.000Z');

describe('Email verification application services', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('requests verification, supersedes previous pending tokens, and returns an ephemeral notification command', async () => {
    const notification = await fixture.requestService.request({
      identityId: 'identity-1',
      correlationId: 'correlation-1',
    });

    expect(fixture.tokens.revocations).toEqual([
      { identityId: 'identity-1', exceptTokenId: undefined },
    ]);
    expect(fixture.tokens.created[0]).toMatchObject({
      identityId: 'identity-1',
      tokenId: 'token-id-1',
      tokenHash: 'hmac-sha256:raw-token-1',
    });
    expect(fixture.tokens.created[0]?.tokenHash).not.toBe('raw-token-1');
    expect(notification).toEqual({
      recipientEmail: 'ada@example.com',
      template: 'identity.email_verification',
      locale: 'en',
      rawVerificationToken: 'raw-token-1',
      verificationTokenId: 'token-id-1',
      expiresAt: later,
      correlationId: 'correlation-1',
    });
  });

  it('rejects already verified and suspended identities', async () => {
    fixture.identities.records.set('verified-identity', {
      ...pendingIdentity(),
      id: 'verified-identity',
      primaryEmail: { ...pendingIdentity().primaryEmail, verifiedAt: now },
    });
    await expect(
      fixture.requestService.request({
        identityId: 'verified-identity',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_VERIFIED' });

    fixture.identities.records.set('suspended-identity', {
      ...pendingIdentity(),
      id: 'suspended-identity',
      status: 'SUSPENDED',
    });
    await expect(
      fixture.requestService.request({
        identityId: 'suspended-identity',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_NOT_ALLOWED' });
  });

  it('throttles resend when an active token was created too recently', async () => {
    fixture.tokens.latest = {
      id: 'record-1',
      identityId: 'identity-1',
      tokenId: 'token-id-old',
      status: 'PENDING',
      createdAt: now,
      expiresAt: later,
      consumedAt: null,
    };

    await expect(
      fixture.resendService.resend({ identityId: 'identity-1', correlationId: 'correlation-1' }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUEST_THROTTLED' });
    expect(fixture.events.events).toContainEqual(
      expect.objectContaining({
        eventType: 'EMAIL_VERIFICATION_FAILED',
        metadata: { reason: 'RESEND_THROTTLED' },
      }),
    );
  });

  it('throttles resend after the configured request-window limit', async () => {
    fixture.tokens.createdSinceCount = 3;

    await expect(
      fixture.resendService.resend({ identityId: 'identity-1', correlationId: 'correlation-1' }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUEST_THROTTLED' });
    expect(fixture.events.events).toContainEqual(
      expect.objectContaining({
        eventType: 'EMAIL_VERIFICATION_FAILED',
        metadata: { reason: 'RESEND_RATE_LIMITED' },
      }),
    );
  });

  it('allows resend after the configured delay and supersedes obsolete tokens', async () => {
    fixture.tokens.latest = {
      id: 'record-1',
      identityId: 'identity-1',
      tokenId: 'token-id-old',
      status: 'PENDING',
      createdAt: new Date('2026-07-14T23:50:00.000Z'),
      expiresAt: later,
      consumedAt: null,
    };

    const notification = await fixture.resendService.resend({
      identityId: 'identity-1',
      correlationId: 'correlation-1',
    });

    expect(notification.rawVerificationToken).toBe('raw-token-1');
    expect(fixture.events.events.map((event) => event.eventType)).toContain(
      'EMAIL_VERIFICATION_RESENT',
    );
  });

  it('completes verification atomically and revokes obsolete tokens', async () => {
    fixture.tokens.consumeResult = { outcome: 'CONSUMED', identityId: 'identity-1' };

    await fixture.completeService.complete({
      tokenId: 'token-id-1',
      rawToken: 'raw-token-1',
      correlationId: 'correlation-1',
    });

    expect(fixture.tokens.consumptions).toEqual([
      {
        tokenId: 'token-id-1',
        tokenHash: 'hmac-sha256:raw-token-1',
        consumedAt: now,
      },
    ]);
    expect(fixture.identities.verified).toEqual(['identity-1']);
    expect(fixture.tokens.revocations).toEqual([
      { identityId: 'identity-1', exceptTokenId: 'token-id-1' },
    ]);
    expect(fixture.events.events.map((event) => event.eventType)).toContain('EMAIL_VERIFIED');
  });

  it('maps invalid, expired and consumed token outcomes to stable errors', async () => {
    fixture.tokens.consumeResult = { outcome: 'NOT_FOUND' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'missing',
        rawToken: 'raw-token',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_TOKEN_INVALID' });

    fixture.tokens.consumeResult = { outcome: 'EXPIRED' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'expired',
        rawToken: 'raw-token',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_TOKEN_EXPIRED' });

    fixture.tokens.consumeResult = { outcome: 'ALREADY_CONSUMED_OR_REVOKED' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'used',
        rawToken: 'raw-token',
        correlationId: 'correlation-3',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_TOKEN_CONSUMED' });
  });

  it('does not leave a consumed token with an unverified email when verification fails', async () => {
    fixture.tokens.consumeResult = { outcome: 'CONSUMED', identityId: 'identity-1' };
    fixture.identities.failVerification = true;

    await expect(
      fixture.completeService.complete({
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_TRANSACTION_FAILED' });
    expect(fixture.unitOfWork.rollbackCount).toBe(1);
  });
});

interface Fixture {
  readonly requestService: RequestEmailVerificationService;
  readonly completeService: CompleteEmailVerificationService;
  readonly resendService: ResendEmailVerificationService;
  readonly identities: InMemoryIdentityRepository;
  readonly tokens: InMemoryTokenRepository;
  readonly events: InMemorySecurityEventRecorder;
  readonly unitOfWork: InMemoryUnitOfWork;
}

function createFixture(): Fixture {
  const identities = new InMemoryIdentityRepository();
  const tokens = new InMemoryTokenRepository();
  const events = new InMemorySecurityEventRecorder();
  const repositories = {
    identities,
    sessions: new EmptySessionRepository(),
    tokens,
    devices: new EmptyDeviceRepository(),
  };
  const unitOfWork = new InMemoryUnitOfWork(repositories);
  const deps = {
    unitOfWork,
    identities,
    tokens,
    tokenGenerator: new DeterministicTokenGenerator(),
    tokenHasher: { hash: async (rawToken: string) => `hmac-sha256:${rawToken}` },
    securityEvents: events,
    clock: { now: () => now },
    tokenTtlSeconds: 86_400,
    policy: {
      minimumResendDelaySeconds: 300,
      maximumRequestsPerWindow: 3,
      requestWindowSeconds: 3600,
      supersedePreviousTokens: true,
      locale: 'en',
    },
  };

  identities.records.set('identity-1', pendingIdentity());

  return {
    requestService: new RequestEmailVerificationService(deps),
    completeService: new CompleteEmailVerificationService(deps),
    resendService: new ResendEmailVerificationService(deps),
    identities,
    tokens,
    events,
    unitOfWork,
  };
}

function pendingIdentity(): PersistedIdentityReadModel {
  return {
    id: 'identity-1',
    status: 'PENDING_EMAIL_VERIFICATION',
    normalizedLoginEmail: 'ada@example.com',
    version: 1,
    createdAt: now,
    updatedAt: now,
    suspendedAt: null,
    closedAt: null,
    user: { id: 'user-1', displayName: 'Ada Lovelace' },
    primaryEmail: {
      id: 'email-1',
      email: 'ada@example.com',
      normalizedEmail: 'ada@example.com',
      verifiedAt: null,
    },
    activeCredentials: [],
  };
}

class InMemoryUnitOfWork implements IdentityUnitOfWork {
  rollbackCount = 0;

  constructor(private readonly repositories: IdentityApplicationRepositories) {}

  async transaction<T>(
    work: (repositories: IdentityApplicationRepositories) => Promise<T>,
  ): Promise<T> {
    try {
      return await work(this.repositories);
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    }
  }
}

class InMemoryIdentityRepository implements IdentityRepository {
  readonly records = new Map<string, PersistedIdentityReadModel>();
  readonly verified: string[] = [];
  failVerification = false;

  async createRegisteredIdentity(): Promise<void> {}

  async findById(identityId: string): Promise<PersistedIdentityReadModel | null> {
    return this.records.get(identityId) ?? null;
  }

  async findByNormalizedLoginEmail(): Promise<PersistedIdentityReadModel | null> {
    return null;
  }

  async markPrimaryEmailVerified(identityId: string): Promise<boolean> {
    if (this.failVerification) {
      return false;
    }

    this.verified.push(identityId);
    return true;
  }

  async replacePasswordCredential(): Promise<boolean> {
    return true;
  }

  async suspendIdentityAndRevokeSessions(): Promise<boolean> {
    return true;
  }
}

class InMemoryTokenRepository implements IdentityTokenRepository {
  readonly created: Parameters<IdentityTokenRepository['createEmailVerificationToken']>[0][] = [];
  readonly revocations: { identityId: string; exceptTokenId?: string }[] = [];
  readonly consumptions: OneTimeTokenConsumptionInput[] = [];
  latest: PersistedOneTimeTokenReadModel | null = null;
  consumeResult: OneTimeTokenConsumptionResult = { outcome: 'NOT_FOUND' };
  createdSinceCount = 0;

  async createEmailVerificationToken(
    input: Parameters<IdentityTokenRepository['createEmailVerificationToken']>[0],
  ): Promise<void> {
    this.created.push(input);
  }

  async findLatestEmailVerificationToken(): Promise<PersistedOneTimeTokenReadModel | null> {
    return this.latest;
  }

  async countEmailVerificationTokensCreatedSince(): Promise<number> {
    return this.createdSinceCount;
  }

  async revokePendingEmailVerificationTokens(input: {
    readonly identityId: string;
    readonly exceptTokenId?: string;
  }): Promise<number> {
    this.revocations.push({ identityId: input.identityId, exceptTokenId: input.exceptTokenId });
    return 1;
  }

  async consumeEmailVerificationToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult> {
    this.consumptions.push(input);
    return this.consumeResult;
  }

  async createPasswordResetToken(): Promise<void> {}

  async findLatestPasswordResetToken(): Promise<PersistedOneTimeTokenReadModel | null> {
    return null;
  }

  async countPasswordResetTokensCreatedSince(): Promise<number> {
    return 0;
  }

  async revokePendingPasswordResetTokens(): Promise<number> {
    return 0;
  }

  async consumePasswordResetToken(): Promise<OneTimeTokenConsumptionResult> {
    return { outcome: 'NOT_FOUND' };
  }
}

class InMemorySecurityEventRecorder {
  readonly events: SecurityEventInput[] = [];

  async record(input: SecurityEventInput): Promise<void> {
    this.events.push(input);
  }
}

class DeterministicTokenGenerator {
  private tokenCount = 0;
  private uuidCount = 0;

  uuid(): string {
    this.uuidCount += 1;
    return `uuid-${this.uuidCount}`;
  }

  opaqueToken() {
    this.tokenCount += 1;
    return {
      tokenId: `token-id-${this.tokenCount}`,
      rawToken: `raw-token-${this.tokenCount}`,
    };
  }
}

class EmptySessionRepository implements IdentitySessionRepository {
  async createSessionWithRefreshToken(): Promise<void> {}
  async findSessionById() {
    return null;
  }
  async listActiveSessions() {
    return [];
  }
  async countActiveSessions() {
    return 0;
  }
  async rotateRefreshToken() {
    return { outcome: 'NOT_FOUND' as const };
  }
  async touchSession() {
    return false;
  }
  async expireSessions() {
    return 0;
  }
  async revokeSession() {
    return false;
  }
  async revokeAllSessionsForIdentity() {
    return 0;
  }
  async revokeAllSessionsAndRefreshTokensForIdentity() {
    return { sessionsRevoked: 0, refreshTokensRevoked: 0 };
  }
  async revokeAllSessionsExcept() {
    return 0;
  }
}

class EmptyDeviceRepository implements TrustedDeviceRepository {
  async findTrustedDevice() {
    return null;
  }
  async createTrustedDevice(input: {
    readonly id: string;
    readonly identityId: string;
    readonly fingerprintHash: string;
    readonly displayName: string;
    readonly firstSeenAt: Date;
  }) {
    return {
      ...input,
      status: 'TRUSTED' as const,
      lastActivityAt: input.firstSeenAt,
      revokedAt: null,
    };
  }
  async touchTrustedDevice() {
    return false;
  }
  async revokeTrustedDevice() {
    return false;
  }
}
