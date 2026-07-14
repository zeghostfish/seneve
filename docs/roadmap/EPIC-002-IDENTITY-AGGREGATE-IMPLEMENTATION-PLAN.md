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

The term "Identity Aggregate" defines the business boundary. It does not require every identity-related record to be persisted or loaded through one database object for routine authentication operations.

## Invariants

Identity invariants:

- A normalized email address cannot belong to multiple active identities when it is used as a unique login identifier.
- A credential must never expose or retain a plaintext secret.
- A refresh token must be stored only as a secure hash or equivalent non-reversible representation.
- Refresh-token reuse must revoke the affected token family according to the approved security policy.
- An expired, revoked, or consumed verification token cannot be reused.
- Authentication failure must not reveal whether a specific account exists.
- Account suspension must invalidate or restrict active sessions according to the documented lifecycle.
- Identity closure must preserve the minimum immutable audit history required by the platform.

Practical aggregate-loading rules:

- login may load identity, active password credential, email verification status, and session metadata only.
- refresh may load the refresh-token session and token family only.
- password reset may load identity, password credential, reset request, and sessions only.
- login history and audit logs are append-only records and should not be loaded as mutable aggregate children for routine commands.

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

## Transaction Boundaries

Identity transactions:

- registration: create identity, user, primary email, password credential, email verification, domain event, and audit record atomically.
- email verification: consume verification token, mark email verified, activate identity where eligible, emit event, and write audit atomically.
- login success: validate credential, create session and refresh-token family, append login history, emit event, and write audit atomically.
- login failure: append redacted login history/security event and audit without revealing account existence.
- refresh token: rotate token, revoke reused token family if replay detected, emit event, and write audit atomically.
- logout/session revocation: revoke session, clear refresh-token state, emit event, and write audit atomically.
- password reset completion: consume reset token, change credential, revoke active sessions, emit event, and write audit atomically.

Non-transactional external effects:

- email delivery is triggered after durable state is recorded.
- failed email delivery must not roll back identity state; it creates a retryable notification concern.

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

Domain event payload rules:

- no raw credentials
- no raw tokens
- no password hashes
- no OTP values
- no unnecessary personal data
- payloads are versioned
- event names are stable

## Error Taxonomy

Identity error codes:

- `EMAIL_ALREADY_EXISTS`
- `WEAK_PASSWORD`
- `INVALID_CREDENTIALS`
- `EMAIL_NOT_VERIFIED`
- `ACCOUNT_LOCKED`
- `USER_SUSPENDED`
- `USER_DEACTIVATED`
- `ACCESS_TOKEN_EXPIRED`
- `REFRESH_TOKEN_EXPIRED`
- `REFRESH_TOKEN_REUSED`
- `SESSION_REVOKED`
- `RESET_TOKEN_INVALID`
- `RESET_TOKEN_EXPIRED`
- `VERIFICATION_TOKEN_INVALID`
- `VERIFICATION_TOKEN_EXPIRED`
- `RATE_LIMITED`
- `VALIDATION_FAILED`

Security response rule:

- login, password reset request, and email verification resend must avoid account-enumeration signals.

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

Rollback and recovery considerations:

- table creation migrations can be rolled back before production data exists.
- after production use, identity migrations should prefer forward repair migrations.
- token and audit data must not be destructively rewritten.
- failed partial deployments must preserve existing login/session integrity.

## Blocking and Non-Blocking Open Items

Blocking:

- none in the Identity Aggregate design package after the latest approved decisions.

Non-blocking:

- email provider selection
- production secret-management provider
- first Platform Super Administrator bootstrap procedure
- jurisdiction-specific audit retention period

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
