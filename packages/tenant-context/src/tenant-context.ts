export type TenantExecutionSource =
  | 'HTTP_REQUEST'
  | 'WORKER_JOB'
  | 'CLI_COMMAND'
  | 'SCHEDULED_TASK'
  | 'INTERNAL_WORKFLOW'
  | 'WEBHOOK'
  | 'API_TOKEN';

export type TenantExecutionMode =
  'ANONYMOUS' | 'AUTHENTICATED' | 'TENANT' | 'PLATFORM_ADMIN' | 'CROSS_TENANT' | 'SYSTEM';

export type TenantScopeKind = 'NONE' | 'TENANT' | 'CROSS_TENANT' | 'SYSTEM';

export type TenantRole =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'EVENT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'CONTENT_MANAGER'
  | 'VIEWER'
  | 'AUDITOR';

export type PlatformRole = 'PLATFORM_SUPER_ADMINISTRATOR';

export interface TenantScope {
  readonly kind: TenantScopeKind;
  readonly tenantId?: string;
  readonly targetTenantId?: string;
  readonly reason?: string;
}

export interface TenantContext {
  readonly tenantId: string | null;
  readonly identityId: string | null;
  readonly membershipId: string | null;
  readonly role: TenantRole | PlatformRole | null;
  readonly permissions: readonly string[];
  readonly correlationId: string;
  readonly requestId: string | null;
  readonly executionSource: TenantExecutionSource;
  readonly executionMode: TenantExecutionMode;
  readonly scope: TenantScope;
  readonly auditMetadata?: Readonly<Record<string, unknown>>;
}

export type TenantContextErrorCode =
  | 'TENANT_CONTEXT_MISSING'
  | 'TENANT_REQUIRED'
  | 'IDENTITY_REQUIRED'
  | 'MEMBERSHIP_REQUIRED'
  | 'CORRELATION_REQUIRED'
  | 'PLATFORM_ADMIN_REQUIRED'
  | 'CROSS_TENANT_TARGET_REQUIRED'
  | 'CROSS_TENANT_REASON_REQUIRED'
  | 'SYSTEM_EXECUTION_FORBIDDEN';

export class TenantContextError extends Error {
  constructor(
    readonly code: TenantContextErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TenantContextError';
  }
}

