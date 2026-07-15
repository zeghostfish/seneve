import type {
  AuditActor,
  AuditEventName,
  AuditRecord,
  AuditRecordDraft,
  AuditStreamType,
} from '@seneve/domain-audit';

export interface AuditRecordAppendInput extends Omit<
  AuditRecordDraft,
  'id' | 'eventVersion' | 'actor' | 'executionMode' | 'executionSource'
> {
  readonly id?: string;
  readonly eventVersion?: 1;
  readonly actor?: Partial<AuditActor>;
  readonly executionMode?: string;
  readonly executionSource?: string;
}

export interface AuditAppendResult {
  readonly auditRecordId: string;
  readonly streamType: AuditStreamType;
  readonly streamId: string;
  readonly sequenceNumber: number;
  readonly recordHash: string;
}

export interface AuditRepository {
  append(input: PreparedAuditRecordAppend): Promise<AuditRecord>;
  findLatestInStream(input: {
    readonly streamType: AuditStreamType;
    readonly streamId: string;
  }): Promise<AuditRecord | null>;
  findByQuery(query: AuditQuery): Promise<readonly AuditRecord[]>;
}

export interface PreparedAuditRecordAppend {
  readonly draft: AuditRecordDraft;
  readonly streamType: AuditStreamType;
  readonly streamId: string;
  readonly canonicalPayload: string;
}

export interface AuditQuery {
  readonly tenantId?: string | null;
  readonly eventName?: AuditEventName;
  readonly actorIdentityId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly outcome?: string;
  readonly correlationId?: string;
  readonly privileged?: boolean;
  readonly occurredFrom?: Date;
  readonly occurredTo?: Date;
  readonly limit: number;
  readonly cursorSequenceNumber?: number;
}

export interface AuditIdGenerator {
  uuid(): string;
}
