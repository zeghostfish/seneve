import { VotingDomainError } from './domain-error.js';
import { type VoteAttemptDomainEvent, type VoteEventMetadata, voteEvent } from './domain-event.js';

export type VoteAttemptStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface VoteAttemptSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly voterIdentityId: string;
  readonly requestId: string;
  readonly status: VoteAttemptStatus;
  readonly rejectionCode: string | null;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
  readonly rejectedAt: Date | null;
  readonly version: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class VoteAttempt {
  private pendingEvents: VoteAttemptDomainEvent[] = [];

  private constructor(private readonly snapshot: VoteAttemptSnapshot) {}

  static create(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateId: string;
    readonly voterIdentityId: string;
    readonly requestId: string;
    readonly createdAt: Date;
    readonly metadata: VoteEventMetadata;
  }): VoteAttempt {
    assertUuid(input.id, 'VOTE_ID_INVALID', 'vote attempt id');
    assertUuid(input.organizationId, 'VOTE_ID_INVALID', 'organization id');
    assertUuid(input.campaignId, 'VOTE_ID_INVALID', 'campaign id');
    assertUuid(input.candidateId, 'VOTE_ID_INVALID', 'candidate id');
    assertUuid(input.voterIdentityId, 'VOTE_ID_INVALID', 'voter identity id');
    assertUuid(input.requestId, 'VOTE_REQUEST_ID_INVALID', 'vote request id');

    const attempt = new VoteAttempt({
      id: input.id,
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      candidateId: input.candidateId,
      voterIdentityId: input.voterIdentityId,
      requestId: input.requestId,
      status: 'PENDING',
      rejectionCode: null,
      createdAt: input.createdAt,
      confirmedAt: null,
      rejectedAt: null,
      version: 1,
    });
    attempt.record('VoteAttemptCreated', input.metadata);
    return attempt;
  }

  static rehydrate(snapshot: VoteAttemptSnapshot): VoteAttempt {
    return new VoteAttempt({ ...snapshot });
  }

  confirm(input: {
    readonly confirmedAt: Date;
    readonly metadata: VoteEventMetadata;
  }): VoteAttempt {
    this.assertPending();
    const next = this.copy({
      status: 'CONFIRMED',
      confirmedAt: input.confirmedAt,
      version: this.snapshot.version + 1,
    });
    next.record('VoteConfirmed', input.metadata);
    return next;
  }

  reject(input: {
    readonly code: string;
    readonly rejectedAt: Date;
    readonly metadata: VoteEventMetadata;
  }): VoteAttempt {
    this.assertPending();
    const code = input.code.trim();
    if (code.length === 0 || code.length > 120) {
      throw new VotingDomainError(
        'VOTE_INVALID_STATUS_TRANSITION',
        'Vote rejection requires a bounded reason code.',
      );
    }
    const next = this.copy({
      status: 'REJECTED',
      rejectionCode: code,
      rejectedAt: input.rejectedAt,
      version: this.snapshot.version + 1,
    });
    next.record('VoteRejected', input.metadata, { rejectionCode: code });
    return next;
  }

  toSnapshot(): VoteAttemptSnapshot {
    return { ...this.snapshot };
  }

  pullDomainEvents(): readonly VoteAttemptDomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private assertPending(): void {
    if (this.snapshot.status !== 'PENDING') {
      throw new VotingDomainError('VOTE_IMMUTABLE', 'Finalized vote attempts are immutable.');
    }
  }

  private copy(changes: Partial<VoteAttemptSnapshot>): VoteAttempt {
    return new VoteAttempt({ ...this.snapshot, ...changes });
  }

  private record(
    name: VoteAttemptDomainEvent['name'],
    metadata: VoteEventMetadata,
    payload?: Readonly<Record<string, unknown>>,
  ): void {
    this.pendingEvents.push(
      voteEvent({
        name,
        voteAttemptId: this.snapshot.id,
        organizationId: this.snapshot.organizationId,
        campaignId: this.snapshot.campaignId,
        candidateId: this.snapshot.candidateId,
        metadata,
        payload,
      }),
    );
  }
}

function assertUuid(
  value: string,
  code: 'VOTE_ID_INVALID' | 'VOTE_REQUEST_ID_INVALID',
  label: string,
): void {
  if (!uuidPattern.test(value)) {
    throw new VotingDomainError(code, `Invalid ${label}.`);
  }
}
