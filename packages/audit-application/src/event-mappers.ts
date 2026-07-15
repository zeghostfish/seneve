import type { AuditEventName } from '@seneve/domain-audit';
import type { OrganizationDomainEvent } from '@seneve/domain-organization';
import type { SecurityEventInput } from '@seneve/identity-application';

import type { AuditRecordAppendInput } from './audit-contracts.js';

export function mapIdentitySecurityEventToAudit(event: SecurityEventInput): AuditRecordAppendInput {
  return {
    eventName: event.eventType,
    occurredAt: event.occurredAt,
    actor: {
      actorType: event.identityId ? 'IDENTITY' : 'ANONYMOUS',
      actorIdentityId: event.identityId,
      actorMembershipId: null,
    },
    tenantId: null,
    executionMode: '',
    executionSource: '',
    resource: {
      resourceType: 'identity',
      resourceId: event.identityId,
    },
    action: event.eventType.toLowerCase(),
    outcome: event.eventType.endsWith('FAILED') ? 'FAILED' : 'SUCCEEDED',
    reasonCode: null,
    correlation: {
      correlationId: event.correlationId,
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: event.metadata ?? {},
    retentionCategory: 'SECURITY_CRITICAL',
  };
}

export function mapOrganizationDomainEventToAudit(
  event: OrganizationDomainEvent,
): AuditRecordAppendInput {
  return {
    eventName: toAuditEventName(event.eventType),
    occurredAt: event.occurredAt,
    actor: {
      actorType: event.actorId ? 'IDENTITY' : 'SYSTEM',
      actorIdentityId: event.actorId ?? null,
      actorMembershipId: null,
    },
    tenantId: event.aggregateId,
    executionMode: '',
    executionSource: '',
    resource: {
      resourceType: 'organization',
      resourceId: event.aggregateId,
    },
    action: event.eventType,
    outcome: 'SUCCEEDED',
    reasonCode: null,
    correlation: {
      correlationId: event.correlationId,
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: {
      eventId: event.eventId,
      causationId: event.causationId ?? null,
      payload: event.payload,
    },
    retentionCategory: 'GOVERNANCE',
  };
}

function toAuditEventName(eventType: OrganizationDomainEvent['eventType']): AuditEventName {
  return eventType
    .replace(/[A-Z]/g, (character, index) => `${index === 0 ? '' : '_'}${character}`)
    .toUpperCase() as AuditEventName;
}
