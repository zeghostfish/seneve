import type { VoteAttemptSnapshot } from './vote-attempt.js';
import type { VoteAttemptDomainEvent } from './domain-event.js';

export interface VotingCampaignReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly visibility: string;
  readonly timezone: string;
  readonly locale: string;
  readonly votingMode: string;
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface VotingCandidateReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly shortDescription: string | null;
  readonly imageAssetId: string | null;
  readonly position: number;
  readonly status: string;
}

export interface VotingReceiptReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly candidateId: string;
  readonly candidateDisplayName: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly confirmedAt: Date | null;
}

export interface VotingReceiptListResult {
  readonly receipts: readonly VotingReceiptReadModel[];
  readonly nextCursor: string | null;
}

export interface VoteAttemptRepository {
  lockVoter(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
  }): Promise<void>;
  findByRequest(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
    readonly requestId: string;
  }): Promise<VoteAttemptSnapshot | null>;
  countConfirmed(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly voterIdentityId: string;
  }): Promise<number>;
  create(attempt: VoteAttemptSnapshot): Promise<void>;
  findOwnedById(input: {
    readonly organizationId: string;
    readonly voterIdentityId: string;
    readonly voteAttemptId: string;
  }): Promise<VoteAttemptSnapshot | null>;
  listOwned(input: {
    readonly organizationId: string;
    readonly voterIdentityId: string;
    readonly limit: number;
    readonly cursor: string | null;
  }): Promise<VotingReceiptListResult>;
}

export interface VotingRepositories {
  readonly votes: VoteAttemptRepository;
  readonly auditEvents: {
    record(event: VoteAttemptDomainEvent): Promise<unknown>;
  };
  findCampaign(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<VotingCampaignReadModel | null>;
  findCandidate(input: {
    readonly organizationId: string;
    readonly campaignId: string;
    readonly candidateId: string;
  }): Promise<VotingCandidateReadModel | null>;
  listEligibleCandidates(input: {
    readonly organizationId: string;
    readonly campaignId: string;
  }): Promise<readonly VotingCandidateReadModel[]>;
}

export interface VotingUnitOfWork {
  transaction<T>(work: (repositories: VotingRepositories) => Promise<T>): Promise<T>;
}
