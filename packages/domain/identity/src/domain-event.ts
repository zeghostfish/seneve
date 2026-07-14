export type IdentityDomainEventType =
  | 'IdentityRegistered'
  | 'EmailVerified'
  | 'PhoneVerified'
  | 'PasswordChanged'
  | 'PasswordResetRequested'
  | 'PasswordResetCompleted'
  | 'LoginSucceeded'
  | 'LoginFailed'
  | 'SessionCreated'
  | 'SessionRevoked'
  | 'RefreshTokenRotated'
  | 'RefreshTokenReuseDetected';

export interface IdentityDomainEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventId: string;
  readonly eventType: IdentityDomainEventType;
  readonly aggregateId: string;
  readonly actorId?: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payloadVersion: 1;
  readonly payload: TPayload;
}

export interface DomainEventMetadata {
  readonly eventId: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly actorId?: string;
  readonly occurredAt?: Date;
}

export function createIdentityEvent<TPayload extends Record<string, unknown>>(input: {
  eventType: IdentityDomainEventType;
  aggregateId: string;
  payload: TPayload;
  metadata: DomainEventMetadata;
}): IdentityDomainEvent<TPayload> {
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
