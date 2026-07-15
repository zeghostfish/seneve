import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppendAuditRecordService, AuditingSecurityEventRecorder } from '@seneve/audit-application';
import { PrismaAuditRepository } from '@seneve/audit-persistence';
import { loadFoundationConfig } from '@seneve/config';
import {
  AuthenticationService,
  CompleteEmailVerificationService,
  CompletePasswordResetService,
  ConfigurableSecurityDecisionService,
  defaultSecurityPolicy,
  RequestEmailVerificationService,
  RequestPasswordResetService,
  ResendEmailVerificationService,
  SessionManagementService,
} from '@seneve/identity-application';
import {
  HmacAccessTokenIssuer,
  HmacAccessTokenVerifier,
  HmacSha256TokenHasher,
  NodeArgon2idPasswordHasher,
  NodeOpaqueTokenGenerator,
} from '@seneve/identity-crypto';
import {
  PrismaIdentityRepository,
  PrismaIdentitySessionRepository,
  PrismaIdentityTokenRepository,
  PrismaIdentityUnitOfWork,
  PrismaTrustedDeviceRepository,
} from '@seneve/identity-persistence';
import { tenantContextProvider, TenantExecutionContext } from '@seneve/tenant-context';
import { Redis } from 'ioredis';

import { AuthController } from './auth.controller.js';
import {
  ACCESS_TOKEN_VERIFIER,
  AUTH_SESSION_VALIDATOR,
  AUTHENTICATION_SERVICE,
  AUTH_HTTP_CONFIG,
  AUTH_NOTIFICATION_SINK,
  AUTH_RATE_LIMITER,
  EMAIL_VERIFICATION_COMPLETE_SERVICE,
  EMAIL_VERIFICATION_REQUEST_SERVICE,
  EMAIL_VERIFICATION_RESEND_SERVICE,
  PASSWORD_RESET_COMPLETE_SERVICE,
  PASSWORD_RESET_REQUEST_SERVICE,
  PRISMA_CLIENT,
  SESSION_MANAGEMENT_SERVICE,
} from './auth.tokens.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { NoopAuthNotificationSink } from './providers/auth-notification-sink.js';
import { RepositoryAuthSessionValidator } from './providers/auth-session-validator.js';
import { PrismaSecurityEventRecorder } from './providers/prisma-security-event-recorder.js';
import { RedisAuthRateLimiter } from './rate-limits/auth-rate-limiter.js';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: PRISMA_CLIENT,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: TenantExecutionContext,
      useFactory: () => new TenantExecutionContext(tenantContextProvider),
    },
    {
      provide: AUTH_HTTP_CONFIG,
      useFactory: () => {
        const config = loadFoundationConfig();

        return {
          refreshCookieName: '__Host-seneve_refresh',
          refreshCookiePath: '/api/v1/auth',
          refreshCookieMaxAgeSeconds: defaultSecurityPolicy.refreshTokenLifetimeSeconds,
          cookieSecure: config.authCookieSecure,
          allowedOrigins: config.corsOrigins,
        };
      },
    },
    {
      provide: AUTH_RATE_LIMITER,
      useFactory: () => new RedisAuthRateLimiter(new Redis(loadFoundationConfig().redisUrl)),
    },
    {
      provide: AUTH_NOTIFICATION_SINK,
      useClass: NoopAuthNotificationSink,
    },
    {
      provide: ACCESS_TOKEN_VERIFIER,
      useFactory: () => {
        const config = loadFoundationConfig();

        return new HmacAccessTokenVerifier({
          issuer: config.accessTokenIssuer,
          audience: config.accessTokenAudience,
          secret: config.accessTokenSecret,
        });
      },
    },
    {
      provide: AUTH_SESSION_VALIDATOR,
      inject: ['IDENTITY_REPOSITORY', 'IDENTITY_SESSION_REPOSITORY', 'CLOCK'],
      useFactory: (
        identities: PrismaIdentityRepository,
        sessions: PrismaIdentitySessionRepository,
        clock: { now(): Date },
      ) => new RepositoryAuthSessionValidator(identities, sessions, () => clock.now()),
    },
    {
      provide: 'IDENTITY_REPOSITORY',
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaIdentityRepository(prisma),
    },
    {
      provide: 'IDENTITY_SESSION_REPOSITORY',
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaIdentitySessionRepository(prisma),
    },
    {
      provide: 'IDENTITY_TOKEN_REPOSITORY',
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaIdentityTokenRepository(prisma),
    },
    {
      provide: 'TRUSTED_DEVICE_REPOSITORY',
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaTrustedDeviceRepository(prisma),
    },
    {
      provide: 'IDENTITY_UNIT_OF_WORK',
      inject: [PRISMA_CLIENT],
      useFactory: (prisma: PrismaClient) => new PrismaIdentityUnitOfWork(prisma),
    },
    {
      provide: 'SECURITY_DECISION_SERVICE',
      useFactory: () => new ConfigurableSecurityDecisionService(defaultSecurityPolicy),
    },
    {
      provide: 'TOKEN_GENERATOR',
      useFactory: () => new NodeOpaqueTokenGenerator(),
    },
    {
      provide: 'PASSWORD_HASHER',
      useFactory: () => new NodeArgon2idPasswordHasher(),
    },
    {
      provide: 'TOKEN_HASHER',
      useFactory: () => new HmacSha256TokenHasher(loadFoundationConfig().refreshTokenSecret),
    },
    {
      provide: 'ACCESS_TOKEN_ISSUER',
      useFactory: () => {
        const config = loadFoundationConfig();

        return new HmacAccessTokenIssuer({
          issuer: config.accessTokenIssuer,
          audience: config.accessTokenAudience,
          secret: config.accessTokenSecret,
        });
      },
    },
    {
      provide: 'CLOCK',
      useValue: {
        now: () => new Date(),
      },
    },
    {
      provide: 'SECURITY_EVENT_RECORDER',
      inject: [PRISMA_CLIENT, TenantExecutionContext, 'TOKEN_GENERATOR'],
      useFactory: (
        prisma: PrismaClient,
        executionContext: TenantExecutionContext,
        tokenGenerator: NodeOpaqueTokenGenerator,
      ) =>
        new AuditingSecurityEventRecorder(
          new PrismaSecurityEventRecorder(prisma),
          new AppendAuditRecordService({
            repository: new PrismaAuditRepository(prisma),
            executionContext,
            ids: tokenGenerator,
            now: () => new Date(),
          }),
          {
            mandatoryAuditEvents: [
              'IDENTITY_REGISTERED',
              'PASSWORD_RESET_COMPLETED',
              'IDENTITY_SUSPENDED',
              'REFRESH_TOKEN_REUSE_DETECTED',
              'SESSIONS_REVOKED_AFTER_PASSWORD_RESET',
            ],
          },
        ),
    },
    {
      provide: AUTHENTICATION_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_SESSION_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'TRUSTED_DEVICE_REPOSITORY',
        'SECURITY_DECISION_SERVICE',
        'PASSWORD_HASHER',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'ACCESS_TOKEN_ISSUER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: (
        unitOfWork: PrismaIdentityUnitOfWork,
        identities: PrismaIdentityRepository,
        sessions: PrismaIdentitySessionRepository,
        tokens: PrismaIdentityTokenRepository,
        devices: PrismaTrustedDeviceRepository,
        securityDecisionService: ConfigurableSecurityDecisionService,
        passwordHasher: NodeArgon2idPasswordHasher,
        tokenGenerator: NodeOpaqueTokenGenerator,
        tokenHasher: HmacSha256TokenHasher,
        accessTokenIssuer: HmacAccessTokenIssuer,
        securityEvents: AuditingSecurityEventRecorder,
        clock: { now(): Date },
      ) =>
        new AuthenticationService({
          unitOfWork,
          identities,
          sessions,
          tokens,
          devices,
          securityDecisionService,
          passwordHasher,
          tokenGenerator,
          tokenHasher,
          accessTokenIssuer,
          securityEvents,
          clock,
          accessTokenTtlSeconds: 900,
          refreshTokenTtlSeconds: defaultSecurityPolicy.refreshTokenLifetimeSeconds,
          sessionTtlSeconds: defaultSecurityPolicy.sessionDurationSeconds,
          emailVerificationTokenTtlSeconds: 3600,
        }),
    },
    {
      provide: SESSION_MANAGEMENT_SERVICE,
      inject: [
        'IDENTITY_SESSION_REPOSITORY',
        'TRUSTED_DEVICE_REPOSITORY',
        'SECURITY_DECISION_SERVICE',
        'SECURITY_EVENT_RECORDER',
        'TOKEN_GENERATOR',
        'CLOCK',
      ],
      useFactory: (
        sessions: PrismaIdentitySessionRepository,
        devices: PrismaTrustedDeviceRepository,
        securityDecisions: ConfigurableSecurityDecisionService,
        securityEvents: AuditingSecurityEventRecorder,
        tokenGenerator: NodeOpaqueTokenGenerator,
        clock: { now(): Date },
      ) => {
        return new SessionManagementService({
          sessions,
          devices,
          securityDecisions,
          securityEvents,
          tokenGenerator,
          clock,
        });
      },
    },
    ...emailVerificationProviders(),
    ...passwordResetProviders(),
    AccessTokenGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}

