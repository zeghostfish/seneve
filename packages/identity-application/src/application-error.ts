export type IdentityApplicationErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'IDENTITY_SUSPENDED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'SESSION_INVALID'
  | 'SESSION_REVOKED'
  | 'REFRESH_TOKEN_INVALID'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REUSED'
  | 'REGISTRATION_CONFLICT'
  | 'PASSWORD_POLICY_VIOLATION'
  | 'AUTHENTICATION_TRANSACTION_FAILED';

export class IdentityApplicationError extends Error {
  constructor(
    public readonly code: IdentityApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityApplicationError';
  }
}
