import { CandidateDomainError } from './domain-error.js';
import {
  type CandidateDomainEvent,
  type CandidateEventMetadata,
  candidateEvent,
  statusPayload,
} from './domain-event.js';
import {
  CampaignId,
  CandidateId,
  CandidateSlug,
  type CandidateStatus,
  IdentityRef,
  OrganizationId,
  assertDisplayName,
  assertPosition,
  assertReason,
  normalizeMetadata,
  normalizeOptionalText,
} from './value-objects.js';

export interface CandidateSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly status: CandidateStatus;
  readonly position: number;
  readonly imageAssetId: string | null;
  readonly externalReference: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly statusReason: string | null;
  readonly archivedAt: Date | null;
  readonly version: number;
}

export class Candidate {
  private pendingEvents: CandidateDomainEvent[] = [];

  private constructor(private readonly snapshot: CandidateSnapshot) {}

  static create(input: {
    readonly id: CandidateId;
    readonly organizationId: OrganizationId;
    readonly campaignId: CampaignId;
    readonly displayName: string;
    readonly slug: string;
    readonly shortDescription?: string | null;
    readonly description?: string | null;
    readonly position: number;
    readonly imageAssetId?: string | null;
    readonly externalReference?: string | null;
    readonly metadata?: Readonly<Record<string, unknown>> | null;
    readonly createdBy: IdentityRef;
    readonly createdAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    const candidate = new Candidate({
      id: input.id.value,
      organizationId: input.organizationId.value,
      campaignId: input.campaignId.value,
      displayName: assertDisplayName(input.displayName),
      slug: CandidateSlug.from(input.slug).value,
      shortDescription: normalizeOptionalText(input.shortDescription, 280),
      description: normalizeOptionalText(input.description, 4000),
      status: 'DRAFT',
      position: assertPosition(input.position),
      imageAssetId: normalizeOptionalText(input.imageAssetId, 256),
      externalReference: normalizeOptionalText(input.externalReference, 256),
      metadata: normalizeMetadata(input.metadata),
      createdBy: input.createdBy.value,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      statusReason: null,
      archivedAt: null,
      version: 1,
    });

    candidate.record('CandidateCreated', input.eventMetadata, {
      displayName: candidate.snapshot.displayName,
      slug: candidate.snapshot.slug,
      position: candidate.snapshot.position,
    });
    return candidate;
  }

  static rehydrate(snapshot: CandidateSnapshot): Candidate {
    return new Candidate({ ...snapshot, metadata: { ...snapshot.metadata } });
  }

  update(input: {
    readonly displayName: string;
    readonly slug: string;
    readonly shortDescription?: string | null;
    readonly description?: string | null;
    readonly imageAssetId?: string | null;
    readonly externalReference?: string | null;
    readonly metadata?: Readonly<Record<string, unknown>> | null;
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    this.assertMutable();

    if (this.snapshot.status === 'ELIGIBLE' || this.snapshot.status === 'SUSPENDED') {
      throw new CandidateDomainError(
        'CANDIDATE_CAMPAIGN_STATE_CONFLICT',
        'Foundational candidate identity cannot change after eligibility.',
      );
    }

    const next = this.copy({
      displayName: assertDisplayName(input.displayName),
      slug: CandidateSlug.from(input.slug).value,
      shortDescription: normalizeOptionalText(input.shortDescription, 280),
      description: normalizeOptionalText(input.description, 4000),
      imageAssetId: normalizeOptionalText(input.imageAssetId, 256),
      externalReference: normalizeOptionalText(input.externalReference, 256),
      metadata: normalizeMetadata(input.metadata),
      updatedAt: input.updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record('CandidateUpdated', input.eventMetadata, {
      displayName: next.snapshot.displayName,
      slug: next.snapshot.slug,
    });
    return next;
  }

  markEligible(input: {
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    return this.transition(
      'ELIGIBLE',
      'CandidateMarkedEligible',
      input.updatedAt,
      input.eventMetadata,
    );
  }

  suspend(input: {
    readonly reason: string;
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    return this.transition(
      'SUSPENDED',
      'CandidateSuspended',
      input.updatedAt,
      input.eventMetadata,
      assertReason(input.reason, 'CANDIDATE_REASON_REQUIRED'),
    );
  }

  reactivate(input: {
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    return this.transition(
      'ELIGIBLE',
      'CandidateReactivated',
      input.updatedAt,
      input.eventMetadata,
    );
  }

  withdraw(input: {
    readonly reason: string;
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    return this.transition(
      'WITHDRAWN',
      'CandidateWithdrawn',
      input.updatedAt,
      input.eventMetadata,
      assertReason(input.reason, 'CANDIDATE_REASON_REQUIRED'),
    );
  }

  disqualify(input: {
    readonly reason: string;
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    return this.transition(
      'DISQUALIFIED',
      'CandidateDisqualified',
      input.updatedAt,
      input.eventMetadata,
      assertReason(input.reason, 'CANDIDATE_REASON_REQUIRED'),
    );
  }

  archive(input: {
    readonly updatedAt: Date;
    readonly eventMetadata: CandidateEventMetadata;
  }): Candidate {
    const next = this.transition(
      'ARCHIVED',
      'CandidateArchived',
      input.updatedAt,
      input.eventMetadata,
    );
    return next.copy({ archivedAt: input.updatedAt });
  }

  reposition(position: number, updatedAt: Date): Candidate {
    this.assertMutable();
    return this.copy({
      position: assertPosition(position),
      updatedAt,
      version: this.snapshot.version + 1,
    });
  }

  toSnapshot(): CandidateSnapshot {
    return { ...this.snapshot, metadata: { ...this.snapshot.metadata } };
  }

  pullDomainEvents(): readonly CandidateDomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private transition(
    status: CandidateStatus,
    eventName: CandidateDomainEvent['name'],
    updatedAt: Date,
    eventMetadata: CandidateEventMetadata,
    reason: string | null = null,
  ): Candidate {
    this.assertMutable();

    if (!allowedTransitions[this.snapshot.status].includes(status)) {
      throw new CandidateDomainError(
        'CANDIDATE_INVALID_STATUS_TRANSITION',
        `Candidate cannot transition from ${this.snapshot.status} to ${status}.`,
      );
    }

    const next = this.copy({
      status,
      statusReason: reason,
      updatedAt,
      version: this.snapshot.version + 1,
    });
    next.record(eventName, eventMetadata, statusPayload(status, reason));
    return next;
  }

  private assertMutable(): void {
    if (this.snapshot.status === 'ARCHIVED') {
      throw new CandidateDomainError('CANDIDATE_IMMUTABLE', 'Archived candidates are immutable.');
    }
  }

  private copy(patch: Partial<CandidateSnapshot>): Candidate {
    const next = Candidate.rehydrate({ ...this.snapshot, ...patch });
    next.pendingEvents = [...this.pendingEvents];
    return next;
  }

  private record(
    name: CandidateDomainEvent['name'],
    metadata: CandidateEventMetadata,
    payload: Record<string, unknown>,
  ): void {
    this.pendingEvents.push(
      candidateEvent({
        name,
        candidateId: this.snapshot.id,
        organizationId: this.snapshot.organizationId,
        campaignId: this.snapshot.campaignId,
        metadata,
        payload,
      }),
    );
  }
}

const allowedTransitions: Readonly<Record<CandidateStatus, readonly CandidateStatus[]>> = {
  DRAFT: ['ELIGIBLE', 'WITHDRAWN', 'ARCHIVED'],
  ELIGIBLE: ['SUSPENDED', 'WITHDRAWN', 'DISQUALIFIED'],
  SUSPENDED: ['ELIGIBLE', 'WITHDRAWN', 'DISQUALIFIED'],
  WITHDRAWN: ['ARCHIVED'],
  DISQUALIFIED: ['ARCHIVED'],
  ARCHIVED: [],
};