function emailVerificationProviders() {
  return [
    {
      provide: EMAIL_VERIFICATION_REQUEST_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: createEmailVerificationService(RequestEmailVerificationService),
    },
    {
      provide: EMAIL_VERIFICATION_RESEND_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: createEmailVerificationService(ResendEmailVerificationService),
    },
    {
      provide: EMAIL_VERIFICATION_COMPLETE_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: createEmailVerificationService(CompleteEmailVerificationService),
    },
  ];
}

function createEmailVerificationService<T>(
  ServiceClass: new (deps: ConstructorParameters<typeof RequestEmailVerificationService>[0]) => T,
) {
  return (
    unitOfWork: PrismaIdentityUnitOfWork,
    identities: PrismaIdentityRepository,
    tokens: PrismaIdentityTokenRepository,
    tokenGenerator: NodeOpaqueTokenGenerator,
    tokenHasher: HmacSha256TokenHasher,
    securityEvents: AuditingSecurityEventRecorder,
    clock: { now(): Date },
  ) =>
    new ServiceClass({
      unitOfWork,
      identities,
      tokens,
      tokenGenerator,
      tokenHasher,
      securityEvents,
      clock,
      tokenTtlSeconds: 3600,
      policy: {
        minimumResendDelaySeconds: 60,
        maximumRequestsPerWindow: 5,
        requestWindowSeconds: 3600,
        supersedePreviousTokens: true,
        locale: 'en',
      },
    });
}

