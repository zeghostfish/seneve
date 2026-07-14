import type {
  IdentityRepository,
  IdentitySessionRepository,
  IdentityTokenRepository,
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
    | 'LOGIN_SUCCEEDED'
    | 'LOGIN_FAILED'
    | 'SESSION_CREATED'
    | 'SESSION_REVOKED'
    | 'REFRESH_TOKEN_ROTATED'
    | 'REFRESH_TOKEN_REUSE_DETECTED'
    | 'IDENTITY_SUSPENDED';
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SecurityEventRecorder {
  record(input: SecurityEventInput): Promise<void>;
}

export interface IdentityApplicationRepositories {
  readonly identities: IdentityRepository;
  readonly sessions: IdentitySessionRepository;
  readonly tokens: IdentityTokenRepository;
}

export interface IdentityUnitOfWork {
  transaction<T>(work: (repositories: IdentityApplicationRepositories) => Promise<T>): Promise<T>;
}

export interface AuthenticationServiceDependencies {
  readonly unitOfWork: IdentityUnitOfWork;
  readonly identities: IdentityRepository;
  readonly sessions: IdentitySessionRepository;
  readonly tokens: IdentityTokenRepository;
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
