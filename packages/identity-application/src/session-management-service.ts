import type {
  DeviceFingerprint,
  IdentitySessionRepository,
  PersistedSessionReadModel,
  TrustedDeviceRepository,
} from '@seneve/domain-identity';

import { IdentityApplicationError } from './application-error.js';
import type {
  Clock,
  SecurityDecisionService,
  SecurityEventRecorder,
  TokenGenerator,
} from './contracts.js';

export interface SessionManagementServiceDependencies {
  readonly sessions: IdentitySessionRepository;
  readonly devices: TrustedDeviceRepository;
  readonly securityDecisions: SecurityDecisionService;
  readonly securityEvents: SecurityEventRecorder;
  readonly tokenGenerator: TokenGenerator;
  readonly clock: Clock;
}

export interface IdentifyDeviceResult {
  readonly deviceId: string;
  readonly isNewDevice: boolean;
}

export class SessionManagementService {
  constructor(private readonly deps: SessionManagementServiceDependencies) {}

  async listActiveSessions(identityId: string): Promise<readonly PersistedSessionReadModel[]> {
    const now = this.deps.clock.now();
    await this.expireSessions(identityId);
    return this.deps.sessions.listActiveSessions(identityId, now);
  }

  async countActiveSessions(identityId: string): Promise<number> {
    const now = this.deps.clock.now();
    await this.expireSessions(identityId);
    return this.deps.sessions.countActiveSessions(identityId, now);
  }

  async revokeSelectedSession(input: {
    readonly identityId: string;
    readonly sessionId: string;
    readonly correlationId: string;
    readonly reason: 'USER_REQUEST' | 'ADMINISTRATOR' | 'PASSWORD_CHANGED';
  }): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.sessions.revokeSession(input.sessionId, now, input.reason);
    await this.deps.securityEvents.record({
      identityId: input.identityId,
      eventType:
        input.reason === 'ADMINISTRATOR' ? 'ADMINISTRATOR_SESSION_REVOKED' : 'SESSION_REVOKED',
      occurredAt: now,
      correlationId: input.correlationId,
      metadata: {
        sessionId: input.sessionId,
        reason: input.reason,
      },
    });
  }

  async revokeAllExceptCurrent(input: {
    readonly identityId: string;
    readonly currentSessionId: string;
    readonly correlationId: string;
    readonly reason: 'USER_REQUEST' | 'PASSWORD_CHANGED';
  }): Promise<number> {
    const now = this.deps.clock.now();
    const count = await this.deps.sessions.revokeAllSessionsExcept(
      input.identityId,
      input.currentSessionId,
      now,
      input.reason,
    );
    await this.deps.securityEvents.record({
      identityId: input.identityId,
      eventType: 'SESSION_REVOKED',
      occurredAt: now,
      correlationId: input.correlationId,
      metadata: {
        currentSessionId: input.currentSessionId,
        reason: input.reason,
        count,
      },
    });

    return count;
  }

  async identifyCurrentDevice(input: {
    readonly identityId: string;
    readonly fingerprint: DeviceFingerprint | null;
    readonly correlationId: string;
  }): Promise<IdentifyDeviceResult | null> {
    if (!input.fingerprint) {
      return null;
    }

    const now = this.deps.clock.now();
    const existing = await this.deps.devices.findTrustedDevice(
      input.identityId,
      input.fingerprint.hash,
    );

    if (existing?.status === 'REVOKED') {
      throw new IdentityApplicationError('SESSION_REVOKED', 'Device has been revoked.');
    }

    if (existing) {
      await this.deps.devices.touchTrustedDevice(existing.id, now);
      return {
        deviceId: existing.id,
        isNewDevice: false,
      };
    }

    const decision = this.deps.securityDecisions.canCreateNewDevice();

    if (!decision.allowed) {
      throw new IdentityApplicationError('SESSION_REVOKED', 'New device cannot be trusted.');
    }

    const created = await this.deps.devices.createTrustedDevice({
      id: this.deps.tokenGenerator.uuid(),
      identityId: input.identityId,
      fingerprintHash: input.fingerprint.hash,
      displayName: input.fingerprint.displayName,
      firstSeenAt: now,
    });
    await this.deps.securityEvents.record({
      identityId: input.identityId,
      eventType: 'NEW_DEVICE',
      occurredAt: now,
      correlationId: input.correlationId,
      metadata: {
        deviceId: created.id,
      },
    });

    return {
      deviceId: created.id,
      isNewDevice: true,
    };
  }

  async revokeDevice(input: {
    identityId: string;
    deviceId: string;
    correlationId: string;
  }): Promise<void> {
    const now = this.deps.clock.now();
    await this.deps.devices.revokeTrustedDevice(input.deviceId, now);
    await this.deps.securityEvents.record({
      identityId: input.identityId,
      eventType: 'SESSION_REVOKED',
      occurredAt: now,
      correlationId: input.correlationId,
      metadata: {
        deviceId: input.deviceId,
        reason: 'DEVICE_REVOKED',
      },
    });
  }

  private async expireSessions(identityId: string): Promise<void> {
    const now = this.deps.clock.now();
    const expired = await this.deps.sessions.expireSessions(identityId, now);

    if (expired > 0) {
      await this.deps.securityEvents.record({
        identityId,
        eventType: 'SESSION_EXPIRED',
        occurredAt: now,
        correlationId: 'system',
        metadata: {
          count: expired,
        },
      });
    }
  }
}
