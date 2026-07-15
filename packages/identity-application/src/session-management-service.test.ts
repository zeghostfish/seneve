import { beforeEach, describe, expect, it } from 'vitest';

import type {
  DeviceFingerprint,
  IdentitySessionRepository,
  PersistedSessionReadModel,
  PersistedTrustedDeviceReadModel,
  TrustedDeviceRepository,
} from '@seneve/domain-identity';

import type { SecurityEventInput } from './contracts.js';
import { ConfigurableSecurityDecisionService } from './security-policy-service.js';
import { SessionManagementService } from './session-management-service.js';

const now = new Date('2026-07-14T00:00:00.000Z');

describe('SessionManagementService', () => {
  let sessions: InMemorySessionRepository;
  let devices: InMemoryTrustedDeviceRepository;
  let events: InMemorySecurityEventRecorder;
  let service: SessionManagementService;

  beforeEach(() => {
    sessions = new InMemorySessionRepository();
    devices = new InMemoryTrustedDeviceRepository();
    events = new InMemorySecurityEventRecorder();
    service = new SessionManagementService({
      sessions,
      devices,
      securityDecisions: new ConfigurableSecurityDecisionService(),
      securityEvents: events,
      tokenGenerator: {
        uuid: () => 'device-1',
        opaqueToken: () => ({ tokenId: 'token-1', rawToken: 'raw-token-1' }),
      },
      clock: { now: () => now },
    });
  });

  it('lists active sessions after expiring stale sessions', async () => {
    sessions.activeSessions = [session('session-1')];
    sessions.expiredCount = 1;

    await expect(service.listActiveSessions('identity-1')).resolves.toEqual([session('session-1')]);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        eventType: 'SESSION_EXPIRED',
        metadata: { count: 1 },
      }),
    );
  });

  it('revokes selected sessions and records administrator revocation separately', async () => {
    await service.revokeSelectedSession({
      identityId: 'identity-1',
      sessionId: 'session-1',
      correlationId: 'correlation-1',
      reason: 'ADMINISTRATOR',
    });

    expect(sessions.revoked).toEqual([{ sessionId: 'session-1', reason: 'ADMINISTRATOR' }]);
    expect(events.events).toContainEqual(
      expect.objectContaining({
        eventType: 'ADMINISTRATOR_SESSION_REVOKED',
      }),
    );
  });

  it('revokes all sessions except the current one after password changes', async () => {
    await expect(
      service.revokeAllExceptCurrent({
        identityId: 'identity-1',
        currentSessionId: 'session-current',
        correlationId: 'correlation-1',
        reason: 'PASSWORD_CHANGED',
      }),
    ).resolves.toBe(2);
    expect(sessions.revokedExcept).toEqual([
      { identityId: 'identity-1', currentSessionId: 'session-current', reason: 'PASSWORD_CHANGED' },
    ]);
  });

  it('registers and looks up trusted devices through a fingerprint abstraction', async () => {
    const fingerprint: DeviceFingerprint = {
      hash: 'hmac-sha256:devicefingerprintabcdefghijklmnopqrstuvwxyz',
      displayName: 'Ada MacBook',
    };

    await expect(
      service.identifyCurrentDevice({
        identityId: 'identity-1',
        fingerprint,
        correlationId: 'correlation-1',
      }),
    ).resolves.toEqual({ deviceId: 'device-1', isNewDevice: true });
    await expect(
      service.identifyCurrentDevice({
        identityId: 'identity-1',
        fingerprint,
        correlationId: 'correlation-2',
      }),
    ).resolves.toEqual({ deviceId: 'device-1', isNewDevice: false });
  });
});

function session(id: string): PersistedSessionReadModel {
  return {
    id,
    identityId: 'identity-1',
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date('2026-08-14T00:00:00.000Z'),
    revokedAt: null,
    revokedReason: null,
    device: null,
  };
}

class InMemorySessionRepository implements IdentitySessionRepository {
  activeSessions: PersistedSessionReadModel[] = [];
  expiredCount = 0;
  revoked: { sessionId: string; reason: string }[] = [];
  revokedExcept: { identityId: string; currentSessionId: string; reason: string }[] = [];

  async createSessionWithRefreshToken(): Promise<void> {}

  async findSessionById(): Promise<PersistedSessionReadModel | null> {
    return null;
  }

  async listActiveSessions(): Promise<readonly PersistedSessionReadModel[]> {
    return this.activeSessions;
  }

  async countActiveSessions(): Promise<number> {
    return this.activeSessions.length;
  }

  async rotateRefreshToken() {
    return { outcome: 'NOT_FOUND' as const };
  }

  async touchSession(): Promise<boolean> {
    return true;
  }

  async expireSessions(): Promise<number> {
    return this.expiredCount;
  }

  async revokeSession(sessionId: string, _revokedAt: Date, reason: string): Promise<boolean> {
    this.revoked.push({ sessionId, reason });
    return true;
  }

  async revokeAllSessionsForIdentity(): Promise<number> {
    return 0;
  }

  async revokeAllSessionsAndRefreshTokensForIdentity() {
    return { sessionsRevoked: 0, refreshTokensRevoked: 0 };
  }

  async revokeAllSessionsExcept(
    identityId: string,
    currentSessionId: string,
    _revokedAt: Date,
    reason: string,
  ): Promise<number> {
    this.revokedExcept.push({ identityId, currentSessionId, reason });
    return 2;
  }
}

class InMemoryTrustedDeviceRepository implements TrustedDeviceRepository {
  readonly devices = new Map<string, PersistedTrustedDeviceReadModel>();

  async findTrustedDevice(
    identityId: string,
    fingerprintHash: string,
  ): Promise<PersistedTrustedDeviceReadModel | null> {
    return this.devices.get(`${identityId}:${fingerprintHash}`) ?? null;
  }

  async createTrustedDevice(input: {
    readonly id: string;
    readonly identityId: string;
    readonly fingerprintHash: string;
    readonly displayName: string;
    readonly firstSeenAt: Date;
  }): Promise<PersistedTrustedDeviceReadModel> {
    const device = {
      ...input,
      status: 'TRUSTED' as const,
      lastActivityAt: input.firstSeenAt,
      revokedAt: null,
    };
    this.devices.set(`${input.identityId}:${input.fingerprintHash}`, device);
    return device;
  }

  async touchTrustedDevice(): Promise<boolean> {
    return true;
  }

  async revokeTrustedDevice(): Promise<boolean> {
    return true;
  }
}

class InMemorySecurityEventRecorder {
  readonly events: SecurityEventInput[] = [];

  async record(input: SecurityEventInput): Promise<void> {
    this.events.push(input);
  }
}
