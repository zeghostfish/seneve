export const ORGANIZATION_ROLES = [
  'OWNER',
  'ADMINISTRATOR',
  'EVENT_MANAGER',
  'FINANCE_MANAGER',
  'CONTENT_MANAGER',
  'VIEWER',
  'AUDITOR',
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const timezonePattern = /^[A-Za-z_]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/;

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmailInput(value: string): string | null {
  const normalized = normalizeEmailInput(value);

  if (!normalized) {
    return 'Email is required.';
  }

  if (normalized.length > 254 || !emailPattern.test(normalized)) {
    return 'Enter a valid email address.';
  }

  return null;
}

export function validatePasswordInput(value: string): string | null {
  if (value.length < 12) {
    return 'Password must be at least 12 characters.';
  }

  if (value.length > 128) {
    return 'Password is too long.';
  }

  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (password !== confirmation) {
    return 'Passwords do not match.';
  }

  return null;
}

export function validateOrganizationName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return 'Organization name must be at least 2 characters.';
  }

  if (trimmed.length > 120) {
    return 'Organization name is too long.';
  }

  return null;
}

export function validateOrganizationSlug(value: string): string | null {
  if (!slugPattern.test(value.trim())) {
    return 'Use 3 to 63 lowercase letters, numbers or hyphens.';
  }

  return null;
}

export function validateLocale(value: string): string | null {
  return localePattern.test(value.trim()) ? null : 'Use a locale such as en or en-US.';
}

export function validateTimezone(value: string): string | null {
  return timezonePattern.test(value.trim()) ? null : 'Use an IANA timezone such as Africa/Lome.';
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return ORGANIZATION_ROLES.includes(value as OrganizationRole);
}

export function validateCampaignName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return 'Campaign name must be at least 2 characters.';
  }

  if (trimmed.length > 160) {
    return 'Campaign name is too long.';
  }

  return null;
}

export function validateCampaignSlug(value: string): string | null {
  return slugPattern.test(value.trim())
    ? null
    : 'Use 3 to 63 lowercase letters, numbers or hyphens.';
}

export function validateCampaignSchedule(startsAt: string, endsAt: string): string | null {
  const starts = Date.parse(startsAt);
  const ends = Date.parse(endsAt);

  if (Number.isNaN(starts) || Number.isNaN(ends)) {
    return 'Use valid schedule dates.';
  }

  return starts < ends ? null : 'Campaign start must be before end.';
}

export function validateVotesPerVoter(value: number): string | null {
  return Number.isInteger(value) && value >= 1 && value <= 100
    ? null
    : 'Votes per voter must be between 1 and 100.';
}

export function validateResultVisibility(value: string, revealAt?: string | null): string | null {
  if (value === 'SCHEDULED' && !revealAt) {
    return 'Scheduled results require a reveal date.';
  }

  if (value !== 'SCHEDULED' && revealAt) {
    return 'Reveal date is only used for scheduled results.';
  }

  return null;
}

export function validateCandidateDisplayName(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return 'Candidate display name must be at least 2 characters.';
  }

  if (trimmed.length > 160) {
    return 'Candidate display name is too long.';
  }

  return null;
}

export function validateCandidateSlug(value: string): string | null {
  return slugPattern.test(value.trim())
    ? null
    : 'Use 3 to 63 lowercase letters, numbers or hyphens.';
}

export function validatePlainText(value: string, maxLength: number): string | null {
  if (value.length > maxLength) {
    return `Use ${maxLength} characters or fewer.`;
  }

  return /<[^>]*>/.test(value) ? 'HTML is not allowed.' : null;
}
