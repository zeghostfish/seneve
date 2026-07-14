# Epic 002 - Identity Aggregate Implementation Plan

## Status

Planning only.

Do not implement source code, Prisma models, migrations, controllers, or services until this plan is approved and the GitHub publication requirements for Epic 001 are resolved or explicitly waived.

## Objective

Implement the Identity Aggregate as the foundation for authentication, credentials, sessions, email verification, password reset, login history, and future authentication providers.

The aggregate root is `Identity`, not `User`.

## Aggregate Boundary

```text
Identity
  -> User
  -> Credential
  -> EmailAddress
  -> PhoneNumber
  -> Session
  -> RefreshToken
  -> PasswordReset
  -> EmailVerification
  -> LoginHistory
```

The aggregate owns authentication and account lifecycle invariants.

The aggregate does not own organization membership, permissions, campaigns, payments, votes, fraud, workflows, billing, or reporting.

## Affected Packages and Modules

Packages:

- `packages/domain/identity`
- `packages/domain/organization` for integration contracts only
- `packages/shared`
- `packages/contracts`
- `packages/config`
- `packages/testing`

Applications:

- `apps/api`
- `apps/worker` only for future async identity jobs, if needed

Database:

- `database/prisma/schema.prisma`
- `database/migrations`

Documentation:

- `docs/database/DATABASE_SCHEMA.md`
- `docs/roadmap/EPIC-002-IDENTITY-ORGANIZATIONS-PLAN.md`
- `docs/roadmap/RELEASE_NOTES.md`
- OpenAPI documentation generated from API decorators after implementation

## Database Entities to Introduce

Proposed tables:

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
- `audit_logs`

Key constraints:

- UUID primary keys.
- normalized email uniqueness.
- raw tokens never stored.
- token hashes indexed by lookup-safe digest.
- refresh-token family id tracked for reuse detection.
- session status indexed.
- login history append-only.
- audit logs immutable.

Tenant note:

- Identity tables are global unless they represent organization membership or tenant-owned records.
- Tenant-scoped organization data is not part of the Identity aggregate.

## Domain Events

Minimum V1 identity events:

- `IdentityRegistered`
- `EmailVerified`
- `PhoneVerified`
- `PasswordChanged`
- `PasswordResetRequested`
- `PasswordResetCompleted`
- `LoginSucceeded`
- `LoginFailed`
- `SessionCreated`
- `SessionRevoked`
- `RefreshTokenRotated`
- `RefreshTokenReuseDetected`

Every event must include:

- event id
- event type
- aggregate id
- actor id where applicable
- occurred at
- correlation id
- causation id
- payload version

Audit-generating events:

- all listed V1 identity events generate audit records except where privacy policy requires recording a security event with redacted target details.

## Required Migrations

Migration name proposal:

```text
002_identity_organizations_foundation
```

Migration responsibilities:

- create identity tables
- create organization and authorization tables only after the full Epic 002 database plan is approved
- add indexes and unique constraints
- define enum values
- add immutable audit log table if not already present
- add RLS for tenant-scoped tables introduced in the same migration
- include rollback guidance

No migration should be generated until the full Epic 002 plan and this Identity Aggregate plan are approved.

## Testing Strategy

Unit tests:

- identity registration invariants
- email normalization
- password policy
- credential creation
- Argon2id hashing wrapper behavior
- session state transitions
- refresh-token rotation
- refresh-token reuse detection
- password reset state transitions
- email verification state transitions
- domain event emission

Integration tests:

- register identity
- verify email
- login
- refresh token
- logout
- revoke session
- request and complete password reset
- login history append
- audit event creation

Security tests:

- invalid credentials
- brute-force protection
- expired access token
- expired refresh token
- refresh-token replay
- revoked session
- unverified email restrictions
- token hash only, no raw token persistence
- secret redaction in logs and audit metadata

Regression tests:

- password reset revokes sessions
- reused refresh token revokes token family
- suspended identity cannot authenticate
- archived identity remains audit-readable but cannot authenticate

## Implementation Sequence

1. Update `DATABASE_SCHEMA.md` with approved Identity Aggregate tables.
2. Add identity domain types and value objects.
3. Add identity state machines.
4. Add password hashing port and implementation adapter.
5. Add token generation and hashing port.
6. Add identity repository port.
7. Add identity application services.
8. Add session application services.
9. Add email verification application services.
10. Add password reset application services.
11. Add login history append behavior.
12. Add domain event publishing.
13. Add audit event integration.
14. Add API contracts and DTO validation.
15. Add API controllers.
16. Add unit tests.
17. Add integration tests.
18. Add security tests.
19. Update OpenAPI, documentation, and release notes.

## Acceptance Criteria

Identity Aggregate implementation is complete only when:

- identity registration works
- email verification works
- login succeeds for verified active identity
- login fails safely for invalid credentials
- sessions are created and revoked
- refresh tokens rotate
- refresh-token reuse is detected and revokes the token family
- password reset lifecycle works
- password reset revokes active sessions
- login history is append-only
- identity events are emitted
- immutable audit records are generated
- tests pass
- OpenAPI documentation is updated
- no organization membership logic is embedded in Identity aggregate

## Principal Risks

- coupling `User` directly to organization membership would weaken the multi-tenant model.
- storing raw tokens would create high security exposure.
- missing token-family reuse detection would allow replay attacks.
- pushing permission checks into controllers would bypass the Permission Evaluation Service.
- implementing identity and organization migrations without RLS design would violate tenant isolation requirements.

## Current Recommendation

No-Go for implementation until:

- Epic 001 is published or publication is explicitly waived.
- the Identity Aggregate plan is approved.
- the full Epic 002 plan is approved.
- database schema changes are reviewed before migration generation.
