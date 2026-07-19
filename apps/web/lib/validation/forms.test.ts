import { describe, expect, it } from 'vitest';

import {
  isOrganizationRole,
  normalizeEmailInput,
  validateEmailInput,
  validateOrganizationSlug,
  validatePasswordConfirmation,
  validatePasswordInput,
  validateCampaignName,
  validateCampaignSchedule,
  validateCampaignSlug,
  validateCandidateDisplayName,
  validateCandidateSlug,
  validatePlainText,
  validateTimezone,
} from './forms';

describe('frontend form validation', () => {
  it('normalizes and validates login identifiers', () => {
    expect(normalizeEmailInput('  Person@Example.COM ')).toBe('person@example.com');
    expect(validateEmailInput('person@example.com')).toBeNull();
    expect(validateEmailInput('not-an-email')).toBe('Enter a valid email address.');
  });

  it('validates password confirmation without exposing backend rules', () => {
    expect(validatePasswordInput('short')).toBe('Password must be at least 12 characters.');
    expect(validatePasswordInput('a'.repeat(12))).toBeNull();
    expect(validatePasswordConfirmation('correct horse', 'battery staple')).toBe(
      'Passwords do not match.',
    );
  });

  it('validates organization identifiers and roles used by organization screens', () => {
    expect(validateOrganizationSlug('seneve-voting')).toBeNull();
    expect(validateOrganizationSlug('Seneve Voting')).toBe(
      'Use 3 to 63 lowercase letters, numbers or hyphens.',
    );
    expect(validateTimezone('Africa/Lome')).toBeNull();
    expect(isOrganizationRole('ADMINISTRATOR')).toBe(true);
    expect(isOrganizationRole('PLATFORM_ADMIN')).toBe(false);
  });

  it('validates campaign and candidate management fields', () => {
    expect(validateCampaignName('Seneve Awards')).toBeNull();
    expect(validateCampaignSlug('seneve-awards')).toBeNull();
    expect(validateCampaignSchedule('2026-08-01T10:00', '2026-08-31T10:00')).toBeNull();
    expect(validateCampaignSchedule('2026-09-01T10:00', '2026-08-31T10:00')).toBe(
      'Campaign start must be before end.',
    );
    expect(validateCandidateDisplayName('Jane Candidate')).toBeNull();
    expect(validateCandidateSlug('jane-candidate')).toBeNull();
    expect(validatePlainText('<b>Unsafe</b>', 280)).toBe('HTML is not allowed.');
  });
});
