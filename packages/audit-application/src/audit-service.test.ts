import { describe, expect, it } from 'vitest';

import { AuditDomainError, type AuditRecord } from '@seneve/domain-audit';
import {
  AsyncLocalStorageTenantContextProvider,
  TenantExecutionContext,
  crossTenantTenantContext,
  organizationTenantContext,
} from '@seneve/tenant-context';

import type {
  AuditQuery,
  AuditRecordAppendInput,
  AuditRepository,
  PreparedAuditRecordAppend,
} from './audit-contracts.js';
import {
  calculateAuditRecordHash,
  canonicalizeAuditPayload,
  verifyAuditChain,
} from './audit-hash.js';
import {
  AuditingSecurityEventRecorder,
  OrganizationAuditEventRecorder,
} from './audit-integrations.js';
import { sanitizeAuditMetadata } from './audit-metadata.js';
import { AppendAuditRecordService } from './audit-service.js';
import {
  mapIdentitySecurityEventToAudit,
  mapOrganizationDomainEventToAudit,
} from './event-mappers.js';

const occurredAt = new Date('2026-07-15T12:00:00.000Z');
const createdAt = new Date('2026-07-15T12:00:01.000Z');

describe('AppendAuditRecordService', () => {
  it('appends a tenant-scoped audit record with sanitized metadata and hash chain data', async () => {
    const repository = new MemoryAuditRepository();
    const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
    const service = new AppendAuditRecordService({
      repository,
      executionContext: execution,
      ids: { uuid: () => 'audit-record-1' },
      now: () => createdAt,
    });
    const context = organizationTenantContext({
      tenantId: 'organization-1',
      identityId: 'identity-1',
      membershipId: 'membership-1',
      role: 'OWNER',
      correlationId: 'correlation-1',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    const result = await execution.run(context, () =>
      service.append({
        eventName: 'ORGANIZATION_CREATED',
        occurredAt,
        tenantId: null,
        resource: {
          resourceType: 'organization',
          resourceId: 'organization-1',
        },
        action: 'organization.create',
        outcome: 'SUCCEEDED',
        reasonCode: null,
        correlation: {
          correlationId: '',
          requestId: null,
          jobId: null,
        },
        privileged: false,
        privilegedReason: null,
        metadata: {
          passwordHash: 'secret-hash',
          displayName: 'Seneve Awards',
        },
        retentionCategory: 'GOVERNANCE',
      }),
    );

    expect(result).toMatchObject({
      auditRecordId: 'audit-record-1',
      streamType: 'TENANT',
      streamId: 'organization-1',
      sequenceNumber: 1,
    });
    expect(repository.records[0]).toMatchObject({
      tenantId: 'organization-1',
      actor: {
        actorIdentityId: 'identity-1',
        actorMembershipId: 'membership-1',
      },
      metadata: {
        passwordHash: '[REDACTED]',
        displayName: 'Seneve Awards',
      },
    });
  });

  it('requires a reason for privileged audit records', async () => {
    const repository = new MemoryAuditRepository();
    const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
    const service = new AppendAuditRecordService({
      repository,
      executionContext: execution,
      ids: { uuid: () => 'audit-record-2' },
      now: () => createdAt,
    });
    const context = crossTenantTenantContext({
      targetTenantId: 'organization-1',
      identityId: 'platform-admin',
      platformRoles: ['PLATFORM_SUPER_ADMINISTRATOR'],
      reason: 'support investigation',
      correlationId: 'correlation-privileged',
      executionSource: 'INTERNAL_WORKFLOW',
    });

    await expect(
      execution.run(context, () =>
        service.append({
          ...baseInput(),
          privileged: true,
          privilegedReason: '',
        }),
      ),
    ).rejects.toThrowError(AuditDomainError);
  });
});

describe('audit hashing and event mappers', () => {
  it('validates a deterministic per-stream hash chain', () => {
    const repository = new MemoryAuditRepository();
    const first = repository.appendPrepared(prepared(baseInput(), 'record-1'));
    const second = repository.appendPrepared(
      prepared(
        {
          ...baseInput(),
          eventName: 'ORGANIZATION_ACTIVATED',
          action: 'organization.activate',
        },
        'record-2',
      ),
    );

    expect(verifyAuditChain([first, second])).toBe(true);
    expect(verifyAuditChain([{ ...first, recordHash: 'sha256:tampered' }, second])).toBe(false);
  });

  it('redacts sensitive metadata recursively', () => {
    expect(
      sanitizeAuditMetadata({
        nested: {
          rawRefreshToken: 'token',
        },
        authorizationHeader: 'Bearer secret',
      }),
    ).toEqual({
      nested: {
        rawRefreshToken: '[REDACTED]',
      },
      authorizationHeader: '[REDACTED]',
    });
  });

  it('maps existing identity security and organization domain events to audit inputs', () => {
    expect(
      mapIdentitySecurityEventToAudit({
        identityId: 'identity-1',
        eventType: 'LOGIN_FAILED',
        occurredAt,
        correlationId: 'correlation-login',
        metadata: {
          reason: 'PASSWORD_MISMATCH',
        },
      }),
    ).toMatchObject({
      eventName: 'LOGIN_FAILED',
      outcome: 'FAILED',
      resource: {
        resourceType: 'identity',
        resourceId: 'identity-1',
      },
    });

    expect(
      mapOrganizationDomainEventToAudit({
        eventId: 'event-1',
        eventType: 'OwnershipTransferred',
        aggregateId: 'organization-1',
        actorId: 'identity-1',
        occurredAt,
        correlationId: 'correlation-org',
        payloadVersion: 1,
        payload: {},
      }),
    ).toMatchObject({
      eventName: 'OWNERSHIP_TRANSFERRED',
      tenantId: 'organization-1',
      retentionCategory: 'GOVERNANCE',
    });
  });
});

describe('audit integration adapters', () => {
  it('fails mandatory identity events when audit append fails', async () => {
    const delegate = new MemorySecurityEventRecorder();
    const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
    const service = new AppendAuditRecordService({
      repository: new FailingAuditRepository(),
      executionContext: execution,
      ids: { uuid: () => 'audit-failure' },
      now: () => createdAt,
    });
    const recorder = new AuditingSecurityEventRecorder(delegate, service, {
      mandatoryAuditEvents: ['PASSWORD_RESET_COMPLETED'],
    });

    await expect(
      execution.run(
        organizationTenantContext({
          tenantId: 'organization-1',
          identityId: 'identity-1',
          membershipId: 'membership-1',
          role: 'OWNER',
          correlationId: 'correlation-mandatory',
          executionSource: 'INTERNAL_WORKFLOW',
        }),
        () =>
          recorder.record({
            identityId: 'identity-1',
            eventType: 'PASSWORD_RESET_COMPLETED',
            occurredAt,
            correlationId: 'correlation-mandatory',
          }),
      ),
    ).rejects.toThrow('audit unavailable');
    expect(delegate.events).toHaveLength(1);
  });

  it('records organization domain events through the audit adapter', async () => {
    const repository = new MemoryAuditRepository();
    const execution = new TenantExecutionContext(new AsyncLocalStorageTenantContextProvider());
    const service = new AppendAuditRecordService({
      repository,
      executionContext: execution,
      ids: { uuid: () => 'audit-org-event' },
      now: () => createdAt,
    });
    const recorder = new OrganizationAuditEventRecorder(service);

    await execution.run(
      organizationTenantContext({
        tenantId: 'organization-1',
        identityId: 'identity-1',
        membershipId: 'membership-1',
        role: 'OWNER',
        correlationId: 'correlation-org-event',
        executionSource: 'INTERNAL_WORKFLOW',
      }),
      () =>
        recorder.record({
          eventId: 'event-1',
          eventType: 'OrganizationSuspended',
          aggregateId: 'organization-1',
          actorId: 'identity-1',
          occurredAt,
          correlationId: 'correlation-org-event',
          payloadVersion: 1,
          payload: { reason: 'policy_violation' },
        }),
    );

    expect(repository.records).toEqual([
      expect.objectContaining({
        eventName: 'ORGANIZATION_SUSPENDED',
        tenantId: 'organization-1',
      }),
    ]);
  });
});

function baseInput(): AuditRecordAppendInput {
  return {
    eventName: 'ORGANIZATION_CREATED',
    occurredAt,
    tenantId: 'organization-1',
    resource: {
      resourceType: 'organization',
      resourceId: 'organization-1',
    },
    action: 'organization.create',
    outcome: 'SUCCEEDED',
    reasonCode: null,
    correlation: {
      correlationId: 'correlation-1',
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: {},
    retentionCategory: 'GOVERNANCE',
  };
}

function prepared(input: AuditRecordAppendInput, id: string): PreparedAuditRecordAppend {
  const draft = {
    ...input,
    id,
    eventVersion: 1 as const,
    actor: {
      actorType: 'IDENTITY' as const,
      actorIdentityId: 'identity-1',
      actorMembershipId: 'membership-1',
    },
    executionMode: 'TENANT',
    executionSource: 'INTERNAL_WORKFLOW',
  };

  return {
    draft,
    streamType: 'TENANT',
    streamId: 'organization-1',
    canonicalPayload: canonicalizeAuditPayload(draft),
  };
}

class MemoryAuditRepository implements AuditRepository {
  readonly records: AuditRecord[] = [];

  async append(input: PreparedAuditRecordAppend): Promise<AuditRecord> {
    return this.appendPrepared(input);
  }

  appendPrepared(input: PreparedAuditRecordAppend): AuditRecord {
    const previous = this.records.at(-1) ?? null;
    const recordHash = calculateAuditRecordHash({
      canonicalPayload: input.canonicalPayload,
      previousRecordHash: previous?.recordHash ?? null,
    });
    const record: AuditRecord = {
      ...input.draft,
      streamType: input.streamType,
      streamId: input.streamId,
      sequenceNumber: this.records.length + 1,
      previousRecordHash: previous?.recordHash ?? null,
      recordHash,
      createdAt,
    };
    this.records.push(record);

    return record;
  }

  async findLatestInStream(): Promise<AuditRecord | null> {
    return this.records.at(-1) ?? null;
  }

  async findByQuery(_query: AuditQuery): Promise<readonly AuditRecord[]> {
    return this.records;
  }
}

class FailingAuditRepository extends MemoryAuditRepository {
  override async append(): Promise<AuditRecord> {
    throw new Error('audit unavailable');
  }
}

class MemorySecurityEventRecorder {
  readonly events: unknown[] = [];

  async record(input: unknown): Promise<void> {
    this.events.push(input);
  }
}
