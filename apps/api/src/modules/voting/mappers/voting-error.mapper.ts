import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { VotingApplicationError } from '@seneve/voting-application';

export function mapVotingError(error: unknown, correlationId: string): HttpException {
  if (error instanceof VotingApplicationError) {
    return new HttpException(
      { code: error.code, message: publicMessage(error.code), correlationId },
      statusFor(error.code),
    );
  }
  return new InternalServerErrorException({
    code: 'INTERNAL_ERROR',
    message: 'The vote request could not be completed.',
    correlationId,
  });
}

function statusFor(code: VotingApplicationError['code']): HttpStatus {
  switch (code) {
    case 'VOTE_NOT_FOUND':
    case 'VOTING_CAMPAIGN_NOT_FOUND':
    case 'VOTING_CANDIDATE_NOT_FOUND':
    case 'VOTING_IDENTITY_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'VOTE_REQUEST_CONFLICT':
    case 'VOTING_QUOTA_REACHED':
    case 'VOTING_CAMPAIGN_NOT_ACTIVE':
    case 'VOTING_CAMPAIGN_PRIVATE':
    case 'VOTING_CAMPAIGN_OUTSIDE_WINDOW':
    case 'VOTING_CANDIDATE_NOT_ELIGIBLE':
      return HttpStatus.CONFLICT;
    case 'VOTING_PAYMENT_REQUIRED':
      return HttpStatus.PAYMENT_REQUIRED;
    default:
      return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}

function publicMessage(code: VotingApplicationError['code']): string {
  if (code.endsWith('_NOT_FOUND')) {
    return 'The requested voting resource was not found.';
  }
  if (code === 'VOTING_PAYMENT_REQUIRED') {
    return 'This campaign requires a payment-enabled voting flow.';
  }
  return 'The vote request could not be completed.';
}
