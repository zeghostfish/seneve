# Epic 002 Readiness Report

## 1. Official GitHub Publication Status

Status: blocked.

No official GitHub remote is configured.

The unrelated accessible repository must not be used.

Required before normal implementation flow:

```bash
git remote add origin <official-repository-url>
git remote -v
git push -u origin main
git push -u origin feature/foundation
```

If the official remote already contains commits, inspect and reconcile histories without force-pushing.

## 2. Epic 001 PR and CI Status

Status: blocked by missing official remote.

Epic 001 remains provisionally accepted.

Remote PR, GitHub Actions, branch protection, and remote CI evidence do not exist yet.

## 3. Docker Validation Status

Status: incomplete.

Docker was unavailable during local implementation.

Required validation:

```bash
docker compose config
docker compose build
docker compose up -d postgres redis
docker compose ps
```

Then verify API health, API readiness, web load, worker health, PostgreSQL readiness, and Redis readiness.

## 4. Epic 002 Blocking Decisions

Blocking:

- none in the design package after the latest approved Identity Aggregate, Organization Aggregate, Permission Evaluation Service, event taxonomy, and invariant decisions.

Non-blocking:

- email provider selection
- production secret-management provider
- first Platform Super Administrator bootstrap procedure
- jurisdiction-specific audit retention period

## 5. Final Aggregate Boundaries

Identity aggregate root:

- `Identity`

Identity child concepts:

- `User`
- `Credential`
- `EmailAddress`
- `PhoneNumber`
- `Session`
- `RefreshToken`
- `PasswordReset`
- `EmailVerification`
- `LoginHistory`

Organization aggregate root:

- `Organization`

Organization child concepts for Epic 002:

- organization profile
- organization status
- memberships
- invitations
- organization settings
- ownership rules

Broader organization-domain concepts deferred to later Epics:

- subscription
- billing profile
- API keys
- advanced branding
- payment accounts

Authorization boundary:

- Permission Evaluation Service centralizes authorization decisions.
- Controllers, route handlers, and UI components do not duplicate permission logic.

## 6. Final Database Entities Proposed

Identity:

- `identities`
- `users`
- `credentials`
- `email_addresses`
- `phone_numbers`
- `sessions`
- `refresh_tokens`
- `password_resets`
- `email_verifications`
- `login_history`

Organization and authorization:

- `organizations`
- `memberships`
- `invitations`
- `roles`
- `permissions`
- `role_permissions`
- `membership_roles`
- `policies`
- `audit_logs`

No Prisma models or migrations have been created.

## 7. Final API Endpoints Proposed

Authentication:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/auth/email/resend`

Current user:

- `GET /api/v1/me`
- `GET /api/v1/me/organizations`
- `POST /api/v1/me/active-organization`

Organizations:

- `POST /api/v1/organizations`
- `GET /api/v1/organizations`
- `GET /api/v1/organizations/{organizationId}`
- `PATCH /api/v1/organizations/{organizationId}`
- `POST /api/v1/organizations/{organizationId}/close`
- `POST /api/v1/organizations/{organizationId}/archive`
- `POST /api/v1/organizations/{organizationId}/owner-transfer`

Memberships:

- `GET /api/v1/organizations/{organizationId}/members`
- `PATCH /api/v1/organizations/{organizationId}/members/{membershipId}`
- `POST /api/v1/organizations/{organizationId}/members/{membershipId}/suspend`
- `DELETE /api/v1/organizations/{organizationId}/members/{membershipId}`

Invitations:

- `POST /api/v1/organizations/{organizationId}/invitations`
- `GET /api/v1/organizations/{organizationId}/invitations`
- `POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/revoke`
- `POST /api/v1/invitations/accept`

Authorization metadata:

- `GET /api/v1/organizations/{organizationId}/roles`
- `GET /api/v1/organizations/{organizationId}/permissions`

## 8. Final Authorization Model

Evaluation flow:

```text
Actor
  -> Tenant Context
    -> Permission
      -> Policy
        -> Conditions
          -> Decision
```

Decision object includes:

- allow/deny outcome
- stable reason code
- required audit behavior
- evaluated policies
- failed conditions where safe to expose internally

Permissions are denied by default.

Platform-level permissions are not inferred from organization roles.

## 9. Final RLS and Tenant-Context Design

Tenant isolation uses:

1. application-level tenant scoping and authorization
2. PostgreSQL Row-Level Security

Tenant context:

- API path `organizationId` takes precedence over active organization header.
- application service receives tenant context explicitly.
- Prisma repository helpers set transaction-local tenant context before tenant-scoped queries.

PostgreSQL setting:

```sql
SET LOCAL app.current_organization_id = '<organization-uuid>';
```

Background jobs:

- tenant-scoped jobs include `organizationId`
- workers set tenant context before database access
- missing tenant context fails unless explicitly global/system scoped

Platform admin:

- dedicated privileged path
- permission required
- reason required
- correlation id required
- immutable audit required

## 10. Final Migration Sequence

1. Update `DATABASE_SCHEMA.md` with approved Epic 002 tables.
2. Create identity and organization foundation migration.
3. Add UUID primary keys and timestamps.
4. Add identity global tables.
5. Add organization tenant-scoped tables.
6. Add authorization tables.
7. Add immutable audit table.
8. Add indexes and unique constraints.
9. Add RLS policies for tenant-scoped tables.
10. Add rollback guidance.
11. Add migration tests.

No migration has been generated.

## 11. Final Test Matrix

Required categories:

- identity unit tests
- authentication integration tests
- session lifecycle tests
- refresh-token replay tests
- password reset tests
- email verification tests
- invitation lifecycle tests
- membership lifecycle tests
- ownership transfer tests
- permission evaluation tests
- authorization denial tests
- cross-tenant read/write tests
- RLS missing-context tests
- background-job tenant leakage tests
- platform-admin privileged path tests
- immutable audit generation tests
- API validation and error-response tests

## 12. Go / No-Go Recommendation

Recommendation: No-Go for implementation until GitHub publication is completed or explicitly waived.

The Epic 002 design package is ready for implementation review, but implementation should not begin while the official remote, Epic 001 PR, remote CI, and Docker validation remain unresolved unless the user explicitly waives that dependency.
