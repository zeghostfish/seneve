import type { SecurityDecision, SecurityDecisionService, SecurityPolicy } from './contracts.js';

export const defaultSecurityPolicy: SecurityPolicy = {
  maximumConcurrentSessions: 5,
  sessionDurationSeconds: 2_592_000,
  refreshTokenLifetimeSeconds: 2_592_000,
  passwordLifetimeDays: 180,
  requireEmailVerificationForLogin: true,
  forceLogoutOnPasswordChange: true,
  preventPasswordReuseCount: 5,
  trustNewDevicesByDefault: true,
};

export class ConfigurableSecurityDecisionService implements SecurityDecisionService {
  constructor(private readonly policy: SecurityPolicy = defaultSecurityPolicy) {}

  canLogin(input: {
    readonly identityStatus: string;
    readonly emailVerified: boolean;
    readonly activeSessionCount: number;
  }): SecurityDecision {
    if (input.identityStatus === 'SUSPENDED') {
      return deny('IDENTITY_SUSPENDED');
    }

    const emailDecision = this.mustRequireEmailVerification({ emailVerified: input.emailVerified });

    if (!emailDecision.allowed) {
      return emailDecision;
    }

    return this.canCreateSession({ activeSessionCount: input.activeSessionCount });
  }

  canRefresh(input: {
    readonly sessionStatus: string;
    readonly sessionExpiresAt: Date;
    readonly now: Date;
  }): SecurityDecision {
    if (input.sessionStatus === 'REVOKED') {
      return deny('SESSION_REVOKED');
    }

    if (input.sessionExpiresAt <= input.now || input.sessionStatus === 'EXPIRED') {
      return deny('SESSION_EXPIRED');
    }

    return allow();
  }

  canCreateSession(input: { readonly activeSessionCount: number }): SecurityDecision {
    if (input.activeSessionCount >= this.policy.maximumConcurrentSessions) {
      return deny('MAXIMUM_CONCURRENT_SESSIONS_REACHED');
    }

    return allow();
  }

  canCreateNewDevice(): SecurityDecision {
    return this.policy.trustNewDevicesByDefault ? allow() : deny('DEVICE_REVOKED');
  }

  mustForceLogout(input: {
    readonly reason: 'PASSWORD_CHANGED' | 'IDENTITY_SUSPENDED';
  }): SecurityDecision {
    if (input.reason === 'IDENTITY_SUSPENDED') {
      return allow();
    }

    return this.policy.forceLogoutOnPasswordChange ? allow() : deny('ALLOWED');
  }

  mustRequireEmailVerification(input: { readonly emailVerified: boolean }): SecurityDecision {
    if (this.policy.requireEmailVerificationForLogin && !input.emailVerified) {
      return deny('EMAIL_VERIFICATION_REQUIRED');
    }

    return allow();
  }

  mustRotateCredential(input: {
    readonly credentialCreatedAt: Date;
    readonly now: Date;
  }): SecurityDecision {
    const passwordAgeMs = input.now.getTime() - input.credentialCreatedAt.getTime();
    const maxAgeMs = this.policy.passwordLifetimeDays * 24 * 60 * 60 * 1000;

    return passwordAgeMs > maxAgeMs ? deny('PASSWORD_ROTATION_REQUIRED') : allow();
  }
}

function allow(): SecurityDecision {
  return {
    allowed: true,
    reason: 'ALLOWED',
  };
}

function deny(reason: SecurityDecision['reason']): SecurityDecision {
  return {
    allowed: false,
    reason,
  };
}
