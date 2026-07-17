import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { OrganizationApplicationError } from '@seneve/organization-application';
import { OrganizationDomainError } from '@seneve/domain-organization';

export function mapOrganizationError(error: unknown, correlationId: string): HttpException {
  if (error instanceof OrganizationDomainError) {
    return new HttpException(
      {
        code: error.code,
        message: 'The organization request could not be completed.',
        correlationId,
      },
      statusForDomain(error.code),
    );
  }

  if (error instanceof OrganizationApplicationError) {
    return new HttpException(
      {
        code: error.code,
        message: publicMessage(error.code),
        correlationId,
      },
      statusForApplication(error.code),
    );
  }

  return new InternalServerErrorException({
    code: 'INTERNAL_ERROR',
    message: 'The organization request could not be completed.',
    correlationId,
  });
}

function statusForApplication(code: OrganizationApplicationError['code']): HttpStatus {
  switch (code) {
    case 'ORGANIZATION_NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'PERMISSION_DENIED':
      return HttpStatus.FORBIDDEN;
    case 'ORGANIZATION_VERSION_CONFLICT':
      return HttpStatus.CONFLICT;
    default:
      return HttpStatus.BAD_REQUEST;
  }
}

function statusForDomain(code: OrganizationDomainError['code']): HttpStatus {
  if (code.includes('NOT_FOUND')) {
    return HttpStatus.NOT_FOUND;
  }

  if (code.includes('ALREADY') || code.includes('LAST_OWNER') || code.includes('INVALID_STATE')) {
    return HttpStatus.CONFLICT;
  }

  if (code === 'INVITATION_EXPIRED') {
    return HttpStatus.GONE;
  }

  return HttpStatus.UNPROCESSABLE_ENTITY;
}

function publicMessage(code: OrganizationApplicationError['code']): string {
  if (code === 'PERMISSION_DENIED') {
    return 'Permission denied.';
  }

  if (code === 'ORGANIZATION_NOT_FOUND') {
    return 'Organization not found.';
  }

  return 'The organization request could not be completed.';
}
