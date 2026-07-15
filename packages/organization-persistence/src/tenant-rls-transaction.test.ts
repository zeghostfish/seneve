import { describe, expect, it } from 'vitest';

import {
  AsyncLocalStorageTenantContextProvider,
  TenantContextError,
  TenantExecutionContext,
  authenticatedTenantContext,
  crossTenantTenantContext,
  organizationTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';

import {
  PrismaTenantRlsTransactionBoundary,
  type PrismaRlsTransactionClient,
} from './tenant-rls-transaction.js';

describe('PrismaTenantRlsTransactionBoundary', () => {
  it('sets transaction-local RLS settings for tenant execution', async () => {
    const { execution, boundary, tx } = createBoundary();
    const context = organizationTenantContext({
      tenantId: '44444444-4444-4444-8444-444444444444',
      identityId: '11111111-1111-4111-8111-111111111111',
      membershipId: '55555555-5555-4555-8555-555555555555',
      role: 'OWNER',
      correlationId: 'correlation-tenant',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await execution.run(context, () => boundary.transaction(async () => 'ok'));

    expect(tx.settings).toEqual([
      ['app.tenant_id', '44444444-4444-4444-8444-444444444444'],
      ['app.identity_id', '11111111-1111-4111-8111-111111111111'],
      ['app.execution_mode', 'TENANT'],
      ['app.correlation_id', 'correlation-tenant'],
      ['app.platform_admin', 'false'],
      ['app.cross_tenant', 'false'],
      ['app.privileged_reason', ''],
      ['app.operation', 'TENANT_ACCESS'],
    ]);
  });

  it('rejects tenant database work without current tenant context', async () => {
    const { boundary } = createBoundary();

    await expect(boundary.transaction(async () => 'denied')).rejects.toThrowError(
      TenantContextError,
    );
  });

  it('supports controlled organization bootstrap from authenticated execution', async () => {
    const { execution, boundary, tx } = createBoundary();
    const context = authenticatedTenantContext({
      identityId: '11111111-1111-4111-8111-111111111111',
      correlationId: 'correlation-bootstrap',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await execution.run(context, () =>
      boundary.transaction(async () => 'created', {
        operation: 'ORGANIZATION_BOOTSTRAP',
        tenantId: '44444444-4444-4444-8444-444444444444',
      }),
    );

    expect(tx.settings).toContainEqual(['app.execution_mode', 'AUTHENTICATED']);
    expect(tx.settings).toContainEqual(['app.operation', 'ORGANIZATION_BOOTSTRAP']);
    expect(tx.settings).toContainEqual(['app.tenant_id', '44444444-4444-4444-8444-444444444444']);
  });

  it('requires cross-tenant execution to include target tenant and reason', async () => {
    const { execution, boundary, tx } = createBoundary();
    const context = crossTenantTenantContext({
      targetTenantId: '44444444-4444-4444-8444-444444444444',
      identityId: '99999999-9999-4999-8999-999999999999',
      correlationId: 'correlation-cross',
      executionSource: 'INTERNAL_WORKFLOW',
      platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
      reason: 'support investigation',
    });

    await execution.run(context, () => boundary.transaction(async () => 'ok'));

    expect(tx.settings).toContainEqual(['app.execution_mode', 'CROSS_TENANT']);
    expect(tx.settings).toContainEqual(['app.platform_admin', 'true']);
    expect(tx.settings).toContainEqual(['app.cross_tenant', 'true']);
    expect(tx.settings).toContainEqual(['app.privileged_reason', 'support investigation']);
  });

  it('allows platform administration through an explicit privileged context', async () => {
    const { execution, boundary, tx } = createBoundary();
    const context = platformAdminTenantContext({
      identityId: '99999999-9999-4999-8999-999999999999',
      correlationId: 'correlation-platform',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await execution.run(context, () => boundary.transaction(async () => 'ok'));

    expect(tx.settings).toContainEqual(['app.tenant_id', '']);
    expect(tx.settings).toContainEqual(['app.execution_mode', 'PLATFORM_ADMIN']);
    expect(tx.settings).toContainEqual(['app.platform_admin', 'true']);
  });
});

function createBoundary() {
  const provider = new AsyncLocalStorageTenantContextProvider();
  const execution = new TenantExecutionContext(provider);
  const tx = new FakeTransactionClient();
  const prisma = new FakePrismaClient(tx);
  const boundary = new PrismaTenantRlsTransactionBoundary(
    prisma as unknown as PrismaRlsTransactionClient,
    execution,
  );

  return { execution, boundary, tx };
}

class FakePrismaClient {
  constructor(private readonly tx: FakeTransactionClient) {}

  async $transaction<T>(work: (tx: FakeTransactionClient) => Promise<T>): Promise<T> {
    return work(this.tx);
  }
}

class FakeTransactionClient {
  readonly settings: Array<[string, string]> = [];

  async $executeRaw(strings: TemplateStringsArray, value: unknown): Promise<number> {
    const settingName = strings[0]?.match(/'([^']+)'/)?.[1] ?? 'unknown';
    this.settings.push([settingName, String(value)]);

    return 1;
  }
}
