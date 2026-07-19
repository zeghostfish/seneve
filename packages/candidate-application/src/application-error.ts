export type CandidateApplicationErrorCode =
  | 'CANDIDATE_NOT_FOUND'
  | 'CANDIDATE_SLUG_ALREADY_EXISTS'
  | 'CANDIDATE_LIMIT_REACHED'
  | 'CANDIDATE_INVALID_STATUS_TRANSITION'
  | 'CANDIDATE_IMMUTABLE'
  | 'CANDIDATE_CAMPAIGN_STATE_CONFLICT'
  | 'CANDIDATE_DUPLICATE_POSITION'
  | 'CANDIDATE_REORDER_INVALID'
  | 'CANDIDATE_PERMISSION_DENIED'
  | 'CANDIDATE_REASON_REQUIRED'
  | 'CANDIDATE_DISPLAY_NAME_INVALID'
  | 'CANDIDATE_SLUG_INVALID'
  | 'CANDIDATE_METADATA_INVALID'
  | 'CANDIDATE_VERSION_CONFLICT'
  | 'CANDIDATE_TRANSACTION_FAILED'
  | 'REQUEST_INVALID';

export class CandidateApplicationError extends Error {
  constructor(
    readonly code: CandidateApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CandidateApplicationError';
  }
}
