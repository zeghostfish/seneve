import { auditEventCatalogue, type AuditEventName } from './audit-taxonomy.js';

export type AuditActorType = 'IDENTITY' | 'PLATFORM_ADMIN' | 'SYSTEM' | 'ANONYMOUS' | 'API_CLIENT';
export type AuditOutcome = 'SUCCEEDED' | 'DENIED' | 'FAILED';
export type AuditStreamType = 'TENANT' | 'PLATFORM';
export type AuditRetentionCategory =
  'SECURITY_CRITICAL' | 'GOVERNANCE' | 'FINANCIAL_FUTURE' | 'OPERATIONAL';

export interface AuditActor {
  readonly actorType: AuditActorType;
  readonly actorIdentityId: string | null;
  readonly actorMembershipId: string | null;
}

export interface AuditResource {
  readonly resourceType: string;
  readonly resourceId: string | null;
}

export interface AuditCorrelation {
  readonly correlationId: string;
  readonly requestId: string | null;
  readonly jobId: string | null;
}

export interface AuditRecordDraft {
  readonly id: string;
  readonly eventName: AuditEventName;
  readonly eventVersion: 1;
  readonly occurredAt: Date;
  readonly actor: AuditActor;
  readonly tenantId: string | null;
  readonly executionMode: string;
  readonly executionSource: string;
  readonly resource: AuditResource;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly reasonCode: string | null;
  readonly correlation: AuditCorrelation;
  readonly privileged: boolean;
  readonly privilegedReason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly retentionCategory: AuditRetentionCategory;
}

export interface AuditRecord extends AuditRecordDraft {
  readonly streamType: AuditStreamType;
  readonly streamId: string;
  readonly sequenceNumber: number;
  readonly previousRecordHash: string | null;
  readonly recordHash: string;
  readonly createdAt: Date;
}

export type AuditDomainErrorCode =
  | 'AUDIT_EVENT_UNKNOWN'
  | 'AUDIT_CORRELATION_REQUIRED'
  | 'AUDIT_RESOURCE_REQUIRED'
  | 'AUDIT_PRIVILEGED_REASON_REQUIRED'
  | 'AUDIT_METADATA_UNSAFE';

export class AuditDomainError extends Error {
  constructor(
    readonly code: AuditDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuditDomainError';
  }
}

export function validateAuditRecordDraft(draft: AuditRecordDraft): void {
  if (!auditEventCatalogue[draft.eventName]) {
    throw new AuditDomainError('AUDIT_EVENT_UNKNOWN', 'Audit event is not registered.');
  }

  if (draft.correlation.correlationId.trim().length === 0) {
    throw new AuditDomainError('AUDIT_CORRELATION_REQUIRED', 'Audit correlation id is required.');
  }

  if (draft.resource.resourceType.trim().length === 0) {
    throw new AuditDomainError('AUDIT_RESOURCE_REQUIRED', 'Audit resource type is required.');
  }

  if (draft.privileged && !draft.privilegedReason?.trim()) {
    throw new AuditDomainError(
      'AUDIT_PRIVILEGED_REASON_REQUIRED',
      'Privileged audit records require a reason.',
    );
  }
}
