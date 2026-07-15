import { describe, expect, it } from 'vitest';

import {
  IdentityRef,
  InvitationId,
  MembershipId,
  Organization,
  OrganizationDomainError,
  OrganizationId,
  OrganizationProfile,
} from './index.js';

const now = new Date('2026-07-15T00:00:00.000Z');
const later = new Date('2026-07-16T00:00:00.000Z');
const ownerIdentity = IdentityRef.from('identity-owner');
const secondIdentity = IdentityRef.from('identity-second');
const thirdIdentity = IdentityRef.from('identity-third');
const metadata = {
  eventId: 'event-1',
  correlationId: 'correlation-1',
  actorId: ownerIdentity.value,
  occurredAt: now,
};

function profile(name = 'Seneve Awards'): OrganizationProfile {
  return OrganizationProfile.create({
    displayName: name,
    slug: 'seneve-awards',
    defaultLocale: 'en',
    timezone: 'Africa/Lome',
  });
}

function draftOrganization(): Organization {
  return Organization.create({
    id: OrganizationId.from('organization-1'),
    publicId: 'org_public_1',
    profile: profile(),
    ownerMembershipId: MembershipId.from('membership-owner'),
    ownerIdentityId: ownerIdentity,
    createdAt: now,
    metadata,
  });
}

function activeOrganization(): Organization {
  return draftOrganization().activate(later, metadata);
}

function organizationWithSecondMember(): Organization {
  return activeOrganization().addMembership({
    membershipId: MembershipId.from('membership-second'),
    identityId: secondIdentity,
    role: 'ADMINISTRATOR',
    createdAt: later,
    actorId: ownerIdentity,
    metadata,
  });
}

