export type VoteAttemptDomainEventName = 'VoteAttemptCreated' | 'VoteConfirmed' | 'VoteRejected';

export interface VoteEventMetadata {
  readonly eventId: string;
  readonly correlationId: string;
  readonly actorIdentityId: string;
  readonly occurredAt: Date;
}

export interface VoteAttemptDomainEvent {
  readonly name: VoteAttemptDomainEventName;
  readonly version: 1;
  readonly aggregateId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly metadata: VoteEventMetadata;
  readonly payload: Readonly<Record<string, unknown>>;
}

export function voteEvent(input: {
  readonly name: VoteAttemptDomainEventName;
  readonly voteAttemptId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly metadata: VoteEventMetadata;
  readonly payload?: Readonly<Record<string, unknown>>;
}): VoteAttemptDomainEvent {
  return {
    name: input.name,
    version: 1,
    aggregateId: input.voteAttemptId,
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    candidateId: input.candidateId,
    metadata: input.metadata,
    payload: input.payload ?? {},
  };
}