export function anonymousTenantContext(input: {
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
}): TenantContext {
  assertCorrelation(input.correlationId);

  return {
    tenantId: null,
    identityId: null,
    membershipId: null,
    role: null,
    permissions: [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'ANONYMOUS',
    scope: { kind: 'NONE' },
  };
}

export function authenticatedTenantContext(input: {
  readonly identityId: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
  readonly permissions?: readonly string[];
}): TenantContext {
  assertCorrelation(input.correlationId);
  assertPresent(
    input.identityId,
    'IDENTITY_REQUIRED',
    'Authenticated execution requires identity.',
  );

  return {
    tenantId: null,
    identityId: input.identityId,
    membershipId: null,
    role: null,
    permissions: input.permissions ?? [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'AUTHENTICATED',
    scope: { kind: 'NONE' },
  };
}

export function authenticatedVotingTenantContext(input: {
  readonly tenantId: string;
  readonly identityId: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
}): TenantContext {
  assertCorrelation(input.correlationId);
  assertPresent(input.tenantId, 'TENANT_REQUIRED', 'Voting execution requires tenant.');
  assertPresent(input.identityId, 'IDENTITY_REQUIRED', 'Voting execution requires identity.');

  return {
    tenantId: input.tenantId,
    identityId: input.identityId,
    membershipId: null,
    role: null,
    permissions: [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'AUTHENTICATED',
    scope: { kind: 'TENANT', tenantId: input.tenantId },
  };
}

export function organizationTenantContext(input: {
  readonly tenantId: string;
  readonly identityId: string;
  readonly membershipId: string;
  readonly role: TenantRole;
  readonly permissions?: readonly string[];
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
}): TenantContext {
  assertCorrelation(input.correlationId);
  assertPresent(input.tenantId, 'TENANT_REQUIRED', 'Tenant execution requires tenant.');
  assertPresent(input.identityId, 'IDENTITY_REQUIRED', 'Tenant execution requires identity.');
  assertPresent(input.membershipId, 'MEMBERSHIP_REQUIRED', 'Tenant execution requires membership.');

  return {
    tenantId: input.tenantId,
    identityId: input.identityId,
    membershipId: input.membershipId,
    role: input.role,
    permissions: input.permissions ?? [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'TENANT',
    scope: { kind: 'TENANT', tenantId: input.tenantId },
  };
}

export function platformAdminTenantContext(input: {
  readonly identityId: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
  readonly permissions?: readonly string[];
  readonly auditMetadata?: Readonly<Record<string, unknown>>;
}): TenantContext {
  assertCorrelation(input.correlationId);
  assertPresent(input.identityId, 'IDENTITY_REQUIRED', 'Platform execution requires identity.');

  return {
    tenantId: null,
    identityId: input.identityId,
    membershipId: null,
    role: 'PLATFORM_SUPER_ADMINISTRATOR',
    permissions: input.permissions ?? [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'PLATFORM_ADMIN',
    scope: { kind: 'SYSTEM' },
    auditMetadata: input.auditMetadata,
  };
}

export function crossTenantTenantContext(input: {
  readonly targetTenantId: string;
  readonly identityId: string;
  readonly correlationId: string;
  readonly requestId?: string | null;
  readonly executionSource: TenantExecutionSource;
  readonly permissions?: readonly string[];
  readonly platformRoles: readonly PlatformRole[];
  readonly reason: string;
  readonly auditMetadata?: Readonly<Record<string, unknown>>;
}): TenantContext {
  assertCorrelation(input.correlationId);
  assertPresent(
    input.targetTenantId,
    'CROSS_TENANT_TARGET_REQUIRED',
    'Cross-tenant execution requires target tenant.',
  );
  assertPresent(input.identityId, 'IDENTITY_REQUIRED', 'Cross-tenant execution requires identity.');
  assertPresent(
    input.reason,
    'CROSS_TENANT_REASON_REQUIRED',
    'Cross-tenant execution requires reason.',
  );

  if (!input.platformRoles.includes('PLATFORM_SUPER_ADMINISTRATOR')) {
    throw new TenantContextError(
      'PLATFORM_ADMIN_REQUIRED',
      'Cross-tenant execution requires platform administrator role.',
    );
  }

  return {
    tenantId: input.targetTenantId,
    identityId: input.identityId,
    membershipId: null,
    role: 'PLATFORM_SUPER_ADMINISTRATOR',
    permissions: input.permissions ?? [],
    correlationId: input.correlationId,
    requestId: input.requestId ?? null,
    executionSource: input.executionSource,
    executionMode: 'CROSS_TENANT',
    scope: {
      kind: 'CROSS_TENANT',
      targetTenantId: input.targetTenantId,
      reason: input.reason,
    },
    auditMetadata: {
      ...input.auditMetadata,
      reason: input.reason,
    },
  };
}

export function systemTenantContext(input: {
  readonly correlationId: string;
  readonly executionSource: Exclude<TenantExecutionSource, 'HTTP_REQUEST' | 'API_TOKEN'>;
  readonly permissions?: readonly string[];
  readonly auditMetadata?: Readonly<Record<string, unknown>>;
}): TenantContext {
  assertCorrelation(input.correlationId);

  if (input.executionSource === 'WEBHOOK') {
    throw new TenantContextError(
      'SYSTEM_EXECUTION_FORBIDDEN',
      'Webhook execution must resolve an authenticated or tenant-scoped context.',
    );
  }

  return {
    tenantId: null,
    identityId: null,
    membershipId: null,
    role: null,
    permissions: input.permissions ?? [],
    correlationId: input.correlationId,
    requestId: null,
    executionSource: input.executionSource,
    executionMode: 'SYSTEM',
    scope: { kind: 'SYSTEM' },
    auditMetadata: input.auditMetadata,
  };
}

export function requireTenantContext(context: TenantContext | undefined): TenantContext {
  if (!context) {
    throw new TenantContextError('TENANT_CONTEXT_MISSING', 'Tenant context is not available.');
  }

  return context;
}

export function requireTenantScope(context: TenantContext): string {
  if (!context.tenantId) {
    throw new TenantContextError('TENANT_REQUIRED', 'Tenant-scoped execution requires tenant.');
  }

  return context.tenantId;
}

function assertCorrelation(correlationId: string): void {
  assertPresent(
    correlationId,
    'CORRELATION_REQUIRED',
    'Execution requires correlation identifier.',
  );
}

function assertPresent(value: string, code: TenantContextErrorCode, message: string): void {
  if (value.trim().length === 0) {
    throw new TenantContextError(code, message);
  }
}
