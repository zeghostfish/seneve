import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { CandidateApplicationError } from '@seneve/candidate-application';
import { CandidateDomainError } from '@seneve/domain-candidate';

export function mapCandidateError(error: unknown, correlationId: string): HttpException {
  if (error instanceof CandidateDomainError) {
    return new HttpException(
      {
        code: error.code,
        message: 'The candidate request could not be completed.',
        correlationId,
      },
      statusForCode(error.code),
    );
  }

  if (error instanceof CandidateApplicationError) {
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
    message: 'The candidate request could not be completed.',
    correlationId,
  });
}

function statusForCode(code: CandidateApplicationError['code'] | CandidateDomainError['code']) {
  switch (code) {
    case 'CANDIDATE_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'CANDIDATE_PERMISSION_DENIED':
      return HttpStatus.FORBIDDEN;
    case 'CANDIDATE_VERSION_CONFLICT':
    case 'CANDIDATE_SLUG_ALREADY_EXISTS':
    case 'CANDIDATE_LIMIT_REACHED':
    case 'CANDIDATE_INVALID_STATUS_TRANSITION':
    case 'CANDIDATE_IMMUTABLE':
    case 'CANDIDATE_CAMPAIGN_STATE_CONFLICT':
    case 'CANDIDATE_REORDER_INVALID':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}

function publicMessage(code: CandidateApplicationError['code']): string {
  if (code === 'CANDIDATE_PERMISSION_DENIED') {
    return 'Permission denied.';
  }

  if (code === 'CANDIDATE_NOT_FOUND') {
    return 'Candidate not found.';
  }

  return 'The candidate request could not be completed.';
}
