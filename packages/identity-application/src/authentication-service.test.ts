import { beforeEach, describe, expect, it } from 'vitest';

import {
  AuthenticationService,
  type AuthenticatedSessionResult,
} from './authentication-service.js';
import type {
  Clock,
  IdentityApplicationRepositories,
  IdentityUnitOfWork,
  SecurityEventInput,
} from './contracts.js';
import type {
  CreateSessionWithRefreshTokenInput,
  IdentityRepository,
  IdentitySessionRepository,
  IdentityTokenRepository,
  OneTimeTokenConsumptionInput,
  OneTimeTokenConsumptionResult,
  PersistedIdentityReadModel,
  PersistedIdentityRegistration,
  PersistedSessionReadModel,
  RefreshTokenRotationResult,
  RotateRefreshTokenInput,
} from '@seneve/domain-identity';

const now = new Date('2026-07-14T00:00:00.000Z');

describe('AuthenticationService', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('registers an identity atomically and returns only the raw verification token for notification', async () => {
    const result = await fixture.service.register({
      email: ' Ada@Example.COM ',
      displayName: 'Ada Lovelace',
      plaintextPassword: 'CorrectHorse1!',
      correlationId: 'correlation-1',
    });

    expect(result).toEqual({
      identityId: 'uuid-1',
      userId: 'uuid-2',
      emailVerification: {
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        expiresAt: new Date('2026-07-15T00:00:00.000Z'),
      },
    });
    expect(fixture.identities.created[0]).toMatchObject({
      normalizedEmail: 'ada@example.com',
      passwordHash: '$argon2id$hashed-CorrectHorse1!',
    });
    expect(fixture.tokens.emailVerificationTokens[0]).toMatchObject({
      tokenHash: 'hmac-sha256:raw-token-1',
    });
    expect(fixture.tokens.emailVerificationTokens[0]?.tokenHash).not.toBe('raw-token-1');
  });

  it('maps duplicate registration to a stable application error', async () => {
    fixture.identities.failCreateWith = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });

    await expect(
      fixture.service.register({
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        plaintextPassword: 'CorrectHorse1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({
      code: 'REGISTRATION_CONFLICT',
    });
  });

  it('rejects weak passwords before persistence', async () => {
    await expect(
      fixture.service.register({
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        plaintextPassword: 'weak',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({
      code: 'PASSWORD_POLICY_VIOLATION',
    });
    expect(fixture.identities.created).toHaveLength(0);
  });

  it('logs in verified identities, creates a session, and stores only hashed refresh tokens', async () => {
    fixture.identities.records.set('ada@example.com', verifiedIdentity());

    const result = await fixture.service.login({
      email: 'ADA@example.com',
      plaintextPassword: 'CorrectHorse1!',
      correlationId: 'correlation-1',
    });

    expect(result).toMatchObject<AuthenticatedSessionResult>({
      identityId: 'identity-1',
      sessionId: 'uuid-1',
      accessToken: 'access-token:identity-1:uuid-1',
      accessTokenExpiresAt: new Date('2026-07-14T00:15:00.000Z'),
      refreshToken: {
        tokenId: 'token-id-1',
        rawToken: 'raw-token-1',
        expiresAt: new Date('2026-08-13T00:00:00.000Z'),
      },
    });
    expect(fixture.sessions.created[0]?.refreshTokenHash).toBe('hmac-sha256:raw-token-1');
    expect(fixture.events.events.map((event) => event.eventType)).toContain('LOGIN_SUCCEEDED');
  });

  it('uses generic invalid credentials for missing identity and password mismatch', async () => {
    await expect(
      fixture.service.login({
        email: 'missing@example.com',
        plaintextPassword: 'CorrectHorse1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fixture.passwordHasher.equivalentHashCalls).toBe(1);

    fixture.identities.records.set('ada@example.com', verifiedIdentity());
    fixture.passwordHasher.valid = false;

    await expect(
      fixture.service.login({
        email: 'ada@example.com',
        plaintextPassword: 'WrongHorse1!',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('blocks login for suspended or unverified identities', async () => {
    fixture.identities.records.set('ada@example.com', {
      ...verifiedIdentity(),
      status: 'SUSPENDED',
    });

    await expect(
      fixture.service.login({
        email: 'ada@example.com',
        plaintextPassword: 'CorrectHorse1!',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'IDENTITY_SUSPENDED' });

    fixture.identities.records.set('ada@example.com', {
      ...verifiedIdentity(),
      status: 'PENDING_EMAIL_VERIFICATION',
      primaryEmail: {
        ...verifiedIdentity().primaryEmail,
        verifiedAt: null,
      },
    });

    await expect(
      fixture.service.login({
        email: 'ada@example.com',
        plaintextPassword: 'CorrectHorse1!',
        correlationId: 'correlation-2',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
  });

  it('rotates refresh tokens and issues a replacement access token', async () => {
    fixture.identities.byId.set('identity-1', verifiedIdentity());
    fixture.sessions.records.set('session-1', {
      id: 'session-1',
      identityId: 'identity-1',
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      expiresAt: new Date('2026-08-13T00:00:00.000Z'),
      revokedAt: null,
    });
    fixture.sessions.rotationResult = {
      outcome: 'ROTATED',
      sessionId: 'session-1',
      familyId: 'family-1',
    };

    const result = await fixture.service.refresh({
      refreshTokenId: 'refresh-token-1',
      rawRefreshToken: 'raw-refresh',
      correlationId: 'correlation-1',
    });

    expect(fixture.sessions.rotations[0]).toMatchObject({
      currentRefreshTokenId: 'refresh-token-1',
      currentRefreshTokenHash: 'hmac-sha256:raw-refresh',
      nextRefreshTokenHash: 'hmac-sha256:raw-token-1',
    });
    expect(result).toMatchObject({
      identityId: 'identity-1',
      sessionId: 'session-1',
      accessToken: 'access-token:identity-1:session-1',
    });
  });

  it('maps refresh-token replay and records a security event', async () => {
    fixture.sessions.rotationResult = {
      outcome: 'REUSED',
      sessionId: 'session-1',
      familyId: 'family-1',
    };

    await expect(
      fixture.service.refresh({
        refreshTokenId: 'refresh-token-1',
        rawRefreshToken: 'raw-refresh',
        correlationId: 'correlation-1',
      }),
    ).rejects.toMatchObject({ code: 'REFRESH_TOKEN_REUSED' });
    expect(fixture.events.events).toContainEqual(
      expect.objectContaining({
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
      }),
    );
  });

  it('supports idempotent logout, all-session revocation, and suspension enforcement', async () => {
    await fixture.service.logout({ sessionId: 'session-1', correlationId: 'correlation-1' });
    await fixture.service.logout({ sessionId: 'session-1', correlationId: 'correlation-2' });
    await fixture.service.revokeAllSessions('identity-1', 'correlation-3');
    await fixture.service.suspendIdentity('identity-1', 'correlation-4');

    expect(fixture.sessions.revokedSessions).toEqual(['session-1', 'session-1']);
    expect(fixture.sessions.revokedIdentities).toEqual(['identity-1']);
    expect(fixture.identities.suspendedIdentities).toEqual(['identity-1']);
  });
});

interface Fixture {
  readonly service: AuthenticationService;
  readonly identities: InMemoryIdentityRepository;
  readonly sessions: InMemorySessionRepository;
  readonly tokens: InMemoryTokenRepository;
  readonly passwordHasher: TestPasswordHasher;
  readonly events: InMemorySecurityEventRecorder;
}

function createFixture(): Fixture {
  const identities = new InMemoryIdentityRepository();
  const sessions = new InMemorySessionRepository();
  const tokens = new InMemoryTokenRepository();
  const passwordHasher = new TestPasswordHasher();
  const events = new InMemorySecurityEventRecorder();
  const tokenGenerator = new DeterministicTokenGenerator();
  const clock: Clock = { now: () => now };
  const repositories = { identities, sessions, tokens };
  const unitOfWork: IdentityUnitOfWork = {
    transaction: async <T>(
      work: (transactionRepositories: IdentityApplicationRepositories) => Promise<T>,
    ) => work(repositories),
  };

  return {
    service: new AuthenticationService({
      unitOfWork,
      identities,
      sessions,
      tokens,
      passwordHasher,
      tokenGenerator,
      tokenHasher: {
        hash: async (rawToken) => `hmac-sha256:${rawToken}`,
      },
      accessTokenIssuer: {
        issue: async (claims) => `access-token:${claims.identityId}:${claims.sessionId}`,
      },
      securityEvents: events,
      clock,
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
      sessionTtlSeconds: 2_592_000,
      emailVerificationTokenTtlSeconds: 86_400,
    }),
    identities,
    sessions,
    tokens,
    passwordHasher,
    events,
  };
}

function verifiedIdentity(): PersistedIdentityReadModel {
  return {
    id: 'identity-1',
    status: 'ACTIVE',
    normalizedLoginEmail: 'ada@example.com',
    version: 1,
    createdAt: now,
    updatedAt: now,
    suspendedAt: null,
    closedAt: null,
    user: {
      id: 'user-1',
      displayName: 'Ada Lovelace',
    },
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
        secretHash: '$argon2id$hashed-CorrectHorse1!',
      },
    ],
  };
}

class InMemoryIdentityRepository implements IdentityRepository {
  readonly records = new Map<string, PersistedIdentityReadModel>();
  readonly byId = new Map<string, PersistedIdentityReadModel>();
  readonly created: PersistedIdentityRegistration[] = [];
  readonly suspendedIdentities: string[] = [];
  failCreateWith: unknown;

  async createRegisteredIdentity(input: PersistedIdentityRegistration): Promise<void> {
    if (this.failCreateWith) {
      throw this.failCreateWith;
    }

    this.created.push(input);
  }

  async findById(identityId: string): Promise<PersistedIdentityReadModel | null> {
    return this.byId.get(identityId) ?? null;
  }

  async findByNormalizedLoginEmail(
    normalizedEmail: string,
  ): Promise<PersistedIdentityReadModel | null> {
    return this.records.get(normalizedEmail) ?? null;
  }

  async markPrimaryEmailVerified(): Promise<boolean> {
    return true;
  }

  async suspendIdentityAndRevokeSessions(identityId: string): Promise<boolean> {
    this.suspendedIdentities.push(identityId);
    return true;
  }
}

class InMemorySessionRepository implements IdentitySessionRepository {
  readonly records = new Map<string, PersistedSessionReadModel>();
  readonly created: CreateSessionWithRefreshTokenInput[] = [];
  readonly rotations: RotateRefreshTokenInput[] = [];
  readonly revokedSessions: string[] = [];
  readonly revokedIdentities: string[] = [];
  rotationResult: RefreshTokenRotationResult = { outcome: 'NOT_FOUND' };

  async createSessionWithRefreshToken(input: CreateSessionWithRefreshTokenInput): Promise<void> {
    this.created.push(input);
  }

  async findSessionById(sessionId: string): Promise<PersistedSessionReadModel | null> {
    return this.records.get(sessionId) ?? null;
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRotationResult> {
    this.rotations.push(input);
    return this.rotationResult;
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    this.revokedSessions.push(sessionId);
    return true;
  }

  async revokeAllSessionsForIdentity(identityId: string): Promise<number> {
    this.revokedIdentities.push(identityId);
    return 1;
  }
}

class InMemoryTokenRepository implements IdentityTokenRepository {
  readonly emailVerificationTokens: Parameters<
    IdentityTokenRepository['createEmailVerificationToken']
  >[0][] = [];
  readonly passwordResetTokens: Parameters<
    IdentityTokenRepository['createPasswordResetToken']
  >[0][] = [];

  async createEmailVerificationToken(
    input: Parameters<IdentityTokenRepository['createEmailVerificationToken']>[0],
  ): Promise<void> {
    this.emailVerificationTokens.push(input);
  }

  async consumeEmailVerificationToken(): Promise<OneTimeTokenConsumptionResult> {
    return { outcome: 'NOT_FOUND' };
  }

  async createPasswordResetToken(
    input: Parameters<IdentityTokenRepository['createPasswordResetToken']>[0],
  ): Promise<void> {
    this.passwordResetTokens.push(input);
  }

  async consumePasswordResetToken(
    _input: OneTimeTokenConsumptionInput,
  ): Promise<OneTimeTokenConsumptionResult> {
    return { outcome: 'NOT_FOUND' };
  }
}

class TestPasswordHasher {
  valid = true;
  equivalentHashCalls = 0;

  async hash(plaintext: string): Promise<string> {
    return `$argon2id$hashed-${plaintext}`;
  }

  async verify(): Promise<boolean> {
    return this.valid;
  }

  async equivalentHash(): Promise<void> {
    this.equivalentHashCalls += 1;
  }
}

class DeterministicTokenGenerator {
  private uuidCount = 0;
  private tokenCount = 0;

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

class InMemorySecurityEventRecorder {
  readonly events: SecurityEventInput[] = [];

  async record(input: SecurityEventInput): Promise<void> {
    this.events.push(input);
  }
}
