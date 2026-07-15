import { describe, expect, it } from 'vitest';

import { ConfigurableSecurityDecisionService } from './security-policy-service.js';

describe('ConfigurableSecurityDecisionService', () => {
  it('denies session creation when the concurrent session limit is reached', () => {
    const decisions = new ConfigurableSecurityDecisionService({
      maximumConcurrentSessions: 2,
      sessionDurationSeconds: 3600,
      refreshTokenLifetimeSeconds: 3600,
      passwordLifetimeDays: 90,
      requireEmailVerificationForLogin: true,
      forceLogoutOnPasswordChange: true,
      preventPasswordReuseCount: 5,
      trustNewDevicesByDefault: true,
    });

    expect(decisions.canCreateSession({ activeSessionCount: 2 })).toEqual({
      allowed: false,
      reason: 'MAXIMUM_CONCURRENT_SESSIONS_REACHED',
    });
  });

  it('requires email verification according to policy', () => {
    const decisions = new ConfigurableSecurityDecisionService();

    expect(decisions.mustRequireEmailVerification({ emailVerified: false })).toEqual({
      allowed: false,
      reason: 'EMAIL_VERIFICATION_REQUIRED',
    });
  });

  it('requires credential rotation after the configured lifetime', () => {
    const decisions = new ConfigurableSecurityDecisionService({
      maximumConcurrentSessions: 5,
      sessionDurationSeconds: 3600,
      refreshTokenLifetimeSeconds: 3600,
      passwordLifetimeDays: 1,
      requireEmailVerificationForLogin: true,
      forceLogoutOnPasswordChange: true,
      preventPasswordReuseCount: 5,
      trustNewDevicesByDefault: true,
    });

    expect(
      decisions.mustRotateCredential({
        credentialCreatedAt: new Date('2026-07-12T00:00:00.000Z'),
        now: new Date('2026-07-14T00:00:00.000Z'),
      }),
    ).toEqual({
      allowed: false,
      reason: 'PASSWORD_ROTATION_REQUIRED',
    });
  });
});
