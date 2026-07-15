export type AuthorizationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POLICY_VIOLATION'
  | 'ROLE_NOT_ASSIGNED'
  | 'TENANT_REQUIRED'
  | 'INVALID_MEMBERSHIP'
  | 'ORGANIZATION_INACTIVE'
  | 'OWNERSHIP_REQUIRED';

export class AuthorizationError extends Error {
  constructor(
    public readonly code: AuthorizationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