describe('Organization lifecycle', () => {
  it('creates a draft organization with an initial active owner and events', () => {
    const organization = draftOrganization();

    expect(organization.toSnapshot()).toMatchObject({
      id: 'organization-1',
      publicId: 'org_public_1',
      status: 'DRAFT',
      profile: {
        displayName: 'Seneve Awards',
        slug: 'seneve-awards',
        defaultLocale: 'en',
        timezone: 'Africa/Lome',
      },
      memberships: [
        expect.objectContaining({
          identityId: ownerIdentity.value,
          role: 'OWNER',
          status: 'ACTIVE',
        }),
      ],
    });
    expect(organization.pullDomainEvents().map((event) => event.eventType)).toEqual([
      'OrganizationCreated',
      'MembershipCreated',
    ]);
  });

  it('allows valid lifecycle transitions and rejects invalid shortcuts', () => {
    const active = activeOrganization();
    const suspended = active.suspend(new Date('2026-07-17T00:00:00.000Z'), metadata);
    const reactivated = suspended.reactivate(new Date('2026-07-18T00:00:00.000Z'), metadata);
    const closed = reactivated.close(new Date('2026-07-19T00:00:00.000Z'), metadata);
    const archived = closed.archive(new Date('2026-07-20T00:00:00.000Z'), metadata);

    expect(active.toSnapshot().status).toBe('ACTIVE');
    expect(suspended.toSnapshot().status).toBe('SUSPENDED');
    expect(reactivated.toSnapshot().status).toBe('ACTIVE');
    expect(closed.toSnapshot().status).toBe('CLOSED');
    expect(archived.toSnapshot().status).toBe('ARCHIVED');
    expect(() => draftOrganization().archive(later, metadata)).toThrowError(
      new OrganizationDomainError(
        'ORGANIZATION_INVALID_STATE',
        'Only closed organizations can be archived.',
      ),
    );
  });

  it('blocks operational mutations outside allowed states', () => {
    expect(() =>
      draftOrganization().addMembership({
        membershipId: MembershipId.from('membership-second'),
        identityId: secondIdentity,
        role: 'VIEWER',
        createdAt: later,
        actorId: ownerIdentity,
        metadata,
      }),
    ).toThrowError(OrganizationDomainError);

    const suspended = activeOrganization().suspend(later, metadata);

    expect(() =>
      suspended.createInvitation({
        invitationId: InvitationId.from('invitation-1'),
        recipientEmail: 'viewer@example.com',
        intendedRole: 'VIEWER',
        tokenId: 'token-1',
        invitedBy: ownerIdentity,
        createdAt: later,
        expiresAt: new Date('2026-07-20T00:00:00.000Z'),
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError('ORGANIZATION_SUSPENDED', 'Organization is suspended.'),
    );
  });
});

describe('Membership and ownership governance', () => {
  it('adds memberships, changes roles, suspends and removes without duplicating active membership', () => {
    const organization = organizationWithSecondMember();

    expect(() =>
      organization.addMembership({
        membershipId: MembershipId.from('membership-duplicate'),
        identityId: secondIdentity,
        role: 'VIEWER',
        createdAt: later,
        actorId: ownerIdentity,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError('MEMBERSHIP_ALREADY_EXISTS', 'Active membership already exists.'),
    );

    const changed = organization.changeMembershipRole({
      membershipId: MembershipId.from('membership-second'),
      role: 'FINANCE_MANAGER',
      changedAt: later,
      actorId: ownerIdentity,
      metadata,
    });
    const suspended = changed.suspendMembership({
      membershipId: MembershipId.from('membership-second'),
      suspendedAt: later,
      actorId: ownerIdentity,
      metadata,
    });
    const removed = suspended.removeMembership({
      membershipId: MembershipId.from('membership-second'),
      removedAt: later,
      actorId: ownerIdentity,
      metadata,
    });

    expect(removed.toSnapshot().memberships).toContainEqual(
      expect.objectContaining({
        id: 'membership-second',
        role: 'FINANCE_MANAGER',
        status: 'REMOVED',
      }),
    );
  });

  it('prevents removing, suspending or downgrading the last active owner', () => {
    const organization = activeOrganization();

    expect(() =>
      organization.removeMembership({
        membershipId: MembershipId.from('membership-owner'),
        removedAt: later,
        actorId: ownerIdentity,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError('LAST_OWNER_REMOVAL_FORBIDDEN', 'Last owner cannot be removed.'),
    );
    expect(() =>
      organization.suspendMembership({
        membershipId: MembershipId.from('membership-owner'),
        suspendedAt: later,
        actorId: ownerIdentity,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError(
        'LAST_OWNER_SUSPENSION_FORBIDDEN',
        'Last owner cannot be suspended.',
      ),
    );
    expect(() =>
      organization.changeMembershipRole({
        membershipId: MembershipId.from('membership-owner'),
        role: 'ADMINISTRATOR',
        changedAt: later,
        actorId: ownerIdentity,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError('LAST_OWNER_REQUIRED', 'Last owner cannot be downgraded.'),
    );
  });

  it('transfers ownership atomically to an eligible active membership', () => {
    const transferred = organizationWithSecondMember().transferOwnership({
      currentOwnerMembershipId: MembershipId.from('membership-owner'),
      targetMembershipId: MembershipId.from('membership-second'),
      previousOwnerRole: 'ADMINISTRATOR',
      transferredAt: later,
      actorId: ownerIdentity,
      metadata,
    });

    expect(transferred.toSnapshot().memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'membership-owner', role: 'ADMINISTRATOR' }),
        expect.objectContaining({ id: 'membership-second', role: 'OWNER' }),
      ]),
    );
    expect(transferred.pullDomainEvents().map((event) => event.eventType)).toContain(
      'OwnershipTransferred',
    );
  });
});

describe('Invitation lifecycle', () => {
  function organizationWithInvitation(): Organization {
    return activeOrganization().createInvitation({
      invitationId: InvitationId.from('invitation-1'),
      recipientEmail: ' New.Member@Example.com ',
      intendedRole: 'VIEWER',
      tokenId: 'token-reference-1',
      invitedBy: ownerIdentity,
      createdAt: later,
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      metadata,
    });
  }

  it('creates invitations without raw token material and prevents duplicate active invitations', () => {
    const organization = organizationWithInvitation();

    expect(organization.toSnapshot().invitations).toEqual([
      expect.objectContaining({
        normalizedRecipientEmail: 'new.member@example.com',
        intendedRole: 'VIEWER',
        status: 'PENDING',
        tokenId: 'token-reference-1',
      }),
    ]);
    expect(JSON.stringify(organization.pullDomainEvents())).not.toContain('raw');
    expect(() =>
      organization.createInvitation({
        invitationId: InvitationId.from('invitation-2'),
        recipientEmail: 'new.member@example.com',
        intendedRole: 'AUDITOR',
        tokenId: 'token-reference-2',
        invitedBy: ownerIdentity,
        createdAt: later,
        expiresAt: new Date('2026-07-21T00:00:00.000Z'),
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError(
        'INVITATION_ALREADY_EXISTS',
        'An active invitation already exists.',
      ),
    );
  });

  it('revokes and expires invitations so they cannot be accepted', () => {
    const revoked = organizationWithInvitation().revokeInvitation({
      invitationId: InvitationId.from('invitation-1'),
      revokedAt: later,
      metadata,
    });

    expect(() =>
      revoked.acceptInvitation({
        invitationId: InvitationId.from('invitation-1'),
        acceptingIdentityId: secondIdentity,
        recipientEmail: 'new.member@example.com',
        membershipId: MembershipId.from('membership-new'),
        acceptedAt: later,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError('INVITATION_REVOKED', 'Invitation has been revoked.'),
    );

    const expired = organizationWithInvitation().expireInvitation({
      invitationId: InvitationId.from('invitation-1'),
      expiredAt: new Date('2026-07-21T00:00:00.000Z'),
      metadata,
    });

    expect(expired.toSnapshot().invitations[0]?.status).toBe('EXPIRED');
  });

  it('accepts invitations once and blocks replay, recipient mismatch and duplicate memberships', () => {
    const accepted = organizationWithInvitation().acceptInvitation({
      invitationId: InvitationId.from('invitation-1'),
      acceptingIdentityId: secondIdentity,
      recipientEmail: 'new.member@example.com',
      membershipId: MembershipId.from('membership-new'),
      acceptedAt: later,
      metadata,
    });

    expect(accepted.toSnapshot().memberships).toContainEqual(
      expect.objectContaining({
        id: 'membership-new',
        identityId: secondIdentity.value,
        role: 'VIEWER',
        status: 'ACTIVE',
      }),
    );
    expect(() =>
      accepted.acceptInvitation({
        invitationId: InvitationId.from('invitation-1'),
        acceptingIdentityId: thirdIdentity,
        recipientEmail: 'new.member@example.com',
        membershipId: MembershipId.from('membership-replay'),
        acceptedAt: later,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError(
        'INVITATION_ALREADY_ACCEPTED',
        'Invitation has already been accepted.',
      ),
    );
    expect(() =>
      organizationWithInvitation().acceptInvitation({
        invitationId: InvitationId.from('invitation-1'),
        acceptingIdentityId: secondIdentity,
        recipientEmail: 'other@example.com',
        membershipId: MembershipId.from('membership-mismatch'),
        acceptedAt: later,
        metadata,
      }),
    ).toThrowError(
      new OrganizationDomainError(
        'INVITATION_RECIPIENT_MISMATCH',
        'Invitation recipient does not match.',
      ),
    );
  });
});
