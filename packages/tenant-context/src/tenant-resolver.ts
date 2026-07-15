import {
  anonymousTenantContext,
  authenticatedTenantContext,
  crossTenantTenantContext,
  organizationTenantContext,
  platformAdminTenantContext,
  systemTenantContext,
  type PlatformRole,
  type TenantContext,
  type TenantExecutionSource,
  type TenantRole,
} from './tenant-context.js';

export interface TenantResolver {
  fromHttp(input: HttpTenantResolutionInput): TenantContext;
  fromWorker(input: WorkerTenantResolutionInput): TenantContext;
  fromSystem(input: SystemTenantResolutionInput): TenantContext;
  fromInternal(input: InternalTenantResolutionInput): TenantContext;
}

export interface BaseTenantResolutionInput {
  readonly correlationId: string;
  readonly requestId?: string | null;
}

export interface AuthenticatedPrincipalInput {
  readonly identityId: string;
  readonly platformRoles?: readonly PlatformRole[];
  readonly permissions?: readonly string[];
}

export interface TenantMembershipInput {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly role: TenantRole;
  readonly permissions?: readonly string[];
}

export interface HttpTenantResolutionInput extends BaseTenantResolutionInput {
  readonly principal?: AuthenticatedPrincipalInput | null;
  readonly tenant?: TenantMembershipInput | null;
  readonly crossTenant?: {
    readonly targetTenantId: string;
    readonly reason: string;
    readonly auditMetadata?: Readonly<Record<string, unknown>>;
  } | null;
}

export interface WorkerTenantResolutionInput extends BaseTenantResolutionInput {
  readonly identityId?: string | null;
  readonly tenant?: TenantMembershipInput | null;
  readonly permissions?: readonly string[];
}

export interface SystemTenantResolutionInput {
  readonly correlationId: string;
  readonly executionSource: Extract<TenantExecutionSource, 'CLI_COMMAND' | 'SCHEDULED_TASK'>;
  readonly permissions?: readonly string[];
  readonly auditMetadata?: Readonly<Record<string, unknown>>;
}

export interface InternalTenantResolutionInput extends BaseTenantResolutionInput {
  readonly tenant?: TenantMembershipInput | null;
  readonly identityId?: string | null;
  readonly permissions?: readonly string[];
}

export class DefaultTenantResolver implements TenantResolver {
  fromHttp(input: HttpTenantResolutionInput): TenantContext {
    if (!input.principal) {
      return anonymousTenantContext({
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'HTTP_REQUEST',
      });
    }

    if (input.crossTenant) {
      return crossTenantTenantContext({
        targetTenantId: input.crossTenant.targetTenantId,
        identityId: input.principal.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'HTTP_REQUEST',
        permissions: input.principal.permissions,
        platformRoles: input.principal.platformRoles ?? [],
        reason: input.crossTenant.reason,
        auditMetadata: input.crossTenant.auditMetadata,
      });
    }

    if (input.tenant) {
      return organizationTenantContext({
        ...input.tenant,
        identityId: input.principal.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'HTTP_REQUEST',
      });
    }

    if (input.principal.platformRoles?.includes('PLATFORM_SUPER_ADMINISTRATOR')) {
      return platformAdminTenantContext({
        identityId: input.principal.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'HTTP_REQUEST',
        permissions: input.principal.permissions,
      });
    }

    return authenticatedTenantContext({
      identityId: input.principal.identityId,
      correlationId: input.correlationId,
      requestId: input.requestId,
      executionSource: 'HTTP_REQUEST',
      permissions: input.principal.permissions,
    });
  }

  fromWorker(input: WorkerTenantResolutionInput): TenantContext {
    if (input.identityId && input.tenant) {
      return organizationTenantContext({
        ...input.tenant,
        identityId: input.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'WORKER_JOB',
      });
    }

    return systemTenantContext({
      correlationId: input.correlationId,
      executionSource: 'WORKER_JOB',
      permissions: input.permissions,
    });
  }

  fromSystem(input: SystemTenantResolutionInput): TenantContext {
    return systemTenantContext(input);
  }

  fromInternal(input: InternalTenantResolutionInput): TenantContext {
    if (input.identityId && input.tenant) {
      return organizationTenantContext({
        ...input.tenant,
        identityId: input.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'INTERNAL_WORKFLOW',
      });
    }

    if (input.identityId) {
      return authenticatedTenantContext({
        identityId: input.identityId,
        correlationId: input.correlationId,
        requestId: input.requestId,
        executionSource: 'INTERNAL_WORKFLOW',
        permissions: input.permissions,
      });
    }

    return systemTenantContext({
      correlationId: input.correlationId,
      executionSource: 'INTERNAL_WORKFLOW',
      permissions: input.permissions,
    });
  }
}
