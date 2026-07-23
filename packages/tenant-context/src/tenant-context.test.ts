import { describe, expect, it } from 'vitest';

import {
  AsyncLocalStorageTenantContextProvider,
  DefaultTenantResolver,
  TenantContextError,
  TenantExecutionContext,
  authenticatedVotingTenantContext,
  organizationTenantContext,
} from './index.js';

const resolver = new DefaultTenantResolver();

describe('Tenant Context Engine', () => {
  it('creates anonymous and tenant-scoped HTTP contexts', () => {
    const anonymous = resolver.fromHttp({
      correlationId: 'correlation-1',
      requestId: 'request-1',
    });

    expect(anonymous).toMatchObject({
      tenantId: null,
      identityId: null,
      executionSource: 'HTTP_REQUEST',
      executionMode: 'ANONYMOUS',
      correlationId: 'correlation-1',
      requestId: 'request-1',
    });

    const tenant = resolver.fromHttp({
      correlationId: 'correlation-2',
      requestId: 'request-2',
      principal: {
        identityId: 'identity-1',
        permissions: ['organization:read'],
      },
      tenant: {
        tenantId: 'organization-1',
        membershipId: 'membership-1',
        role: 'OWNER',
        permissions: ['organization:read'],
      },
    });

    expect(tenant).toMatchObject({
      tenantId: 'organization-1',
      identityId: 'identity-1',
      membershipId: 'membership-1',
      role: 'OWNER',
      executionMode: 'TENANT',
      scope: {
        kind: 'TENANT',
        tenantId: 'organization-1',
      },
    });
  });

  it('propagates worker tenant context across async work', async () => {
    const provider = new AsyncLocalStorageTenantContextProvider();
    const execution = new TenantExecutionContext(provider);
    const context = resolver.fromWorker({
      correlationId: 'correlation-worker',
      identityId: 'identity-worker',
      tenant: {
        tenantId: 'organization-worker',
        membershipId: 'membership-worker',
        role: 'ADMINISTRATOR',
      },
    });

    await execution.run(context, async () => {
      await Promise.resolve();

      expect(execution.requireCurrent()).toMatchObject({
        tenantId: 'organization-worker',
        executionSource: 'WORKER_JOB',
      });
    });
  });

  it('preserves context through nested application services and transaction boundaries', async () => {
    const provider = new AsyncLocalStorageTenantContextProvider();
    const execution = new TenantExecutionContext(provider);
    const context = organizationTenantContext({
      tenantId: 'organization-1',
      identityId: 'identity-1',
      membershipId: 'membership-1',
      role: 'OWNER',
      correlationId: 'correlation-nested',
      executionSource: 'INTERNAL_WORKFLOW',
    });
    const unitOfWork = new RecordingUnitOfWork(execution);

    const result = await execution.run(context, () =>
      nestedApplicationService(execution, () =>
        unitOfWork.transaction(async () => execution.requireCurrent().tenantId),
      ),
    );

    expect(result).toBe('organization-1');
    expect(unitOfWork.observedCorrelationIds).toEqual(['correlation-nested']);
  });

  it('requires explicit platform authority and reason for cross-tenant execution', () => {
    expect(() =>
      resolver.fromHttp({
        correlationId: 'correlation-cross',
        principal: {
          identityId: 'identity-platform',
          platformRoles: [],
        },
        crossTenant: {
          targetTenantId: 'organization-target',
          reason: 'support investigation',
        },
      }),
    ).toThrowError(TenantContextError);

    const context = resolver.fromHttp({
      correlationId: 'correlation-cross',
      principal: {
        identityId: 'identity-platform',
        platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
      },
      crossTenant: {
        targetTenantId: 'organization-target',
        reason: 'support investigation',
      },
    });

    expect(context).toMatchObject({
      tenantId: 'organization-target',
      identityId: 'identity-platform',
      role: 'PLATFORM_SUPER_ADMINISTRATOR',
      executionMode: 'CROSS_TENANT',
      scope: {
        kind: 'CROSS_TENANT',
        targetTenantId: 'organization-target',
        reason: 'support investigation',
      },
    });
  });

  it('distinguishes system execution and rejects missing correlation identifiers', () => {
    const context = resolver.fromSystem({
      correlationId: 'correlation-system',
      executionSource: 'SCHEDULED_TASK',
      permissions: ['system:admin'],
    });

    expect(context).toMatchObject({
      tenantId: null,
      identityId: null,
      executionMode: 'SYSTEM',
      executionSource: 'SCHEDULED_TASK',
    });
    expect(() =>
      resolver.fromSystem({
        correlationId: '',
        executionSource: 'CLI_COMMAND',
      }),
    ).toThrowError(TenantContextError);
  });

  it('creates a voter tenant context without fabricating organization membership', () => {
    const context = authenticatedVotingTenantContext({
      tenantId: 'organization-vote',
      identityId: 'identity-voter',
      correlationId: 'correlation-vote',
      executionSource: 'HTTP_REQUEST',
    });

    expect(context).toMatchObject({
      tenantId: 'organization-vote',
      identityId: 'identity-voter',
      membershipId: null,
      role: null,
      permissions: [],
      executionMode: 'AUTHENTICATED',
      scope: { kind: 'TENANT', tenantId: 'organization-vote' },
    });
  });
});

async function nestedApplicationService<T>(
  execution: TenantExecutionContext,
  work: () => Promise<T>,
): Promise<T> {
  execution.requireCurrent();

  return work();
}

class RecordingUnitOfWork {
  readonly observedCorrelationIds: string[] = [];

  constructor(private readonly execution: TenantExecutionContext) {}

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    this.observedCorrelationIds.push(this.execution.requireCurrent().correlationId);

    return work();
  }
}
