import {
  type AuditActorType,
  type AuditRecordDraft,
  type AuditStreamType,
  validateAuditRecordDraft,
} from '@seneve/domain-audit';
import { type TenantContext, type TenantExecutionContext } from '@seneve/tenant-context';

import {
  type AuditAppendResult,
  type AuditIdGenerator,
  type AuditRecordAppendInput,
  type AuditRepository,
} from './audit-contracts.js';
import { canonicalizeAuditPayload } from './audit-hash.js';
import { sanitizeAuditMetadata } from './audit-metadata.js';

export class AppendAuditRecordService {
  constructor(
    private readonly deps: {
      readonly repository: AuditRepository;
      readonly executionContext: TenantExecutionContext;
      readonly ids: AuditIdGenerator;
      readonly now: () => Date;
    },
  ) {}

  async append(input: AuditRecordAppendInput): Promise<AuditAppendResult> {
    const context = this.deps.executionContext.requireCurrent();
    const draft = createDraft(input, context, this.deps.ids.uuid(), this.deps.now());
    validateAuditRecordDraft(draft);
    const stream = resolveAuditStream(draft);
    const appended = await this.deps.repository.append({
      draft,
      streamType: stream.streamType,
      streamId: stream.streamId,
      canonicalPayload: canonicalizeAuditPayload(draft),
    });

    return {
      auditRecordId: appended.id,
      streamType: appended.streamType,
      streamId: appended.streamId,
      sequenceNumber: appended.sequenceNumber,
      recordHash: appended.recordHash,
    };
  }
}

function createDraft(
  input: AuditRecordAppendInput,
  context: TenantContext,
  generatedId: string,
  now: Date,
): AuditRecordDraft {
  return {
    ...input,
    id: input.id ?? generatedId,
    eventVersion: input.eventVersion ?? 1,
    occurredAt: input.occurredAt,
    actor: {
      actorType: input.actor?.actorType ?? resolveActorType(context),
      actorIdentityId: input.actor?.actorIdentityId ?? context.identityId,
      actorMembershipId: input.actor?.actorMembershipId ?? context.membershipId,
    },
    tenantId: input.tenantId ?? context.tenantId,
    executionMode: input.executionMode || context.executionMode,
    executionSource: input.executionSource || context.executionSource,
    correlation: {
      correlationId: input.correlation.correlationId || context.correlationId,
      requestId: input.correlation.requestId ?? context.requestId,
      jobId: input.correlation.jobId ?? null,
    },
    privileged:
      input.privileged ||
      context.executionMode === 'PLATFORM_ADMIN' ||
      context.executionMode === 'CROSS_TENANT',
    privilegedReason: input.privilegedReason ?? context.scope.reason ?? null,
    metadata: sanitizeAuditMetadata({
      ...input.metadata,
      auditRecordedAt: now.toISOString(),
    }),
  };
}

function resolveActorType(context: TenantContext): AuditActorType {
  if (!context.identityId && context.executionMode === 'ANONYMOUS') {
    return 'ANONYMOUS';
  }

  if (context.executionMode === 'SYSTEM') {
    return 'SYSTEM';
  }

  if (context.executionMode === 'PLATFORM_ADMIN' || context.executionMode === 'CROSS_TENANT') {
    return 'PLATFORM_ADMIN';
  }

  return 'IDENTITY';
}

function resolveAuditStream(draft: AuditRecordDraft): {
  readonly streamType: AuditStreamType;
  readonly streamId: string;
} {
  if (draft.tenantId) {
    return {
      streamType: 'TENANT',
      streamId: draft.tenantId,
    };
  }

  return {
    streamType: 'PLATFORM',
    streamId: 'platform',
  };
}
