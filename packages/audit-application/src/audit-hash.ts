import { createHash } from 'node:crypto';

import type { AuditRecord, AuditRecordDraft } from '@seneve/domain-audit';

export const AUDIT_HASH_ALGORITHM = 'sha256';

export function canonicalizeAuditPayload(draft: AuditRecordDraft): string {
  return stableStringify({
    id: draft.id,
    eventName: draft.eventName,
    eventVersion: draft.eventVersion,
    occurredAt: draft.occurredAt.toISOString(),
    actor: draft.actor,
    tenantId: draft.tenantId,
    executionMode: draft.executionMode,
    executionSource: draft.executionSource,
    resource: draft.resource,
    action: draft.action,
    outcome: draft.outcome,
    reasonCode: draft.reasonCode,
    correlation: draft.correlation,
    privileged: draft.privileged,
    privilegedReason: draft.privilegedReason,
    metadata: draft.metadata,
    retentionCategory: draft.retentionCategory,
  });
}

export function calculateAuditRecordHash(input: {
  readonly canonicalPayload: string;
  readonly previousRecordHash: string | null;
}): string {
  const hash = createHash(AUDIT_HASH_ALGORITHM);
  hash.update(input.previousRecordHash ?? 'GENESIS');
  hash.update('\n');
  hash.update(input.canonicalPayload);

  return `${AUDIT_HASH_ALGORITHM}:${hash.digest('hex')}`;
}

export function verifyAuditChain(records: readonly AuditRecord[]): boolean {
  let previousHash: string | null = null;

  for (const record of records) {
    const canonicalPayload = canonicalizeAuditPayload(record);
    const expected = calculateAuditRecordHash({
      canonicalPayload,
      previousRecordHash: previousHash,
    });

    if (record.previousRecordHash !== previousHash || record.recordHash !== expected) {
      return false;
    }

    previousHash = record.recordHash;
  }

  return true;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(',')}}`;
}
