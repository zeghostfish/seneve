import { PrismaClient, type Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { AppendAuditRecordService } from '@seneve/audit-application';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
  organizationTenantContext,
  platformAdminTenantContext,
} from '@seneve/tenant-context';
import { PrismaTenantRlsTransactionBoundary } from '@seneve/organization-persistence';

import { PrismaAuditRepository } from './index.js';

const shouldRunPostgres =
  process.env.RUN_POSTGRES_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
const describePostgres = shouldRunPostgres ? describe : describe.skip;

const prisma = new PrismaClient();
const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
const rls = new PrismaTenantRlsTransactionBoundary(prisma, execution);
const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const occurredAt = new Date('2026-07-15T12:00:00.000Z');
const auditRecordIds = {
  tenantAFirst: '11111111-1111-4111-8111-1111111111a1',
  tenantASecond: '11111111-1111-4111-8111-1111111111a2',
  tenantBFirst: '11111111-1111-4111-8111-1111111111b1',
  rollback: '11111111-1111-4111-8111-1111111111ff',
} as const;

describePostgres('Prisma audit repository', () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('appends immutable audit records with per-tenant sequence and hash chain', async () => {
    await appendTenantAudit(tenantA, auditRecordIds.tenantAFirst, 'record-a1');
    await appendTenantAudit(tenantA, auditRecordIds.tenantASecond, 'record-a2');

    await execution.run(tenantContext(tenantA, 'correlation-read-a'), () =>
      rls.transaction(async (tx) => {
        const records = await tx.auditRecord.findMany({
          orderBy: {
            sequenceNumber: 'asc',
          },
        });

        expect(records).toHaveLength(2);
        expect(records[0]).toMatchObject({
          sequenceNumber: 1,
          previousRecordHash: null,
        });
        expect(records[1]).toMatchObject({
          sequenceNumber: 2,
          previousRecordHash: records[0]?.recordHash,
        });
        await expect(
          tx.auditRecord.update({
            where: {
              id: records[0]!.id,
            },
            data: {
              action: 'tamper',
            },
          }),
        ).rejects.toThrow();
        await expect(
          tx.auditRecord.delete({
            where: {
              id: records[0]!.id,
            },
          }),
        ).rejects.toThrow();
      }),
    );
  });

  it('isolates audit reads by tenant through RLS', async () => {
    await appendTenantAudit(tenantA, auditRecordIds.tenantAFirst, 'record-a1');
    await appendTenantAudit(tenantB, auditRecordIds.tenantBFirst, 'record-b1');

    await execution.run(tenantContext(tenantA, 'correlation-read-tenant-a'), () =>
      rls.transaction(async (tx) => {
        await expect(tx.auditRecord.findMany()).resolves.toEqual([
          expect.objectContaining({
            tenantId: tenantA,
          }),
        ]);
      }),
    );

    await expect(prisma.auditRecord.findMany()).resolves.toEqual([]);
  });

  it('rolls back audit append with the surrounding transaction', async () => {
    await expect(
      execution.run(tenantContext(tenantA, 'correlation-rollback'), () =>
        rls.transaction(async (tx) => {
          const service = auditService(tx, auditRecordIds.rollback);
          await service.append(auditInput(tenantA));
          throw new Error('force rollback');
        }),
      ),
    ).rejects.toThrow('force rollback');

    await execution.run(tenantContext(tenantA, 'correlation-after-rollback'), () =>
      rls.transaction(async (tx) => {
        await expect(tx.auditRecord.count()).resolves.toBe(0);
      }),
    );
  });
});

async function appendTenantAudit(
  tenantId: string,
  id: string,
  correlationLabel: string,
): Promise<void> {
  await execution.run(tenantContext(tenantId, `correlation-${correlationLabel}`), () =>
    rls.transaction(async (tx) => {
      await auditService(tx, id).append(auditInput(tenantId));
    }),
  );
}

function auditService(tx: Prisma.TransactionClient, id: string) {
  return new AppendAuditRecordService({
    repository: new PrismaAuditRepository(tx),
    executionContext: execution,
    ids: { uuid: () => id },
    now: () => new Date('2026-07-15T12:00:01.000Z'),
  });
}

function auditInput(tenantId: string) {
  return {
    eventName: 'ORGANIZATION_CREATED' as const,
    occurredAt,
    tenantId,
    resource: {
      resourceType: 'organization',
      resourceId: tenantId,
    },
    action: 'organization.create',
    outcome: 'SUCCEEDED' as const,
    reasonCode: null,
    correlation: {
      correlationId: '',
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: {},
    retentionCategory: 'GOVERNANCE' as const,
  };
}

function tenantContext(tenantId: string, correlationId: string) {
  return organizationTenantContext({
    tenantId,
    identityId: '11111111-1111-4111-8111-111111111111',
    membershipId: '55555555-5555-4555-8555-555555555555',
    role: 'OWNER',
    correlationId,
    executionSource: 'INTERNAL_WORKFLOW',
  });
}

async function cleanup(): Promise<void> {
  await execution.run(
    platformAdminTenantContext({
      identityId: '99999999-9999-4999-8999-999999999999',
      correlationId: 'correlation-audit-cleanup',
      executionSource: 'INTERNAL_WORKFLOW',
    }),
    () =>
      rls.transaction(async (tx) => {
        await tx.$executeRaw`TRUNCATE TABLE "audit_records"`;
      }),
  );
}
