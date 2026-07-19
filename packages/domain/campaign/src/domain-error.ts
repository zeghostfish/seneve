export type CampaignDomainErrorCode =
  | 'CAMPAIGN_NAME_INVALID'
  | 'CAMPAIGN_SLUG_INVALID'
  | 'CAMPAIGN_INVALID_SCHEDULE'
  | 'CAMPAIGN_INVALID_STATUS_TRANSITION'
  | 'CAMPAIGN_IMMUTABLE'
  | 'CAMPAIGN_RULE_CHANGE_NOT_ALLOWED'
  | 'CAMPAIGN_RESULT_VISIBILITY_INVALID'
  | 'CAMPAIGN_ORGANIZATION_IMMUTABLE';

export class CampaignDomainError extends Error {
  constructor(
    readonly code: CampaignDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CampaignDomainError';
  }
}
