import type { VoteAttemptSnapshot } from './vote-attempt.js';
import type { VoteAttemptDomainEvent } from './domain-event.js';

export interface VotingCampaignReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly status: string;
  readonly visibility: string;
  readonly votingMode: string;
  readonly votesPerVoter: number;
  readonly requiresEmailVerification: boolean;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface VotingCandidateReadModel {
  readonly id: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly status: string;
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
}

export interface VotingUnitOfWork {
  transaction<T>(work: (repositories: VotingRepositories) => Promise<T>): Promise<T>;
}
