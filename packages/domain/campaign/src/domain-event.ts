import type { CampaignRulesSnapshot, CampaignStatus, CampaignVisibility } from './value-objects.js';

export type CampaignDomainEventName =
  | 'CampaignCreated'
  | 'CampaignUpdated'
  | 'CampaignScheduled'
  | 'CampaignActivated'
  | 'CampaignPaused'
  | 'CampaignCompleted'
  | 'CampaignCancelled'
  | 'CampaignArchived'
  | 'CampaignRulesUpdated';

export interface CampaignEventMetadata {
  readonly eventId: string;
  readonly correlationId: string;
  readonly actorIdentityId: string;
  readonly occurredAt: Date;
}

export interface CampaignDomainEvent {
  readonly name: CampaignDomainEventName;
  readonly version: 1;
  readonly aggregateId: string;
  readonly organizationId: string;
  readonly metadata: CampaignEventMetadata;
  readonly payload: Record<string, unknown>;
}

export function campaignEvent(input: {
  readonly name: CampaignDomainEventName;
  readonly campaignId: string;
  readonly organizationId: string;
  readonly metadata: CampaignEventMetadata;
  readonly payload?: Record<string, unknown>;
}): CampaignDomainEvent {
  return {
    name: input.name,
    version: 1,
    aggregateId: input.campaignId,
    organizationId: input.organizationId,
    metadata: input.metadata,
    payload: input.payload ?? {},
  };
}

export function lifecyclePayload(status: CampaignStatus): Record<string, unknown> {
  return { status };
}

export function campaignUpdatedPayload(input: {
  readonly name: string;
  readonly slug: string;
  readonly visibility: CampaignVisibility;
}): Record<string, unknown> {
  return input;
}

export function rulesPayload(rules: CampaignRulesSnapshot): Record<string, unknown> {
  return {
    votingMode: rules.votingMode,
    votesPerVoter: rules.votesPerVoter,
    allowMultipleCandidates: rules.allowMultipleCandidates,
    requiresEmailVerification: rules.requiresEmailVerification,
    resultsVisibility: rules.results.visibility,
    resultRevealAt: rules.results.revealAt?.toISOString() ?? null,
  };
}
