import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  anonymousTenantContext,
  tenantContextProvider,
  TenantExecutionContext,
} from '@seneve/tenant-context';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

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
  SESSION_MANAGEMENT_SERVICE,
} from './auth.tokens.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { InMemoryAuthRateLimiter } from './rate-limits/auth-rate-limiter.js';

const httpConfig = {
  refreshCookieName: '__Host-seneve_refresh',
  refreshCookiePath: '/api/v1/auth',
  refreshCookieMaxAgeSeconds: 2_592_000,
  cookieSecure: false,
  allowedOrigins: ['http://localhost:3001'],
};

describe('AuthController', () => {
  it('registers without exposing the raw verification token', async () => {
    const { app, services } = await createApp();
    services.authentication.register.mockResolvedValue({
      identityId: 'identity-1',
      userId: 'user-1',
      emailVerification: {
        tokenId: '8270af83-9d90-48cc-a8e3-b51a88362a6e',
        rawToken: 'raw-verification-token',
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'Ada@example.com',
        displayName: 'Ada',
        password: 'VeryStrongPassword1!',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      identityId: 'identity-1',
      userId: 'user-1',
      emailVerification: {
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('raw-verification-token');
    expect(services.notifications.emailVerificationRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        rawVerificationToken: 'raw-verification-token',
      }),
    );

    await app.close();
  });

  it('logs in with a refresh cookie and no refresh token in JSON', async () => {
    const { app, services } = await createApp();
    services.authentication.login.mockResolvedValue(authenticatedResult());

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'VeryStrongPassword1!',
      })
      .expect(200);

    expect(response.headers['set-cookie']?.[0]).toContain('__Host-seneve_refresh=');
    expect(response.body).toMatchObject({
      identityId: 'identity-1',
      sessionId: 'session-1',
      accessToken: 'access-token',
      tokenType: 'Bearer',
    });
    expect(JSON.stringify(response.body)).not.toContain('refresh-token');

    await app.close();
  });

  it('rotates refresh tokens from the secure cookie transport', async () => {
    const { app, services } = await createApp();
    services.authentication.refresh.mockResolvedValue({
      ...authenticatedResult(),
      accessToken: 'next-access-token',
      refreshToken: {
        tokenId: 'next-token-id',
        rawToken: 'next-refresh-token',
        expiresAt: new Date('2026-01-31T00:00:00.000Z'),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(
        'Cookie',
        `${httpConfig.refreshCookieName}=eyJ0b2tlbklkIjoidG9rZW4taWQiLCJyYXdUb2tlbiI6InJhdy10b2tlbiJ9`,
      )
      .expect(200);

    expect(services.authentication.refresh).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenId: 'token-id',
        rawRefreshToken: 'raw-token',
      }),
    );
    expect(response.headers['set-cookie']?.[0]).toContain('__Host-seneve_refresh=');
    expect(response.body.accessToken).toBe('next-access-token');

    await app.close();
  });

  it('returns a generic password reset request response', async () => {
    const { app, services } = await createApp();
    services.requestPasswordReset.request.mockResolvedValue({
      accepted: true,
      notification: null,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email: 'missing@example.com' })
      .expect(202);

    expect(response.body).toMatchObject({ accepted: true });

    await app.close();
  });

  it('rejects foreign session revocation at the transport boundary', async () => {
    const { app, services } = await createApp();
    services.accessTokenVerifier.verify.mockResolvedValue({
      sub: 'identity-1',
      identityId: 'identity-1',
      sessionId: 'current-session',
      tokenVersion: 1,
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    services.sessions.listActiveSessions.mockResolvedValue([
      {
        id: 'current-session',
        identityId: 'identity-1',
        status: 'ACTIVE',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
        revokedAt: null,
        revokedReason: null,
        device: null,
      },
    ]);

    await request(app.getHttpServer())
      .delete('/auth/sessions/2ba7ddc2-3f52-4f35-a67b-f782584bc2dd')
      .set('Authorization', 'Bearer valid-token')
      .expect(401);

    expect(services.sessions.revokeSelectedSession).not.toHaveBeenCalled();

    await app.close();
  });

  it('rejects disallowed origins for state-changing requests', async () => {
    const { app } = await createApp();

    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .set('Origin', 'https://evil.example')
      .send({ email: 'ada@example.com' })
      .expect(403);

    await app.close();
  });
});

async function createApp() {
  const services = createServices();
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      AccessTokenGuard,
      CsrfGuard,
      {
        provide: TenantExecutionContext,
        useValue: new TenantExecutionContext(tenantContextProvider),
      },
      { provide: AUTH_HTTP_CONFIG, useValue: httpConfig },
      { provide: AUTH_RATE_LIMITER, useValue: new InMemoryAuthRateLimiter() },
      { provide: AUTH_NOTIFICATION_SINK, useValue: services.notifications },
      { provide: AUTHENTICATION_SERVICE, useValue: services.authentication },
      { provide: SESSION_MANAGEMENT_SERVICE, useValue: services.sessions },
      { provide: EMAIL_VERIFICATION_REQUEST_SERVICE, useValue: services.requestEmailVerification },
      { provide: EMAIL_VERIFICATION_RESEND_SERVICE, useValue: services.resendEmailVerification },
      {
        provide: EMAIL_VERIFICATION_COMPLETE_SERVICE,
        useValue: services.completeEmailVerification,
      },
      { provide: PASSWORD_RESET_REQUEST_SERVICE, useValue: services.requestPasswordReset },
      { provide: PASSWORD_RESET_COMPLETE_SERVICE, useValue: services.completePasswordReset },
      { provide: ACCESS_TOKEN_VERIFIER, useValue: services.accessTokenVerifier },
      { provide: AUTH_SESSION_VALIDATOR, useValue: services.authSessionValidator },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  tenantContextProvider.runWith(
    anonymousTenantContext({
      correlationId: 'test',
      executionSource: 'HTTP_REQUEST',
    }),
    () => undefined,
  );

  await app.init();

  return { app, services };
}

function createServices() {
  return {
    authentication: {
      register: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      revokeAllSessions: vi.fn(),
    },
    sessions: {
      listActiveSessions: vi.fn(),
      revokeSelectedSession: vi.fn(),
      revokeAllExceptCurrent: vi.fn(),
    },
    requestEmailVerification: { request: vi.fn() },
    resendEmailVerification: { resend: vi.fn() },
    completeEmailVerification: { complete: vi.fn() },
    requestPasswordReset: { request: vi.fn() },
    completePasswordReset: { complete: vi.fn() },
    accessTokenVerifier: { verify: vi.fn() },
    authSessionValidator: { validate: vi.fn().mockResolvedValue(true) },
    notifications: {
      emailVerificationRequested: vi.fn(),
      passwordResetRequested: vi.fn(),
    },
  };
}

function authenticatedResult() {
  return {
    identityId: 'identity-1',
    sessionId: 'session-1',
    accessToken: 'access-token',
    accessTokenExpiresAt: new Date('2026-01-01T00:15:00.000Z'),
    refreshToken: {
      tokenId: 'refresh-token-id',
      rawToken: 'refresh-token',
      expiresAt: new Date('2026-01-31T00:00:00.000Z'),
    },
    deviceId: null,
  };
}
