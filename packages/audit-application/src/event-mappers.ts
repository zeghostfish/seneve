import type { AuditEventName } from '@seneve/domain-audit';
import type { CampaignDomainEvent } from '@seneve/domain-campaign';
import type { CandidateDomainEvent } from '@seneve/domain-candidate';
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

export function mapCampaignDomainEventToAudit(event: CampaignDomainEvent): AuditRecordAppendInput {
  return {
    eventName: toCampaignAuditEventName(event.name),
    occurredAt: event.metadata.occurredAt,
    actor: {
      actorType: event.metadata.actorIdentityId ? 'IDENTITY' : 'SYSTEM',
      actorIdentityId: event.metadata.actorIdentityId,
      actorMembershipId: null,
    },
    tenantId: event.organizationId,
    executionMode: '',
    executionSource: '',
    resource: {
      resourceType: 'campaign',
      resourceId: event.aggregateId,
    },
    action: event.name,
    outcome: 'SUCCEEDED',
    reasonCode: null,
    correlation: {
      correlationId: event.metadata.correlationId,
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: {
      eventId: event.metadata.eventId,
      payload: event.payload,
    },
    retentionCategory: 'GOVERNANCE',
  };
}

export function mapCandidateDomainEventToAudit(
  event: CandidateDomainEvent,
): AuditRecordAppendInput {
  return {
    eventName: toCandidateAuditEventName(event.name),
    occurredAt: event.metadata.occurredAt,
    actor: {
      actorType: event.metadata.actorIdentityId ? 'IDENTITY' : 'SYSTEM',
      actorIdentityId: event.metadata.actorIdentityId,
      actorMembershipId: null,
    },
    tenantId: event.organizationId,
    executionMode: '',
    executionSource: '',
    resource: {
      resourceType: 'candidate',
      resourceId: event.aggregateId,
    },
    action: event.name,
    outcome: 'SUCCEEDED',
    reasonCode: null,
    correlation: {
      correlationId: event.metadata.correlationId,
      requestId: null,
      jobId: null,
    },
    privileged: false,
    privilegedReason: null,
    metadata: {
      eventId: event.metadata.eventId,
      campaignId: event.campaignId,
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

function toCampaignAuditEventName(eventType: CampaignDomainEvent['name']): AuditEventName {
  return eventType
    .replace(/[A-Z]/g, (character, index) => `${index === 0 ? '' : '_'}${character}`)
    .toUpperCase() as AuditEventName;
}

function toCandidateAuditEventName(eventType: CandidateDomainEvent['name']): AuditEventName {
  return eventType
    .replace(/[A-Z]/g, (character, index) => `${index === 0 ? '' : '_'}${character}`)
    .toUpperCase() as AuditEventName;
}
