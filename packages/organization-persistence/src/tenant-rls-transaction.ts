import type { Prisma } from '@prisma/client';
import {
  TenantContextError,
  type TenantContext,
  type TenantExecutionContext,
} from '@seneve/tenant-context';

export type TenantDatabaseOperation =
  'TENANT_ACCESS' | 'ORGANIZATION_BOOTSTRAP' | 'INVITATION_ACCEPTANCE' | 'VOTE_SUBMISSION';

export interface PrismaRlsTransactionClient {
  $transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export interface TenantDatabaseTransactionOptions {
  readonly operation?: TenantDatabaseOperation;
  readonly tenantId?: string;
}

export class PrismaTenantRlsTransactionBoundary {
  constructor(
    private readonly prisma: PrismaRlsTransactionClient,
    private readonly executionContext: TenantExecutionContext,
  ) {}

  async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TenantDatabaseTransactionOptions = {},
  ): Promise<T> {
    const context = this.executionContext.requireCurrent();
    const settings = resolveDatabaseSettings(context, options);

    return this.prisma.$transaction(async (tx) => {
      await applyTenantSettings(tx, settings);

      return work(tx);
    });
  }
}

interface DatabaseTenantSettings {
  readonly tenantId: string | null;
  readonly identityId: string;
  readonly executionMode: string;
  readonly correlationId: string;
  readonly platformAdmin: boolean;
  readonly crossTenant: boolean;
  readonly privilegedReason: string;
  readonly operation: TenantDatabaseOperation;
}

function resolveDatabaseSettings(
  context: TenantContext,
  options: TenantDatabaseTransactionOptions,
): DatabaseTenantSettings {
  const operation = options.operation ?? 'TENANT_ACCESS';
  const tenantId = options.tenantId ?? context.tenantId;

  if (context.correlationId.trim().length === 0) {
    throw new TenantContextError(
      'CORRELATION_REQUIRED',
      'Tenant database transaction requires correlation identifier.',
    );
  }

  if (!tenantId && context.executionMode !== 'PLATFORM_ADMIN') {
    throw new TenantContextError(
      'TENANT_REQUIRED',
      'Tenant database transaction requires tenant identifier.',
    );
  }

  if (operation === 'TENANT_ACCESS') {
    return resolveTenantAccessSettings(context, tenantId, operation);
  }

  return resolveControlledAuthenticatedSettings(context, tenantId, operation);
}

function resolveTenantAccessSettings(
  context: TenantContext,
  tenantId: string | null,
  operation: TenantDatabaseOperation,
): DatabaseTenantSettings {
  if (context.executionMode === 'TENANT') {
    if (!tenantId || context.tenantId !== tenantId) {
      throw new TenantContextError(
        'TENANT_REQUIRED',
        'Tenant database transaction cannot replace tenant context implicitly.',
      );
    }

    return baseSettings(context, tenantId, operation);
  }

  if (context.executionMode === 'CROSS_TENANT') {
    if (context.tenantId === tenantId && context.scope.reason?.trim()) {
      return baseSettings(context, tenantId, operation);
    }

    throw new TenantContextError(
      'CROSS_TENANT_REASON_REQUIRED',
      'Cross-tenant database transaction requires target tenant and reason.',
    );
  }

  if (context.executionMode === 'PLATFORM_ADMIN') {
    return baseSettings(context, tenantId, operation);
  }

  throw new TenantContextError(
    'TENANT_REQUIRED',
    `Execution mode ${context.executionMode} is not allowed for tenant database access.`,
  );
}

function resolveControlledAuthenticatedSettings(
  context: TenantContext,
  tenantId: string | null,
  operation: TenantDatabaseOperation,
): DatabaseTenantSettings {
  if (context.executionMode === 'AUTHENTICATED') {
    if (!context.identityId) {
      throw new TenantContextError(
        'IDENTITY_REQUIRED',
        `${operation} requires an authenticated identity.`,
      );
    }

    return {
      ...baseSettings(context, tenantId, operation),
      executionMode: 'AUTHENTICATED',
    };
  }

  if (context.executionMode === 'PLATFORM_ADMIN' || context.executionMode === 'CROSS_TENANT') {
    return baseSettings(context, tenantId, operation);
  }

  throw new TenantContextError(
    'IDENTITY_REQUIRED',
    `${operation} requires authenticated or privileged execution.`,
  );
}

function baseSettings(
  context: TenantContext,
  tenantId: string | null,
  operation: TenantDatabaseOperation,
): DatabaseTenantSettings {
  return {
    tenantId,
    identityId: context.identityId ?? '',
    executionMode: context.executionMode,
    correlationId: context.correlationId,
    platformAdmin: context.role === 'PLATFORM_SUPER_ADMINISTRATOR',
    crossTenant: context.executionMode === 'CROSS_TENANT',
    privilegedReason: context.scope.reason ?? '',
    operation,
  };
}

async function applyTenantSettings(
  tx: Prisma.TransactionClient,
  settings: DatabaseTenantSettings,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${settings.tenantId ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.identity_id', ${settings.identityId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.execution_mode', ${settings.executionMode}, true)`;
  await tx.$executeRaw`SELECT set_config('app.correlation_id', ${settings.correlationId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.platform_admin', ${String(settings.platformAdmin)}, true)`;
  await tx.$executeRaw`SELECT set_config('app.cross_tenant', ${String(settings.crossTenant)}, true)`;
  await tx.$executeRaw`SELECT set_config('app.privileged_reason', ${settings.privilegedReason}, true)`;
  await tx.$executeRaw`SELECT set_config('app.operation', ${settings.operation}, true)`;
}
