import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AccessTokenVerifier } from '@seneve/identity-application';
import { authenticatedTenantContext, type TenantExecutionContext } from '@seneve/tenant-context';

import type { AuthenticatedHttpRequest } from '../auth-http.types.js';
import { ACCESS_TOKEN_VERIFIER, AUTH_SESSION_VALIDATOR } from '../auth.tokens.js';
import { correlationIdFrom, bearerTokenFrom, requestIdFrom } from '../providers/http-context.js';
import type { AuthSessionValidator } from '../providers/auth-session-validator.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
    @Inject(AUTH_SESSION_VALIDATOR) private readonly sessionValidator: AuthSessionValidator,
    private readonly tenantExecutionContext: TenantExecutionContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const token = bearerTokenFrom(request);
    const correlationId = correlationIdFrom(request);

    if (!token) {
      throw unauthorized(correlationId);
    }

    try {
      const claims = await this.verifier.verify(token);

      if (!(await this.sessionValidator.validate(claims))) {
        throw new Error('Access token session is no longer valid.');
      }

      request.auth = {
        identityId: claims.identityId,
        sessionId: claims.sessionId,
        tokenVersion: claims.tokenVersion,
      };

      this.tenantExecutionContext.run(
        authenticatedTenantContext({
          identityId: claims.identityId,
          correlationId,
          requestId: requestIdFrom(request),
          executionSource: 'HTTP_REQUEST',
        }),
        () => undefined,
      );

      return true;
    } catch {
      throw unauthorized(correlationId);
    }
  }
}

function unauthorized(correlationId: string): UnauthorizedException {
  return new UnauthorizedException({
    code: 'UNAUTHORIZED',
    message: 'Authentication is required.',
    correlationId,
  });
}
