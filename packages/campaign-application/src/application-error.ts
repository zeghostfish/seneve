export type CampaignApplicationErrorCode =
  | 'CAMPAIGN_NOT_FOUND'
  | 'CAMPAIGN_NAME_INVALID'
  | 'CAMPAIGN_SLUG_ALREADY_EXISTS'
  | 'CAMPAIGN_SLUG_INVALID'
  | 'CAMPAIGN_INVALID_SCHEDULE'
  | 'CAMPAIGN_INVALID_STATUS_TRANSITION'
  | 'CAMPAIGN_IMMUTABLE'
  | 'CAMPAIGN_RULE_CHANGE_NOT_ALLOWED'
  | 'CAMPAIGN_RESULT_VISIBILITY_INVALID'
  | 'CAMPAIGN_ORGANIZATION_IMMUTABLE'
  | 'CAMPAIGN_PERMISSION_DENIED'
  | 'CAMPAIGN_VERSION_CONFLICT'
  | 'CAMPAIGN_TRANSACTION_FAILED'
  | 'REQUEST_INVALID';

export class CampaignApplicationError extends Error {
  constructor(
    readonly code: CampaignApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CampaignApplicationError';
  }
}