function passwordResetProviders() {
  return [
    {
      provide: PASSWORD_RESET_REQUEST_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'PASSWORD_HASHER',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: createPasswordResetService(RequestPasswordResetService),
    },
    {
      provide: PASSWORD_RESET_COMPLETE_SERVICE,
      inject: [
        'IDENTITY_UNIT_OF_WORK',
        'IDENTITY_REPOSITORY',
        'IDENTITY_TOKEN_REPOSITORY',
        'PASSWORD_HASHER',
        'TOKEN_GENERATOR',
        'TOKEN_HASHER',
        'SECURITY_EVENT_RECORDER',
        'CLOCK',
      ],
      useFactory: createPasswordResetService(CompletePasswordResetService),
    },
  ];
}

function createPasswordResetService<T>(
  ServiceClass: new (deps: ConstructorParameters<typeof RequestPasswordResetService>[0]) => T,
) {
  return (
    unitOfWork: PrismaIdentityUnitOfWork,
    identities: PrismaIdentityRepository,
    tokens: PrismaIdentityTokenRepository,
    passwordHasher: NodeArgon2idPasswordHasher,
    tokenGenerator: NodeOpaqueTokenGenerator,
    tokenHasher: HmacSha256TokenHasher,
    securityEvents: AuditingSecurityEventRecorder,
    clock: { now(): Date },
  ) =>
    new ServiceClass({
      unitOfWork,
      identities,
      tokens,
      passwordHasher,
      tokenGenerator,
      tokenHasher,
      securityEvents,
      clock,
      tokenTtlSeconds: 1800,
      policy: {
        minimumRequestDelaySeconds: 60,
        maximumRequestsPerWindow: 5,
        requestWindowSeconds: 3600,
        supersedePreviousTokens: true,
        preventPasswordReuseCount: defaultSecurityPolicy.preventPasswordReuseCount,
        locale: 'en',
      },
    });
}
