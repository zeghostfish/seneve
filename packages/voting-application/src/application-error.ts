import type { VotingDomainErrorCode } from '@seneve/domain-voting';

export type VotingApplicationErrorCode =
  | VotingDomainErrorCode
  | 'VOTE_NOT_FOUND'
  | 'VOTE_REQUEST_CONFLICT'
  | 'VOTING_CAMPAIGN_NOT_FOUND'
  | 'VOTING_CANDIDATE_NOT_FOUND'
  | 'VOTING_IDENTITY_NOT_FOUND'
  | 'VOTING_RESULTS_NOT_FOUND'
  | 'VOTING_RESULTS_PERMISSION_DENIED'
  | 'VOTING_TRANSACTION_FAILED';

export class VotingApplicationError extends Error {
  constructor(
    readonly code: VotingApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VotingApplicationError';
  }
}
