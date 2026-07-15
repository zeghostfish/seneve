# Epic 002 - Organization Aggregate Implementation Plan

## Status

Phase 9 implementation complete under the approved Local Implementation Waiver.

Phase 7 established the domain model. Phase 8 established authorization evaluation. Phase 9 adds Organization persistence only. It introduces no tenant RLS, NestJS modules, controllers, invitation delivery, HTTP API, custom roles, subscriptions, billing, API keys or campaign functionality.

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

Implemented persistence preserves these operations atomically:

- organization creation with initial owner membership.
- invitation acceptance with membership creation and invitation consumption.
- ownership transfer with target owner assignment and previous owner role update.
- last-owner checks and membership mutation.

## Phase 9 Persistence

Implemented Prisma entities:

- `Organization`
- `OrganizationMembership`
- `OrganizationInvitation`

Implemented enums:

- `OrganizationStatus`
- `OrganizationMembershipStatus`
- `OrganizationRole`
- `OrganizationInvitationStatus`

The persistence model references Identity by `identity_id` only. It does not import or persist Identity profile, email, credential or session details inside Organization records.

Repository contracts live in `@seneve/domain-organization`:

- `OrganizationRepository`
- `OrganizationMembershipRepository`
- `OrganizationInvitationRepository`
- `OrganizationUnitOfWork`

Prisma implementations live in `@seneve/organization-persistence`:

- `PrismaOrganizationRepository`
- `PrismaOrganizationMembershipRepository`
- `PrismaOrganizationInvitationRepository`
- `PrismaOrganizationUnitOfWork`

Mapping rules:

- generated Prisma models are internal to `@seneve/organization-persistence`.
- repositories return explicit organization persistence read models, not Prisma records.
- raw invitation tokens are not represented in persistence contracts; only `token_id` and `token_hash` are persisted.
- organization roles are persisted as assignments only; Permission Evaluation remains the authorization source.

Concurrency protections:

- organization status updates use optimistic version checks.
- invitation acceptance uses conditional pending-token updates inside a transaction.
- ownership transfer updates the previous and target owner memberships in one transaction.
- active membership uniqueness is protected by a PostgreSQL partial unique index on organization and identity.
- duplicate pending invitations are protected by a PostgreSQL partial unique index on organization and normalized recipient email.

PostgreSQL-gated tests cover:

- organization persistence and rehydration.
- unique slug and active membership constraints.
- invitation token-hash persistence and duplicate pending-invitation constraints.
- atomic invitation acceptance and replay protection.
- atomic ownership transfer.
- unit-of-work rollback.

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

- no tenant RLS.
- no tenant request context propagation.
- no invitation delivery.
- no organization API.
- no subscription, billing, API-key, payment-account or branding children.
- PostgreSQL integration tests are present but skipped locally unless `RUN_POSTGRES_INTEGRATION=true` and `DATABASE_URL` point to a migrated PostgreSQL database.
