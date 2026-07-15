import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthenticationService,
  CompleteEmailVerificationService,
  CompletePasswordResetService,
  RequestEmailVerificationService,
  RequestPasswordResetService,
  ResendEmailVerificationService,
  SessionManagementService,
} from '@seneve/identity-application';
import {
  anonymousTenantContext,
  authenticatedTenantContext,
  TenantExecutionContext,
} from '@seneve/tenant-context';
import type { Request, Response } from 'express';

import type { AuthenticatedHttpRequest, AuthHttpConfig } from './auth-http.types.js';
import {
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
import {
  EmailVerificationTokenDto,
  LoginRequestDto,
  PasswordResetCompleteDto,
  PasswordResetRequestDto,
  RegisterRequestDto,
  SessionIdParamDto,
} from './dto/auth.dto.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { mapIdentityError, unauthorized } from './mappers/auth-error.mapper.js';
import type { AuthNotificationSink } from './providers/auth-notification-sink.js';
import { correlationIdFrom, requestIdFrom } from './providers/http-context.js';
import {
  clearRefreshCookie,
  decodeRefreshCookie,
  setRefreshCookie,
} from './providers/refresh-cookie.js';
import type { AuthRateLimiter } from './rate-limits/auth-rate-limiter.js';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(CsrfGuard)
export class AuthController {
  constructor(
    @Inject(AUTHENTICATION_SERVICE) private readonly authentication: AuthenticationService,
    @Inject(SESSION_MANAGEMENT_SERVICE) private readonly sessions: SessionManagementService,
    @Inject(EMAIL_VERIFICATION_REQUEST_SERVICE)
    private readonly requestEmailVerification: RequestEmailVerificationService,
    @Inject(EMAIL_VERIFICATION_RESEND_SERVICE)
    private readonly resendEmailVerification: ResendEmailVerificationService,
    @Inject(EMAIL_VERIFICATION_COMPLETE_SERVICE)
    private readonly completeEmailVerification: CompleteEmailVerificationService,
    @Inject(PASSWORD_RESET_REQUEST_SERVICE)
    private readonly requestPasswordReset: RequestPasswordResetService,
    @Inject(PASSWORD_RESET_COMPLETE_SERVICE)
    private readonly completePasswordReset: CompletePasswordResetService,
    @Inject(AUTH_RATE_LIMITER) private readonly rateLimiter: AuthRateLimiter,
    @Inject(AUTH_NOTIFICATION_SINK) private readonly notifications: AuthNotificationSink,
    @Inject(AUTH_HTTP_CONFIG) private readonly httpConfig: AuthHttpConfig,
    @Inject(TenantExecutionContext)
    private readonly tenantExecutionContext: TenantExecutionContext,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register an identity and create an email verification challenge.' })
  @ApiOkResponse({ description: 'Identity registered.' })
  async register(
    @Body() body: RegisterRequestDto,
    @Req() request: Request,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);

    await this.consumeRateLimit(`register:${body.email}:${request.ip}`, 5, 900, correlationId);

    return this.runAnonymous(request, async () => {
      try {
        const result = await this.authentication.register({
          email: body.email,
          displayName: body.displayName,
          plaintextPassword: body.password,
          correlationId,
        });

        await this.notifications.emailVerificationRequested({
          recipientEmail: body.email,
          template: 'identity.email_verification',
          locale: 'en',
          rawVerificationToken: result.emailVerification.rawToken,
          verificationTokenId: result.emailVerification.tokenId,
          expiresAt: result.emailVerification.expiresAt,
          correlationId,
        });

        return {
          identityId: result.identityId,
          userId: result.userId,
          emailVerification: {
            expiresAt: result.emailVerification.expiresAt.toISOString(),
          },
          correlationId,
        };
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password.' })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);

    await this.consumeRateLimit(`login:${body.email}:${request.ip}`, 10, 900, correlationId);

    return this.runAnonymous(request, async () => {
      try {
        const result = await this.authentication.login({
          email: body.email,
          plaintextPassword: body.password,
          correlationId,
          device: body.deviceDisplayName
            ? {
                displayName: body.deviceDisplayName,
                hash: `provided:${body.deviceDisplayName}`,
              }
            : null,
        });

        setRefreshCookie(response, this.httpConfig, {
          tokenId: result.refreshToken.tokenId,
          rawToken: result.refreshToken.rawToken,
        });

        return authenticatedResponse(result, correlationId);
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token.' })
  async refresh(
    @Req() request: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) response: Response,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);
    const cookie = decodeRefreshCookie(request.cookies?.[this.httpConfig.refreshCookieName]);

    await this.consumeRateLimit(`refresh:${request.ip}`, 30, 60, correlationId);

    if (!cookie) {
      clearRefreshCookie(response, this.httpConfig);
      throw unauthorized(correlationId);
    }

    return this.runAnonymous(request, async () => {
      try {
        const result = await this.authentication.refresh({
          refreshTokenId: cookie.tokenId,
          rawRefreshToken: cookie.rawToken,
          correlationId,
        });

        setRefreshCookie(response, this.httpConfig, {
          tokenId: result.refreshToken.tokenId,
          rawToken: result.refreshToken.rawToken,
        });

        return authenticatedResponse(result, correlationId);
      } catch (error) {
        clearRefreshCookie(response, this.httpConfig);
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('logout')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async logout(
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    await this.runAuthenticated(request, auth.identityId, async () => {
      await this.authentication.logout({
        sessionId: auth.sessionId,
        correlationId,
      });
      clearRefreshCookie(response, this.httpConfig);
    });
  }

  @Post('logout-all')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async logoutAll(
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    await this.runAuthenticated(request, auth.identityId, async () => {
      await this.authentication.revokeAllSessions(auth.identityId, correlationId);
      clearRefreshCookie(response, this.httpConfig);
    });
  }

  @Post('email-verification/request')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  async requestVerification(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    return this.runAuthenticated(request, auth.identityId, async () => {
      try {
        const command = await this.requestEmailVerification.request({
          identityId: auth.identityId,
          correlationId,
        });
        await this.notifications.emailVerificationRequested(command);

        return {
          accepted: true,
          expiresAt: command.expiresAt.toISOString(),
          correlationId,
        };
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('email-verification/resend')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  async resendVerification(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    return this.runAuthenticated(request, auth.identityId, async () => {
      try {
        const command = await this.resendEmailVerification.resend({
          identityId: auth.identityId,
          correlationId,
        });
        await this.notifications.emailVerificationRequested(command);

        return {
          accepted: true,
          expiresAt: command.expiresAt.toISOString(),
          correlationId,
        };
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('email-verification/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completeVerification(
    @Body() body: EmailVerificationTokenDto,
    @Req() request: Request,
  ): Promise<void> {
    const correlationId = correlationIdFrom(request);

    await this.runAnonymous(request, async () => {
      try {
        await this.completeEmailVerification.complete({
          tokenId: body.tokenId,
          rawToken: body.token,
          correlationId,
        });
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestReset(
    @Body() body: PasswordResetRequestDto,
    @Req() request: Request,
  ): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);

    await this.consumeRateLimit(
      `password-reset:${body.email}:${request.ip}`,
      5,
      900,
      correlationId,
    );

    return this.runAnonymous(request, async () => {
      try {
        const result = await this.requestPasswordReset.request({
          email: body.email,
          correlationId,
        });

        if (result.notification) {
          await this.notifications.passwordResetRequested(result.notification);
        }

        return {
          accepted: true,
          correlationId,
        };
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Post('password-reset/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completeReset(
    @Body() body: PasswordResetCompleteDto,
    @Req() request: Request,
  ): Promise<void> {
    const correlationId = correlationIdFrom(request);

    await this.consumeRateLimit(`password-reset-complete:${request.ip}`, 10, 900, correlationId);

    await this.runAnonymous(request, async () => {
      try {
        await this.completePasswordReset.complete({
          tokenId: body.tokenId,
          rawToken: body.token,
          newPlaintextPassword: body.newPassword,
          correlationId,
        });
      } catch (error) {
        throw mapIdentityError(error, correlationId);
      }
    });
  }

  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async listSessions(@Req() request: AuthenticatedHttpRequest): Promise<Record<string, unknown>> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    return this.runAuthenticated(request, auth.identityId, async () => {
      const sessions = await this.sessions.listActiveSessions(auth.identityId);

      return {
        sessions: sessions.map((session) => ({
          sessionId: session.id,
          deviceDisplayName: session.device?.displayName ?? null,
          firstSeenAt: session.device?.firstSeenAt.toISOString() ?? null,
          lastActivityAt: session.lastActivityAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          current: session.id === auth.sessionId,
          revoked: session.status === 'REVOKED',
        })),
        correlationId,
      };
    });
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async revokeSession(
    @Param() params: SessionIdParamDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<void> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    await this.runAuthenticated(request, auth.identityId, async () => {
      const owned = await this.sessions.listActiveSessions(auth.identityId);

      if (!owned.some((session) => session.id === params.sessionId)) {
        throw unauthorized(correlationId);
      }

      await this.sessions.revokeSelectedSession({
        identityId: auth.identityId,
        sessionId: params.sessionId,
        correlationId,
        reason: 'USER_REQUEST',
      });
    });
  }

  @Delete('sessions')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async revokeOtherSessions(@Req() request: AuthenticatedHttpRequest): Promise<void> {
    const correlationId = correlationIdFrom(request);
    const auth = requireAuth(request, correlationId);

    await this.runAuthenticated(request, auth.identityId, async () => {
      await this.sessions.revokeAllExceptCurrent({
        identityId: auth.identityId,
        currentSessionId: auth.sessionId,
        correlationId,
        reason: 'USER_REQUEST',
      });
    });
  }

  private runAnonymous<T>(request: Request, work: () => Promise<T>): Promise<T> {
    return this.tenantExecutionContext.run(
      anonymousTenantContext({
        correlationId: correlationIdFrom(request),
        requestId: requestIdFrom(request),
        executionSource: 'HTTP_REQUEST',
      }),
      work,
    );
  }

  private runAuthenticated<T>(
    request: Request,
    identityId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.tenantExecutionContext.run(
      authenticatedTenantContext({
        identityId,
        correlationId: correlationIdFrom(request),
        requestId: requestIdFrom(request),
        executionSource: 'HTTP_REQUEST',
      }),
      work,
    );
  }

  private async consumeRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    correlationId: string,
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume({ key, limit, windowSeconds });

    if (!allowed) {
      throw new HttpException(
        {
          code: 'REQUEST_THROTTLED',
          message: 'Too many requests.',
          correlationId,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

function requireAuth(request: AuthenticatedHttpRequest, correlationId: string) {
  if (!request.auth) {
    throw unauthorized(correlationId);
  }

  return request.auth;
}

function authenticatedResponse(
  result: {
    readonly identityId: string;
    readonly sessionId: string;
    readonly accessToken: string;
    readonly accessTokenExpiresAt: Date;
  },
  correlationId: string,
): Record<string, unknown> {
  return {
    identityId: result.identityId,
    sessionId: result.sessionId,
    accessToken: result.accessToken,
    accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
    tokenType: 'Bearer',
    correlationId,
  };
}
