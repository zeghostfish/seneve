import { CampaignDomainError } from './domain-error.js';

export type CampaignStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export type CampaignVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
export type VotingMode = 'FREE' | 'PAID' | 'HYBRID';
export type ResultsVisibility = 'HIDDEN' | 'LIVE' | 'AFTER_CAMPAIGN' | 'SCHEDULED';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const localePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const reservedSlugs = new Set(['new', 'settings', 'admin', 'api', 'public', 'vote', 'votes']);

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

export class CampaignSlug {
  private constructor(readonly value: string) {}

  static from(value: string): CampaignSlug {
    const normalized = value.trim().toLowerCase();

    if (!slugPattern.test(normalized) || reservedSlugs.has(normalized)) {
      throw new CampaignDomainError(
        'CAMPAIGN_SLUG_INVALID',
        'Campaign slug must be organization-unique and URL safe.',
      );
    }

    return new CampaignSlug(normalized);
  }
}

export interface CampaignScheduleSnapshot {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly locale: string;
}

export class CampaignSchedule {
  private constructor(private readonly snapshot: CampaignScheduleSnapshot) {}

  static create(input: CampaignScheduleSnapshot): CampaignSchedule {
    if (input.startsAt >= input.endsAt) {
      throw new CampaignDomainError(
        'CAMPAIGN_INVALID_SCHEDULE',
        'Campaign start time must precede end time.',
      );
    }

    assertTimezone(input.timezone);
    assertLocale(input.locale);

    return new CampaignSchedule({ ...input });
  }

  toSnapshot(): CampaignScheduleSnapshot {
    return { ...this.snapshot };
  }
}

export interface ResultVisibilityConfigurationSnapshot {
  readonly visibility: ResultsVisibility;
  readonly revealAt: Date | null;
}

export class ResultVisibilityConfiguration {
  private constructor(private readonly snapshot: ResultVisibilityConfigurationSnapshot) {}

  static create(input: ResultVisibilityConfigurationSnapshot): ResultVisibilityConfiguration {
    if (input.visibility === 'SCHEDULED' && !input.revealAt) {
      throw new CampaignDomainError(
        'CAMPAIGN_RESULT_VISIBILITY_INVALID',
        'Scheduled results visibility requires a reveal timestamp.',
      );
    }

    if (input.visibility !== 'SCHEDULED' && input.revealAt) {
      throw new CampaignDomainError(
        'CAMPAIGN_RESULT_VISIBILITY_INVALID',
        'Reveal timestamp is only valid for scheduled results.',
      );
    }

    return new ResultVisibilityConfiguration({ ...input });
  }

  toSnapshot(): ResultVisibilityConfigurationSnapshot {
    return { ...this.snapshot };
  }
}

export interface CampaignRulesSnapshot {
  readonly votingMode: VotingMode;
  readonly votesPerVoter: number;
  readonly allowMultipleCandidates: boolean;
  readonly requiresEmailVerification: boolean;
  readonly results: ResultVisibilityConfigurationSnapshot;
}

export class CampaignRules {
  private constructor(private readonly snapshot: CampaignRulesSnapshot) {}

  static create(input: CampaignRulesSnapshot): CampaignRules {
    if (
      !Number.isInteger(input.votesPerVoter) ||
      input.votesPerVoter < 1 ||
      input.votesPerVoter > 100
    ) {
      throw new CampaignDomainError(
        'CAMPAIGN_RULE_CHANGE_NOT_ALLOWED',
        'Votes per voter must be between 1 and 100.',
      );
    }

    return new CampaignRules({
      ...input,
      results: ResultVisibilityConfiguration.create(input.results).toSnapshot(),
    });
  }

  toSnapshot(): CampaignRulesSnapshot {
    return {
      ...this.snapshot,
      results: { ...this.snapshot.results },
    };
  }
}

export function assertCampaignName(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2 || trimmed.length > 160) {
    throw new CampaignDomainError(
      'CAMPAIGN_NAME_INVALID',
      'Campaign name must be between 2 and 160 characters.',
    );
  }

  return trimmed;
}

function assertUuid(value: string, label: string): void {
  if (!uuidPattern.test(value)) {
    throw new CampaignDomainError('CAMPAIGN_SLUG_INVALID', `Invalid ${label}.`);
  }
}

function assertTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date());
  } catch {
    throw new CampaignDomainError('CAMPAIGN_INVALID_SCHEDULE', 'Campaign timezone is invalid.');
  }
}

function assertLocale(value: string): void {
  if (!localePattern.test(value)) {
    throw new CampaignDomainError('CAMPAIGN_INVALID_SCHEDULE', 'Campaign locale is invalid.');
  }
}
