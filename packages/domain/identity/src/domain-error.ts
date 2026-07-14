export type IdentityDomainErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED'
  | 'USER_SUSPENDED'
  | 'USER_DEACTIVATED'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REUSED'
  | 'SESSION_REVOKED'
  | 'RESET_TOKEN_INVALID'
  | 'RESET_TOKEN_EXPIRED'
  | 'VERIFICATION_TOKEN_INVALID'
  | 'VERIFICATION_TOKEN_EXPIRED'
  | 'VALIDATION_FAILED';

export class IdentityDomainError extends Error {
  constructor(
    public readonly code: IdentityDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityDomainError';
  }
}
