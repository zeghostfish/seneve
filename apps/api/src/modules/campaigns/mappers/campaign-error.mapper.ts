import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { CampaignApplicationError } from '@seneve/campaign-application';
import { CampaignDomainError } from '@seneve/domain-campaign';

export function mapCampaignError(error: unknown, correlationId: string): HttpException {
  if (error instanceof CampaignDomainError) {
    return new HttpException(
      {
        code: error.code,
        message: 'The campaign request could not be completed.',
        correlationId,
      },
      statusForCode(error.code),
    );
  }

  if (error instanceof CampaignApplicationError) {
    return new HttpException(
      {
        code: error.code,
        message: publicMessage(error.code),
        correlationId,
      },
      statusForCode(error.code),
    );
  }

  return new InternalServerErrorException({
    code: 'INTERNAL_ERROR',
    message: 'The campaign request could not be completed.',
    correlationId,
  });
}

function statusForCode(code: CampaignApplicationError['code'] | CampaignDomainError['code']) {
  switch (code) {
    case 'CAMPAIGN_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'CAMPAIGN_PERMISSION_DENIED':
      return HttpStatus.FORBIDDEN;
    case 'CAMPAIGN_VERSION_CONFLICT':
    case 'CAMPAIGN_SLUG_ALREADY_EXISTS':
    case 'CAMPAIGN_INVALID_STATUS_TRANSITION':
    case 'CAMPAIGN_IMMUTABLE':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}

function publicMessage(code: CampaignApplicationError['code']): string {
  if (code === 'CAMPAIGN_PERMISSION_DENIED') {
    return 'Permission denied.';
  }

  if (code === 'CAMPAIGN_NOT_FOUND') {
    return 'Campaign not found.';
  }

  return 'The campaign request could not be completed.';
}
