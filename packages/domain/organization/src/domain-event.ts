export type OrganizationDomainEventType =
  | 'OrganizationCreated'
  | 'OrganizationActivated'
  | 'OrganizationSuspended'
  | 'OrganizationReactivated'
  | 'OrganizationClosed'
  | 'OrganizationArchived'
  | 'OrganizationProfileUpdated'
  | 'MembershipCreated'
  | 'MembershipActivated'
  | 'MembershipRoleChanged'
  | 'MembershipSuspended'
  | 'MembershipRemoved'
  | 'InvitationCreated'
  | 'InvitationRevoked'
  | 'InvitationExpired'
  | 'InvitationAccepted'
  | 'OwnershipTransferred';

export interface OrganizationDomainEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventId: string;
  readonly eventType: OrganizationDomainEventType;
  readonly aggregateId: string;
  readonly actorId?: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payloadVersion: 1;
  readonly payload: TPayload;
}

export interface OrganizationEventMetadata {
  readonly eventId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly actorId?: string;
  readonly occurredAt?: Date;
}

export function createOrganizationEvent<TPayload extends Record<string, unknown>>(input: {
  readonly eventType: OrganizationDomainEventType;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly metadata: OrganizationEventMetadata;
}): OrganizationDomainEvent<TPayload> {
  return {
    eventId: input.metadata.eventId,
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    actorId: input.metadata.actorId,
    occurredAt: input.metadata.occurredAt ?? new Date(),
    correlationId: input.metadata.correlationId,
    causationId: input.metadata.causationId,
    payloadVersion: 1,
    payload: input.payload,
  };
}
