export type VotingDomainErrorCode =
  | 'VOTE_ID_INVALID'
  | 'VOTE_REQUEST_ID_INVALID'
  | 'VOTE_INVALID_STATUS_TRANSITION'
  | 'VOTE_IMMUTABLE'
  | 'VOTING_IDENTITY_INACTIVE'
  | 'VOTING_EMAIL_VERIFICATION_REQUIRED'
  | 'VOTING_CAMPAIGN_NOT_ACTIVE'
  | 'VOTING_CAMPAIGN_PRIVATE'
  | 'VOTING_CAMPAIGN_OUTSIDE_WINDOW'
  | 'VOTING_CANDIDATE_NOT_ELIGIBLE'
  | 'VOTING_PAYMENT_REQUIRED'
  | 'VOTING_QUOTA_REACHED';

export class VotingDomainError extends Error {
  constructor(
    readonly code: VotingDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'VotingDomainError';
  }
}
