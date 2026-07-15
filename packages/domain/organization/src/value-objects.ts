import { OrganizationDomainError } from './domain-error.js';

export type OrganizationStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'ARCHIVED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export type OrganizationRole =
  | 'OWNER'
  | 'ADMINISTRATOR'
  | 'EVENT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'CONTENT_MANAGER'
  | 'VIEWER'
  | 'AUDITOR';

const organizationRoles: readonly OrganizationRole[] = [
  'OWNER',
  'ADMINISTRATOR',
  'EVENT_MANAGER',
  'FINANCE_MANAGER',
  'CONTENT_MANAGER',
  'VIEWER',
  'AUDITOR',
];

export class OrganizationId {
  private constructor(public readonly value: string) {}

  static from(value: string): OrganizationId {
    assertNonEmpty(value, 'Organization id is required.');
    return new OrganizationId(value);
  }
}

export class MembershipId {
  private constructor(public readonly value: string) {}

  static from(value: string): MembershipId {
    assertNonEmpty(value, 'Membership id is required.');
    return new MembershipId(value);
  }
}

export class InvitationId {
  private constructor(public readonly value: string) {}

  static from(value: string): InvitationId {
    assertNonEmpty(value, 'Invitation id is required.');
    return new InvitationId(value);
  }
}

export class IdentityRef {
  private constructor(public readonly value: string) {}

  static from(value: string): IdentityRef {
    assertNonEmpty(value, 'Identity id is required.');
    return new IdentityRef(value);
  }
}

export class OrganizationSlug {
  private constructor(public readonly value: string) {}

  static from(value: string): OrganizationSlug {
    const normalized = value.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(normalized)) {
      throw new OrganizationDomainError(
        'ORGANIZATION_INVALID_STATE',
        'Organization slug is invalid.',
      );
    }

    return new OrganizationSlug(normalized);
  }
}

export class NormalizedEmail {
  private constructor(public readonly value: string) {}

  static from(email: string): NormalizedEmail {
    const normalized = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new OrganizationDomainError(
        'INVITATION_RECIPIENT_MISMATCH',
        'Invitation email is invalid.',
      );
    }

    return new NormalizedEmail(normalized);
  }
}

export interface OrganizationProfileSnapshot {
  readonly displayName: string;
  readonly slug: string;
  readonly defaultLocale: string;
  readonly timezone: string;
}

export class OrganizationProfile {
  private constructor(
    public readonly displayName: string,
    public readonly slug: OrganizationSlug,
    public readonly defaultLocale: string,
    public readonly timezone: string,
  ) {}

  static create(input: {
    readonly displayName: string;
    readonly slug: string;
    readonly defaultLocale: string;
    readonly timezone: string;
  }): OrganizationProfile {
    const displayName = input.displayName.trim();

    if (displayName.length < 2) {
      throw new OrganizationDomainError(
        'ORGANIZATION_INVALID_STATE',
        'Organization display name is required.',
      );
    }

    assertNonEmpty(input.defaultLocale, 'Default locale is required.');
    assertNonEmpty(input.timezone, 'Timezone is required.');

    return new OrganizationProfile(
      displayName,
      OrganizationSlug.from(input.slug),
      input.defaultLocale.trim(),
      input.timezone.trim(),
    );
  }

  toSnapshot(): OrganizationProfileSnapshot {
    return {
      displayName: this.displayName,
      slug: this.slug.value,
      defaultLocale: this.defaultLocale,
      timezone: this.timezone,
    };
  }
}

export function assertValidRole(
  role: OrganizationRole,
  errorCode: 'MEMBERSHIP_ROLE_INVALID' | 'INVITATION_ROLE_INVALID',
): void {
  if (!organizationRoles.includes(role)) {
    throw new OrganizationDomainError(errorCode, 'Organization role is invalid.');
  }
}

export function isOrganizationRole(value: string): value is OrganizationRole {
  return organizationRoles.includes(value as OrganizationRole);
}

function assertNonEmpty(value: string, message: string): void {
  if (!value.trim()) {
    throw new OrganizationDomainError('ORGANIZATION_INVALID_STATE', message);
  }
}
