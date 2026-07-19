export type CandidateDomainErrorCode =
  | 'CANDIDATE_DISPLAY_NAME_INVALID'
  | 'CANDIDATE_SLUG_INVALID'
  | 'CANDIDATE_INVALID_STATUS_TRANSITION'
  | 'CANDIDATE_IMMUTABLE'
  | 'CANDIDATE_CAMPAIGN_STATE_CONFLICT'
  | 'CANDIDATE_DUPLICATE_POSITION'
  | 'CANDIDATE_REORDER_INVALID'
  | 'CANDIDATE_REASON_REQUIRED'
  | 'CANDIDATE_METADATA_INVALID';

export class CandidateDomainError extends Error {
  constructor(
    readonly code: CandidateDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CandidateDomainError';
  }
}
