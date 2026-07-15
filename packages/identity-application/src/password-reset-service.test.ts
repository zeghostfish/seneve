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
  CompletePasswordResetService,
  RequestPasswordResetService,
} from './password-reset-service.js';

const now = new Date('2026-07-15T00:00:00.000Z');
const later = new Date('2026-07-15T01:00:00.000Z');

describe('Password reset application services', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('accepts eligible reset requests and returns only an ephemeral notification command', async () => {
    const result = await fixture.requestService.request({
      email: ' ADA@Example.com ',
      correlationId: 'correlation-1',
    });

    expect(result.accepted).toBe(true);
    expect(result.notification).toEqual({
      recipientEmail: 'ada@example.com',
      template: 'identity.password_reset',
      locale: 'en',
      rawResetToken: 'raw-token-1',
      resetTokenId: 'token-id-1',
      expiresAt: later,
      correlationId: 'correlation-1',
    });
    expect(fixture.tokens.created[0]).toMatchObject({
      identityId: 'identity-1',
      tokenId: 'token-id-1',
      tokenHash: 'hmac-sha256:raw-token-1',
    });
    expect(fixture.tokens.created[0]?.tokenHash).not.toBe('raw-token-1');
    expect(fixture.tokens.revocations).toEqual([
      { identityId: 'identity-1', exceptTokenId: undefined },
    ]);
  });

  it('returns the same accepted shape for unknown and ineligible identities', async () => {
    await expect(
      fixture.requestService.request({
        email: 'unknown@example.com',
        correlationId: 'correlation-1',
      }),
    ).resolves.toEqual({ accepted: true, notification: null });
    expect(fixture.passwordHasher.equivalentHashCount).toBe(1);

    fixture.identities.records.set('suspended-identity', {
      ...pendingIdentity(),
      id: 'suspended-identity',
      status: 'SUSPENDED',
      normalizedLoginEmail: 'suspended@example.com',
      primaryEmail: {
        ...pendingIdentity().primaryEmail,
        email: 'suspended@example.com',
        normalizedEmail: 'suspended@example.com',
      },
    });
    await expect(
      fixture.requestService.request({
        email: 'suspended@example.com',
        correlationId: 'correlation-2',
      }),
    ).resolves.toEqual({ accepted: true, notification: null });
  });

  it('throttles reset requests by minimum delay and request window', async () => {
    fixture.tokens.latest = {
      id: 'record-1',
      identityId: 'identity-1',
      tokenId: 'old-token-id',
      status: 'PENDING',
      createdAt: now,
      expiresAt: later,
      consumedAt: null,
    };

    await expect(
      fixture.requestService.request({
        email: 'ada@example.com',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_REQUEST_THROTTLED' });

    fixture.tokens.latest = null;
    fixture.tokens.createdSinceCount = 3;
    await expect(
      fixture.requestService.request({
        email: 'ada@example.com',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_REQUEST_THROTTLED' });
  });

  it('completes reset by replacing the credential and revoking sessions and refresh tokens', async () => {
    fixture.tokens.consumeResult = { outcome: 'CONSUMED', identityId: 'identity-1' };

    await fixture.completeService.complete({
      tokenId: 'token-id-1',
      rawToken: 'raw-token-1',
      newPlaintextPassword: 'NewSecurePass1!',
      correlationId: 'correlation-1',
    });

    expect(fixture.tokens.consumptions).toEqual([
      {
        tokenId: 'token-id-1',
        tokenHash: 'hmac-sha256:raw-token-1',
        consumedAt: now,
      },
    ]);
    expect(fixture.identities.replacements).toEqual([
      {
        identityId: 'identity-1',
        newCredentialId: 'uuid-1',
        passwordHash: 'argon2id:NewSecurePass1!',
        replacedAt: now,
      },
    ]);
    expect(fixture.sessions.revokedAllWithRefreshTokens).toEqual([
      { identityId: 'identity-1', reason: 'PASSWORD_RESET' },
    ]);
    expect(fixture.events.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'PASSWORD_CREDENTIAL_REPLACED',
        'SESSIONS_REVOKED_AFTER_PASSWORD_RESET',
        'PASSWORD_RESET_COMPLETED',
      ]),
    );
  });

  it('maps invalid, expired and consumed tokens to stable reset errors', async () => {
    fixture.tokens.consumeResult = { outcome: 'NOT_FOUND' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'missing',
        rawToken: 'raw-token',
        newPlaintextPassword: 'NewSecurePass1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_TOKEN_INVALID' });

    fixture.tokens.consumeResult = { outcome: 'EXPIRED' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'expired',
        rawToken: 'raw-token',
        newPlaintextPassword: 'NewSecurePass1!',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_TOKEN_EXPIRED' });

    fixture.tokens.consumeResult = { outcome: 'ALREADY_CONSUMED_OR_REVOKED' };
    await expect(
      fixture.completeService.complete({
        tokenId: 'used',
        rawToken: 'raw-token',
        newPlaintextPassword: 'NewSecurePass1!',
        correlationId: 'correlation-3',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_TOKEN_CONSUMED' });
  });

  it('rejects password-policy failures before consuming the reset token', async () => {
    await expect(
      fixture.completeService.complete({
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        newPlaintextPassword: 'short',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_POLICY_VIOLATION' });
    expect(fixture.tokens.consumptions).toEqual([]);
  });

  it('rejects current password reuse when the policy is enabled', async () => {
    fixture.tokens.consumeResult = { outcome: 'CONSUMED', identityId: 'identity-1' };

    await expect(
      fixture.completeService.complete({
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        newPlaintextPassword: 'OldSecurePass1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_REUSE_NOT_ALLOWED' });
  });

  it('rolls back when credential replacement fails after token consumption', async () => {
    fixture.tokens.consumeResult = { outcome: 'CONSUMED', identityId: 'identity-1' };
    fixture.identities.failReplacement = true;

    await expect(
      fixture.completeService.complete({
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        newPlaintextPassword: 'NewSecurePass1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_TRANSACTION_FAILED' });
    expect(fixture.unitOfWork.rollbackCount).toBe(1);
  });
});

interface Fixture {
  readonly requestService: RequestPasswordResetService;
  readonly completeService: CompletePasswordResetService;
  readonly identities: InMemoryIdentityRepository;
  readonly sessions: InMemorySessionRepository;
  readonly tokens: InMemoryTokenRepository;
  readonly events: InMemorySecurityEventRecorder;
  readonly passwordHasher: DeterministicPasswordHasher;
  readonly unitOfWork: InMemoryUnitOfWork;
}

function createFixture(): Fixture {
  const identities = new InMemoryIdentityRepository();
  const sessions = new InMemorySessionRepository();
  const tokens = new InMemoryTokenRepository();
  const events = new InMemorySecurityEventRecorder();
  const passwordHasher = new DeterministicPasswordHasher();
  const repositories = {
    identities,
    sessions,
    tokens,
    devices: new EmptyDeviceRepository(),
  };
  const unitOfWork = new InMemoryUnitOfWork(repositories);
  const deps = {
    unitOfWork,
    identities,
    tokens,
    passwordHasher,
    tokenGenerator: new DeterministicTokenGenerator(),
    tokenHasher: { hash: async (rawToken: string) => `hmac-sha256:${rawToken}` },
    securityEvents: events,
    clock: { now: () => now },
    tokenTtlSeconds: 3600,
    policy: {
      minimumRequestDelaySeconds: 300,
      maximumRequestsPerWindow: 3,
      requestWindowSeconds: 3600,
      supersedePreviousTokens: true,
      preventPasswordReuseCount: 1,
      locale: 'en',
    },
  };

  identities.records.set('identity-1', pendingIdentity());

  return {
    requestService: new RequestPasswordResetService(deps),
    completeService: new CompletePasswordResetService(deps),
    identities,
    sessions,
    tokens,
    events,
    passwordHasher,
    unitOfWork,
  };
}

function pendingIdentity(): PersistedIdentityReadModel {
  return {
    id: 'identity-1',
    status: 'ACTIVE',
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
      verifiedAt: now,
    },
    activeCredentials: [
      {
        id: 'credential-1',
        type: 'PASSWORD',
        status: 'ACTIVE',
        secretHash: 'argon2id:OldSecurePass1!',
      },
    ],
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
  readonly replacements: {
    identityId: string;
    newCredentialId: string;
    passwordHash: string;
    replacedAt: Date;
  }[] = [];
  failReplacement = false;

  async createRegisteredIdentity(): Promise<void> {}

  async findById(identityId: string): Promise<PersistedIdentityReadModel | null> {
    return this.records.get(identityId) ?? null;
  }

  async findByNormalizedLoginEmail(
    normalizedEmail: string,
  ): Promise<PersistedIdentityReadModel | null> {
    return (
      [...this.records.values()].find(
        (identity) => identity.normalizedLoginEmail === normalizedEmail,
      ) ?? null
    );
  }

  async markPrimaryEmailVerified(): Promise<boolean> {
    return true;
  }

  async replacePasswordCredential(input: {
    readonly identityId: string;
    readonly newCredentialId: string;
    readonly passwordHash: string;
    readonly replacedAt: Date;
  }): Promise<boolean> {
    if (this.failReplacement) {
      return false;
    }

    this.replacements.push(input);
    return true;
  }

  async suspendIdentityAndRevokeSessions(): Promise<boolean> {
    return true;
  }
}

class InMemorySessionRepository implements IdentitySessionRepository {
  readonly revokedAllWithRefreshTokens: { identityId: string; reason: string }[] = [];

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
  async revokeAllSessionsAndRefreshTokensForIdentity(
    identityId: string,
    _revokedAt: Date,
    reason: string,
  ) {
    this.revokedAllWithRefreshTokens.push({ identityId, reason });
    return { sessionsRevoked: 2, refreshTokensRevoked: 3 };
  }
  async revokeAllSessionsExcept() {
    return 0;
  }
}

class InMemoryTokenRepository implements IdentityTokenRepository {
  readonly created: Parameters<IdentityTokenRepository['createPasswordResetToken']>[0][] = [];
  readonly revocations: { identityId: string; exceptTokenId?: string }[] = [];
  readonly consumptions: OneTimeTokenConsumptionInput[] = [];
  latest: PersistedOneTimeTokenReadModel | null = null;
  createdSinceCount = 0;
  consumeResult: OneTimeTokenConsumptionResult = { outcome: 'NOT_FOUND' };

  async createEmailVerificationToken(): Promise<void> {}
  async findLatestEmailVerificationToken(): Promise<PersistedOneTimeTokenReadModel | null> {
    return null;
  }
  async countEmailVerificationTokensCreatedSince(): Promise<number> {
    return 0;
  }
  async revokePendingEmailVerificationTokens(): Promise<number> {
    return 0;
  }
  async consumeEmailVerificationToken(): Promise<OneTimeTokenConsumptionResult> {
    return { outcome: 'NOT_FOUND' };
  }

  async createPasswordResetToken(
    input: Parameters<IdentityTokenRepository['createPasswordResetToken']>[0],
  ): Promise<void> {
    this.created.push(input);
  }

  async findLatestPasswordResetToken(): Promise<PersistedOneTimeTokenReadModel | null> {
    return this.latest;
  }

  async countPasswordResetTokensCreatedSince(): Promise<number> {
    return this.createdSinceCount;
  }

  async revokePendingPasswordResetTokens(input: {
    readonly identityId: string;
    readonly exceptTokenId?: string;
  }): Promise<number> {
    this.revocations.push({ identityId: input.identityId, exceptTokenId: input.exceptTokenId });
    return 1;
  }

  async consumePasswordResetToken(
    input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult> {
    this.consumptions.push(input);
    return this.consumeResult;
  }
}

class InMemorySecurityEventRecorder {
  readonly events: SecurityEventInput[] = [];

  async record(input: SecurityEventInput): Promise<void> {
    this.events.push(input);
  }
}

class DeterministicPasswordHasher {
  equivalentHashCount = 0;

  async hash(plaintext: string): Promise<string> {
    return `argon2id:${plaintext}`;
  }

  async verify(input: { readonly plaintext: string; readonly hash: string }): Promise<boolean> {
    return input.hash === `argon2id:${input.plaintext}`;
  }

  async equivalentHash(): Promise<void> {
    this.equivalentHashCount += 1;
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
      id: input.id,
      identityId: input.identityId,
      fingerprintHash: input.fingerprintHash,
      displayName: input.displayName,
      status: 'TRUSTED' as const,
      firstSeenAt: input.firstSeenAt,
      lastActivityAt: input.firstSeenAt,
      revokedAt: null,
    };
  }
  async touchTrustedDevice() {
    return true;
  }
  async revokeTrustedDevice() {
    return true;
  }
}
