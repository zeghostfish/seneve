import type { IdentityRepository } from '@seneve/domain-identity';
import type { VoteAttemptSnapshot, VotingUnitOfWork } from '@seneve/domain-voting';
import type { TenantExecutionContext } from '@seneve/tenant-context';

export interface VotingApplicationDependencies {
  readonly unitOfWork: VotingUnitOfWork;
  readonly identities: IdentityRepository;
  readonly executionContext: TenantExecutionContext;
  readonly ids: { uuid(): string };
  readonly clock: { now(): Date };
}

export interface SubmitVoteCommand {
  readonly voterIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly candidateId: string;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface VoteCommandResult {
  readonly vote: VoteAttemptSnapshot;
  readonly replayed: boolean;
}
