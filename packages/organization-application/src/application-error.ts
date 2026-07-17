export type OrganizationApplicationErrorCode =
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_VERSION_CONFLICT'
  | 'ORGANIZATION_TRANSACTION_FAILED'
  | 'PERMISSION_DENIED'
  | 'TENANT_REQUIRED'
  | 'INVITATION_TOKEN_INVALID'
  | 'REQUEST_INVALID';

export class OrganizationApplicationError extends Error {
  constructor(
    readonly code: OrganizationApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OrganizationApplicationError';
  }
}
