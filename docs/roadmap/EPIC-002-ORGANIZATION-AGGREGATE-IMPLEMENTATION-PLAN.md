# Epic 002 - Organization Aggregate Implementation Plan

## Status

Phase 7 implementation complete under the approved Local Implementation Waiver.

Phase 7 is domain-only. It introduces no Prisma models, migrations, repositories, tenant RLS, Permission Evaluation Service, NestJS modules, controllers, invitation delivery, or HTTP API.

## Aggregate Boundary

Aggregate root:

- `Organization`

Implemented V1 domain concepts:

- `OrganizationProfile`
- organization lifecycle state
- `Membership`
- `Invitation`
- ownership governance
- organization settings boundary through locale and timezone profile values

Deferred wider Organization-domain concepts:

- subscription
- billing profile
- API keys
- payment accounts
- advanced branding
- custom-domain management

## State Machines

Organization lifecycle:

```text
DRAFT -> ACTIVE -> SUSPENDED -> ACTIVE
ACTIVE -> CLOSED
SUSPENDED -> CLOSED
CLOSED -> ARCHIVED
```

Rejected transitions:

- direct archive before close
- activation outside `DRAFT`
- reactivation outside `SUSPENDED`
- operational mutations in `DRAFT`, `SUSPENDED`, `CLOSED`, or `ARCHIVED`

Membership lifecycle:

```text
ACTIVE -> SUSPENDED -> REMOVED
ACTIVE -> REMOVED
```

Phase 7 decision:

- pending participation is represented by `Invitation`, not a duplicate pending Membership state.

Invitation lifecycle:

```text
PENDING -> ACCEPTED
PENDING -> REVOKED
PENDING -> EXPIRED
```

## Role Catalogue

Implemented organization roles:

- `OWNER`
- `ADMINISTRATOR`
- `EVENT_MANAGER`
- `FINANCE_MANAGER`
- `CONTENT_MANAGER`
- `VIEWER`
- `AUDITOR`

These are role assignments only. The future Permission Evaluation Service will interpret roles through permissions, policies and conditions.

## Invariants

Organization invariants:

- organization creation also creates the initial active owner membership.
- active organizations must retain at least one active owner.
- invalid lifecycle transitions are rejected.
- operational membership and invitation mutations require an active organization.
- closed and archived organizations are immutable for normal operations.

Membership invariants:

- one active membership per identity and organization.
- removed membership cannot silently become active again.
- role changes require an explicit aggregate operation.
- platform roles are not organization membership roles.
- the last owner cannot be removed, suspended or downgraded.

Invitation invariants:

- duplicate pending invitations for the same normalized recipient email are rejected.
- expired invitation cannot be accepted.
- revoked invitation cannot be accepted.
- accepted invitation cannot be replayed.
- invitation recipient email must match the acceptance policy.
- invitation acceptance must not create a duplicate active membership.
- raw invitation tokens are not stored in the domain model.

Ownership-transfer invariants:

- current owner must be an active owner membership.
- target membership must be active.
- target must differ from current owner.
- ownership transfer is one aggregate operation, not two unrelated role changes.
- `OwnershipTransferred` is emitted only after the invariant-preserving transfer succeeds.

## Domain Events

Implemented versioned event names:

- `OrganizationCreated`
- `OrganizationActivated`
- `OrganizationSuspended`
- `OrganizationReactivated`
- `OrganizationClosed`
- `OrganizationArchived`
- `OrganizationProfileUpdated`
- `MembershipCreated`
- `MembershipActivated`
- `MembershipRoleChanged`
- `MembershipSuspended`
- `MembershipRemoved`
- `InvitationCreated`
- `InvitationRevoked`
- `InvitationExpired`
- `InvitationAccepted`
- `OwnershipTransferred`

Payload rules:

- no raw invitation tokens.
- no secrets.
- no full profile snapshots unless a future consumer justifies them.
- identifiers and minimum useful metadata only.

## Stable Errors

Implemented error codes:

- `ORGANIZATION_INVALID_STATE`
- `ORGANIZATION_ALREADY_ACTIVE`
- `ORGANIZATION_SUSPENDED`
- `ORGANIZATION_CLOSED`
- `ORGANIZATION_ARCHIVED`
- `MEMBERSHIP_ALREADY_EXISTS`
- `MEMBERSHIP_NOT_FOUND`
- `MEMBERSHIP_INVALID_STATE`
- `MEMBERSHIP_ROLE_INVALID`
- `LAST_OWNER_REQUIRED`
- `LAST_OWNER_REMOVAL_FORBIDDEN`
- `LAST_OWNER_SUSPENSION_FORBIDDEN`
- `OWNERSHIP_TRANSFER_INVALID`
- `INVITATION_ALREADY_EXISTS`
- `INVITATION_NOT_FOUND`
- `INVITATION_EXPIRED`
- `INVITATION_REVOKED`
- `INVITATION_ALREADY_ACCEPTED`
- `INVITATION_RECIPIENT_MISMATCH`
- `INVITATION_ROLE_INVALID`

## Future Transaction Boundaries

Future persistence must preserve these operations atomically:

- organization creation with initial owner membership.
- invitation acceptance with membership creation and invitation consumption.
- ownership transfer with target owner assignment and previous owner role update.
- last-owner checks and membership mutation.

## Testing

Phase 7 domain tests cover:

- valid organization creation.
- valid and invalid organization transitions.
- mutation blocking in disallowed states.
- membership creation, duplicate prevention, role change, suspension and removal.
- last-owner removal, suspension and downgrade rejection.
- ownership transfer.
- invitation creation, duplicate prevention, revocation, expiration, acceptance and replay rejection.
- recipient mismatch.
- event emission for completed facts.
- absence of raw token material in event payloads.

## Known Limitations

- no organization persistence.
- no tenant RLS.
- no Permission Evaluation Service.
- no invitation delivery.
- no organization API.
- no subscription, billing, API-key, payment-account or branding children.
