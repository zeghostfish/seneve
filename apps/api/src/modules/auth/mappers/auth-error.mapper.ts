import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { IdentityApplicationError } from '@seneve/identity-application';

export interface PublicErrorBody {
  readonly code: string;
  readonly message: string;
  readonly correlationId: string;
}

export function mapIdentityError(error: unknown, correlationId: string): HttpException {
  if (!(error instanceof IdentityApplicationError)) {
    return new InternalServerErrorException({
      code: 'INTERNAL_ERROR',
      message: 'The request could not be completed.',
      correlationId,
    } satisfies PublicErrorBody);
  }

  const status = statusForCode(error.code);

  return new HttpException(
    {
      code: publicCode(error.code),
      message: publicMessage(error.code),
      correlationId,
    } satisfies PublicErrorBody,
    status,
  );
}

function statusForCode(code: IdentityApplicationError['code']): HttpStatus {
  switch (code) {
    case 'INVALID_CREDENTIALS':
    case 'SESSION_INVALID':
    case 'SESSION_REVOKED':
    case 'REFRESH_TOKEN_INVALID':
    case 'REFRESH_TOKEN_EXPIRED':
    case 'REFRESH_TOKEN_REUSED':
      return HttpStatus.UNAUTHORIZED;
    case 'IDENTITY_SUSPENDED':
    case 'EMAIL_VERIFICATION_REQUIRED':
      return HttpStatus.FORBIDDEN;
    case 'PASSWORD_POLICY_VIOLATION':
    case 'PASSWORD_REUSE_NOT_ALLOWED':
      return HttpStatus.UNPROCESSABLE_ENTITY;
    case 'EMAIL_VERIFICATION_REQUEST_THROTTLED':
    case 'PASSWORD_RESET_REQUEST_THROTTLED':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'REGISTRATION_CONFLICT':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

function publicCode(code: IdentityApplicationError['code']): string {
  if (code === 'REGISTRATION_CONFLICT') {
    return 'REGISTRATION_UNAVAILABLE';
  }

  return code;
}

function publicMessage(code: IdentityApplicationError['code']): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid credentials.';
    case 'REGISTRATION_CONFLICT':
      return 'Registration could not be completed.';
    case 'PASSWORD_POLICY_VIOLATION':
      return 'Password does not satisfy the policy.';
    case 'EMAIL_VERIFICATION_REQUIRED':
      return 'Email verification is required.';
    case 'REFRESH_TOKEN_REUSED':
      return 'Session could not be refreshed.';
    default:
      return 'The request could not be completed.';
  }
}

export function unauthorized(correlationId: string): UnauthorizedException {
  return new UnauthorizedException({
    code: 'UNAUTHORIZED',
    message: 'Authentication is required.',
    correlationId,
  } satisfies PublicErrorBody);
}
