import type { CandidateStatus } from './value-objects.js';

export type CandidateDomainEventName =
  | 'CandidateCreated'
  | 'CandidateUpdated'
  | 'CandidateMarkedEligible'
  | 'CandidateSuspended'
  | 'CandidateReactivated'
  | 'CandidateWithdrawn'
  | 'CandidateDisqualified'
  | 'CandidateArchived'
  | 'CandidatesReordered';

export interface CandidateEventMetadata {
  readonly eventId: string;
  readonly correlationId: string;
  readonly actorIdentityId: string;
  readonly occurredAt: Date;
}

export interface CandidateDomainEvent {
  readonly name: CandidateDomainEventName;
  readonly version: 1;
  readonly aggregateId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly metadata: CandidateEventMetadata;
  readonly payload: Record<string, unknown>;
}

export function candidateEvent(input: {
  readonly name: CandidateDomainEventName;
  readonly candidateId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly metadata: CandidateEventMetadata;
  readonly payload?: Record<string, unknown>;
}): CandidateDomainEvent {
  return {
    name: input.name,
    version: 1,
    aggregateId: input.candidateId,
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    metadata: input.metadata,
    payload: input.payload ?? {},
  };
}

export function statusPayload(status: CandidateStatus, reason?: string | null) {
  return { status, reason: reason ?? null };
}
