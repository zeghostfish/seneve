import type { IdentityRepository } from '@seneve/domain-identity';
import type {
  PrivateVotingResultsReadModel,
  VoteAttemptSnapshot,
  VotingCampaignReadModel,
  VotingCandidateReadModel,
  VotingReceiptListResult,
  VotingResultsUnitOfWork,
  VotingUnitOfWork,
} from '@seneve/domain-voting';
import type { PermissionEvaluationService } from '@seneve/authorization-application';
import type { OrganizationRepository } from '@seneve/domain-organization';
import type { TenantExecutionContext } from '@seneve/tenant-context';

export interface VotingApplicationDependencies {
  readonly unitOfWork: VotingUnitOfWork;
  readonly identities: IdentityRepository;
  readonly executionContext: TenantExecutionContext;
  readonly ids: { uuid(): string };
  readonly clock: { now(): Date };
}

export interface VotingResultsApplicationDependencies {
  readonly unitOfWork: VotingResultsUnitOfWork;
  readonly organizations: OrganizationRepository;
  readonly identities: IdentityRepository;
  readonly permissions: PermissionEvaluationService;
  readonly executionContext: TenantExecutionContext;
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

export interface SubmitBallotSelection {
  readonly candidateId: string;
  readonly requestId: string;
}

export interface SubmitBallotCommand {
  readonly voterIdentityId: string;
  readonly organizationId: string;
  readonly campaignId: string;
  readonly selections: readonly SubmitBallotSelection[];
  readonly correlationId: string;
}

export interface VoteCommandResult {
  readonly vote: VoteAttemptSnapshot;
  readonly replayed: boolean;
}

export interface BallotCommandResult {
  readonly votes: readonly VoteAttemptSnapshot[];
  readonly replayed: boolean;
}

export interface VotingBallotResult {
  readonly campaign: VotingCampaignReadModel;
  readonly candidates: readonly VotingCandidateReadModel[];
  readonly confirmedVoteCount: number;
  readonly remainingVotes: number;
}

export type VotingHistoryResult = VotingReceiptListResult;

export interface PrivateVotingResultsResult {
  readonly results: PrivateVotingResultsReadModel;
  readonly generatedAt: Date;
}
