import type {
  IdentityRepository,
  IdentitySessionRepository,
  IdentityTokenRepository,
  TrustedDeviceRepository,
} from '@seneve/domain-identity';

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(input: { plaintext: string; hash: string }): Promise<boolean>;
  equivalentHash(): Promise<void>;
}

export interface GeneratedToken {
  readonly tokenId: string;
  readonly rawToken: string;
}

export interface TokenGenerator {
  uuid(): string;
  opaqueToken(): GeneratedToken;
}

export interface TokenHasher {
  hash(rawToken: string): Promise<string>;
}

export interface AccessTokenClaims {
  readonly sub: string;
  readonly identityId: string;
  readonly sessionId: string;
  readonly tokenVersion: number;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<string>;
}

export interface SecurityEventInput {
  readonly identityId: string | null;
  readonly eventType:
    | 'IDENTITY_REGISTERED'
    | 'EMAIL_VERIFICATION_REQUESTED'
    | 'EMAIL_VERIFICATION_RESENT'
    | 'EMAIL_VERIFIED'
    | 'EMAIL_VERIFICATION_FAILED'
    | 'EMAIL_VERIFICATION_EXPIRED'
    | 'LOGIN_SUCCEEDED'
    | 'LOGIN_FAILED'
    | 'SESSION_CREATED'
    | 'SESSION_REVOKED'
    | 'SESSION_EXPIRED'
    | 'NEW_DEVICE'
    | 'PASSWORD_CHANGED'
    | 'SUSPICIOUS_LOGIN'
    | 'CONCURRENT_LOGIN_LIMIT_REACHED'
    | 'ADMINISTRATOR_SESSION_REVOKED'
    | 'REFRESH_TOKEN_ROTATED'
    | 'REFRESH_TOKEN_REUSE_DETECTED'
    | 'IDENTITY_SUSPENDED'
    | 'SECURITY_POLICY_VIOLATION';
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EmailVerificationNotificationCommand {
  readonly recipientEmail: string;
  readonly template: 'identity.email_verification';
  readonly locale: string;
  readonly rawVerificationToken: string;
  readonly verificationTokenId: string;
  readonly expiresAt: Date;
  readonly correlationId: string;
}

export interface EmailVerificationPolicy {
  readonly minimumResendDelaySeconds: number;
  readonly maximumRequestsPerWindow: number;
  readonly requestWindowSeconds: number;
  readonly supersedePreviousTokens: boolean;
  readonly locale: string;
}

export interface SecurityEventRecorder {
  record(input: SecurityEventInput): Promise<void>;
}

export interface IdentityApplicationRepositories {
  readonly identities: IdentityRepository;
  readonly sessions: IdentitySessionRepository;
  readonly tokens: IdentityTokenRepository;
  readonly devices: TrustedDeviceRepository;
}

export interface IdentityUnitOfWork {
  transaction<T>(work: (repositories: IdentityApplicationRepositories) => Promise<T>): Promise<T>;
}

export interface AuthenticationServiceDependencies {
  readonly unitOfWork: IdentityUnitOfWork;
  readonly identities: IdentityRepository;
  readonly sessions: IdentitySessionRepository;
  readonly tokens: IdentityTokenRepository;
  readonly devices: TrustedDeviceRepository;
  readonly securityDecisionService: SecurityDecisionService;
  readonly passwordHasher: PasswordHasher;
  readonly tokenGenerator: TokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly accessTokenIssuer: AccessTokenIssuer;
  readonly securityEvents: SecurityEventRecorder;
  readonly clock: Clock;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly sessionTtlSeconds: number;
  readonly emailVerificationTokenTtlSeconds: number;
}

export interface SecurityPolicy {
  readonly maximumConcurrentSessions: number;
  readonly sessionDurationSeconds: number;
  readonly refreshTokenLifetimeSeconds: number;
  readonly passwordLifetimeDays: number;
  readonly requireEmailVerificationForLogin: boolean;
  readonly forceLogoutOnPasswordChange: boolean;
  readonly preventPasswordReuseCount: number;
  readonly trustNewDevicesByDefault: boolean;
}

export type SecurityDecisionReason =
  | 'ALLOWED'
  | 'IDENTITY_SUSPENDED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'MAXIMUM_CONCURRENT_SESSIONS_REACHED'
  | 'SESSION_INVALID'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'
  | 'DEVICE_REVOKED'
  | 'PASSWORD_ROTATION_REQUIRED';

export interface SecurityDecision {
  readonly allowed: boolean;
  readonly reason: SecurityDecisionReason;
}

export interface SecurityDecisionService {
  canLogin(input: {
    readonly identityStatus: string;
    readonly emailVerified: boolean;
    readonly activeSessionCount: number;
  }): SecurityDecision;
  canRefresh(input: {
    readonly sessionStatus: string;
    readonly sessionExpiresAt: Date;
    readonly now: Date;
  }): SecurityDecision;
  canCreateSession(input: { readonly activeSessionCount: number }): SecurityDecision;
  canCreateNewDevice(): SecurityDecision;
  mustForceLogout(input: {
    readonly reason: 'PASSWORD_CHANGED' | 'IDENTITY_SUSPENDED';
  }): SecurityDecision;
  mustRequireEmailVerification(input: { readonly emailVerified: boolean }): SecurityDecision;
  mustRotateCredential(input: {
    readonly credentialCreatedAt: Date;
    readonly now: Date;
  }): SecurityDecision;
}
