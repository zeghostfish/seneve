import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { AUTH_HTTP_CONFIG } from '../auth.tokens.js';
import type { AuthHttpConfig } from '../auth-http.types.js';
import { correlationIdFrom } from '../providers/http-context.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AUTH_HTTP_CONFIG) private readonly config: AuthHttpConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return true;
    }

    const origin = request.headers.origin;

    if (!origin) {
      return true;
    }

    if (this.config.allowedOrigins.includes(origin)) {
      return true;
    }

    throw new ForbiddenException({
      code: 'CSRF_ORIGIN_DENIED',
      message: 'Request origin is not allowed.',
      correlationId: correlationIdFrom(request),
    });
  }
}
