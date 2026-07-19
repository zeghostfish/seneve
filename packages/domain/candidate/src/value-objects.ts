import { CandidateDomainError } from './domain-error.js';

export type CandidateStatus =
  'DRAFT' | 'ELIGIBLE' | 'SUSPENDED' | 'WITHDRAWN' | 'DISQUALIFIED' | 'ARCHIVED';

export type CandidateCampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const reservedSlugs = new Set(['new', 'settings', 'admin', 'api', 'vote', 'votes', 'results']);

export class CandidateId {
  private constructor(readonly value: string) {}

  static from(value: string): CandidateId {
    assertUuid(value, 'candidate id');
    return new CandidateId(value);
  }
}

export class CampaignId {
  private constructor(readonly value: string) {}

  static from(value: string): CampaignId {
    assertUuid(value, 'campaign id');
    return new CampaignId(value);
  }
}

export class OrganizationId {
  private constructor(readonly value: string) {}

  static from(value: string): OrganizationId {
    assertUuid(value, 'organization id');
    return new OrganizationId(value);
  }
}

export class IdentityRef {
  private constructor(readonly value: string) {}

  static from(value: string): IdentityRef {
    assertUuid(value, 'identity id');
    return new IdentityRef(value);
  }
}

export class CandidateSlug {
  private constructor(readonly value: string) {}

  static from(value: string): CandidateSlug {
    const normalized = value.trim().toLowerCase();

    if (!slugPattern.test(normalized) || reservedSlugs.has(normalized)) {
      throw new CandidateDomainError(
        'CANDIDATE_SLUG_INVALID',
        'Candidate slug must be campaign-unique and URL safe.',
      );
    }

    return new CandidateSlug(normalized);
  }
}

export function assertDisplayName(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2 || trimmed.length > 160) {
    throw new CandidateDomainError(
      'CANDIDATE_DISPLAY_NAME_INVALID',
      'Candidate display name must be between 2 and 160 characters.',
    );
  }

  return trimmed;
}

export function assertPosition(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 10000) {
    throw new CandidateDomainError(
      'CANDIDATE_DUPLICATE_POSITION',
      'Candidate position must be a positive integer.',
    );
  }

  return value;
}

export function assertReason(
  value: string | null | undefined,
  code: CandidateDomainError['code'],
): string {
  const reason = value?.trim() ?? '';

  if (reason.length === 0 || reason.length > 500) {
    throw new CandidateDomainError(code, 'A bounded reason is required.');
  }

  return reason;
}

export function normalizeOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength || /<[^>]*>/.test(trimmed)) {
    throw new CandidateDomainError(
      'CANDIDATE_METADATA_INVALID',
      'Candidate text is invalid or too long.',
    );
  }

  return trimmed;
}

export function normalizeMetadata(value: Readonly<Record<string, unknown>> | null | undefined) {
  if (!value) {
    return {};
  }

  const serialized = JSON.stringify(value);

  if (serialized.length > 4096) {
    throw new CandidateDomainError(
      'CANDIDATE_METADATA_INVALID',
      'Candidate metadata is too large.',
    );
  }

  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase();

    if (
      ['password', 'secret', 'token', 'authorization', 'cookie'].some((part) =>
        normalized.includes(part),
      )
    ) {
      throw new CandidateDomainError(
        'CANDIDATE_METADATA_INVALID',
        'Candidate metadata contains sensitive keys.',
      );
    }
  }

  return value;
}

function assertUuid(value: string, label: string): void {
  if (!uuidPattern.test(value)) {
    throw new CandidateDomainError('CANDIDATE_SLUG_INVALID', `Invalid ${label}.`);
  }
}
