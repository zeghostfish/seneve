# Epic 002 - Identity Aggregate Implementation Plan

## Status

Phase 5 implementation complete under the approved Local Implementation Waiver.

The waiver authorizes Epic 002 local implementation before GitHub publication. Phase 5 remains limited to Email Verification application workflows. Controllers, public authentication endpoints, password reset, organization implementation, tenant RLS, and generic audit persistence remain deferred to later phases.

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
- `packages/identity-application`
- `packages/identity-crypto`
- `packages/identity-persistence`
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

## Phase 1 Local Implementation Scope

Implemented:

- Identity aggregate root.
- Password credential abstraction.
- Email address normalization and verification state.
- Password hash and token hash value objects that reject plaintext or reversible token material.
- Password policy validation utility.
- Session and refresh-token state transitions.
- Email-verification and password-reset one-time token state transitions.
- Stable identity domain error codes.
- Versioned identity domain-event contracts.
- Unit tests for approved Identity invariants.

Explicitly deferred:

- password hashing execution with Argon2id.
- token generation.
- persistence and repositories.
- migrations.
- transaction boundaries in application services.
- email delivery.
- controllers and OpenAPI decorators.
- audit log persistence.
- organization integration.

## Database Entities to Introduce

Phase 2 tables:

- `identities`
- `users`
- `identity_emails`
- `credentials`
- `sessions`
- `refresh_tokens`
- `email_verification_tokens`
- `password_reset_tokens`
- `identity_security_events`
- `trusted_devices`

Deferred tables:

- `phone_numbers`
- authentication-provider identities
- generic `audit_logs`

Persistence decision:

- `Identity` and `User` use separate tables.
- `identities` stores authentication lifecycle, login uniqueness, and suspension/closure state.
- `users` stores the person/profile record and never stores credentials, emails, sessions, or tokens.
- This avoids coupling authentication directly to `User` while keeping the one-to-one relationship simple for V1.

Key constraints:

- UUID primary keys.
- normalized email uniqueness.
- raw tokens never stored.
- token hashes indexed by lookup-safe digest.
- refresh-token family id tracked for reuse detection.
- session status indexed.
- login history append-only.
- audit logs immutable.

Phase 2 migration:

- `database/migrations/20260714234500_identity_persistence/migration.sql`
- creates the Identity persistence tables, enums, foreign keys, indexes, partial unique indexes, and check constraints.
- rollback before production data can drop the created tables and enums in reverse dependency order.
- after production use, identity persistence should be corrected through forward migrations rather than destructive rollback.

## Transaction Boundaries

Identity transactions:

- registration: create identity, user, primary email, password credential, email verification, domain event, and audit record atomically.
- email verification: consume verification token, mark email verified, activate identity where eligible, emit event, and write audit atomically.
- login success: validate credential, create session and refresh-token family, append login history, emit event, and write audit atomically.
- login failure: append redacted login history/security event and audit without revealing account existence.
- refresh token: rotate token, revoke reused token family if replay detected, emit event, and write audit atomically.
- logout/session revocation: revoke session, clear refresh-token state, emit event, and write audit atomically.
- password reset completion: consume reset token, change credential, revoke active sessions, emit event, and write audit atomically.

Phase 2 repository transaction boundaries:

- identity registration with user, primary email, and password credential is one create operation.
- session creation with initial refresh token is one create operation.
- refresh-token rotation uses a conditional `ACTIVE` token update and creates the replacement token in the same transaction.
- refresh-token replay revokes the token family and affected active sessions in the same transaction.
- email-verification and password-reset token consumption use conditional `PENDING` token updates.
- identity suspension and active-session revocation happen in one transaction.

Phase 3 application-service transaction boundaries:

- registration hashes the password before persistence, then creates identity, user, primary email, credential, email-verification token, and security event in one unit of work.
- login validates identity state and password, then creates session, refresh token, and security event in one unit of work before issuing the access token.
- refresh-token rotation delegates the conditional rotation and replay response to the session repository, then issues a replacement access token only after a successful rotation.
- logout and session revocation are idempotent application commands.
- identity suspension delegates session revocation to the repository and records an identity-specific security event.

Phase 4 session/security boundaries:

- Security Decision Service owns configurable session and security-policy evaluation.
- SessionManagementService owns active-session queries, session expiration, selected revocation, revoke-all-except-current, and device identification.
- AuthenticationService consults the Security Decision Service instead of embedding maximum-session and email-verification policy.
- Trusted devices are represented by a hashed fingerprint abstraction; browser fingerprint collection remains deferred.

Phase 5 email-verification boundaries:

- RequestEmailVerificationService creates verification challenges and emits ephemeral notification commands.
- ResendEmailVerificationService applies application-level resend policy and supersedes obsolete pending tokens.
- CompleteEmailVerificationService consumes eligible tokens and marks the primary email verified atomically.
- raw verification tokens may appear only in `EmailVerificationNotificationCommand` output and must not be persisted or recorded in security events.

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

## Phase 3 Application Services

Application package:

- `@seneve/identity-application`

Infrastructure-sensitive interfaces:

- `PasswordHasher`
- `TokenGenerator`
- `TokenHasher`
- `AccessTokenIssuer`
- `Clock`
- `SecurityEventRecorder`
- `IdentityUnitOfWork`
- Identity repository contracts

Implemented use cases:

- identity registration
- password credential creation through the configured hasher boundary
- login
- session creation
- access-token issuance
- refresh-token rotation
- refresh-token replay response
- current-session logout
- all-session revocation
- identity suspension enforcement

Explicitly deferred:

- NestJS controllers
- public HTTP DTOs
- cookies
- OpenAPI authentication endpoints
- email-provider delivery
- Redis-backed brute-force protection
- email-verification completion service
- password-reset service

## Phase 3 Cryptographic Abstractions

Crypto package:

- `@seneve/identity-crypto`

Implemented adapters:

- `NodeArgon2idPasswordHasher`
- `NodeOpaqueTokenGenerator`
- `HmacSha256TokenHasher`
- `HmacAccessTokenIssuer`

Argon2id configuration:

- memory: 65,536 KiB
- passes: 3
- parallelism: 1
- tag length: 32 bytes
- salt length: 16 bytes

Access-token payload:

- `sub`
- `identity_id`
- `session_id`
- `token_version`
- `iat`
- `exp`
- issuer and audience

Access-token exclusions:

- no organization roles
- no permissions
- no long-lived authorization state

Rate-limit boundary:

- application services record `LOGIN_FAILED` facts and preserve generic external errors.
- Redis-backed rate limiting and per-IP controls are deferred to the API/security integration phase.
- Phase 3 must not be described as full brute-force protection.

## Phase 4 Security And Session Management

Application services:

- `ConfigurableSecurityDecisionService`
- `SessionManagementService`

Security decisions:

- `CanLogin`
- `CanRefresh`
- `CanCreateSession`
- `CanCreateNewDevice`
- `MustForceLogout`
- `MustRequireEmailVerification`
- `MustRotateCredential`

Configurable policy values:

- maximum concurrent sessions
- session duration
- refresh-token lifetime
- password lifetime
- email-verification requirement
- forced logout on password change
- password reuse prevention count
- trust-new-device behavior

Device model:

- device identifier
- device display name
- hashed device fingerprint
- first seen timestamp
- last activity timestamp
- device revocation timestamp

Security concerns remain separated:

- Authentication verifies credentials and issues sessions/tokens.
- Session management lists and revokes sessions and manages trusted devices.
- Security evaluates policy and records security facts.
- Authorization remains deferred to the Permission Evaluation phase.

## Phase 5 Email Verification

Application services:

- `RequestEmailVerificationService`
- `CompleteEmailVerificationService`
- `ResendEmailVerificationService`

Token lifecycle:

- generated through `TokenGenerator`
- hashed through `TokenHasher`
- persisted only as token hash
- superseded by revoking pending previous tokens
- consumed through conditional repository update
- completion and primary-email verification are performed in one unit of work

Resend policy:

- minimum resend delay is configurable.
- request window and maximum request count are enforced through repository-backed application policy.
- active unexpired token resends before the minimum delay are denied with `EMAIL_VERIFICATION_REQUEST_THROTTLED`.
- new request/resend supersedes previous pending tokens when configured.

Notification boundary:

- `EmailVerificationNotificationCommand`
- contains recipient email, template id, locale, raw verification token, token id, expiry and correlation id
- command is ephemeral and not persisted as a domain/security event

Phase 5 events:

- `EMAIL_VERIFICATION_REQUESTED`
- `EMAIL_VERIFICATION_RESENT`
- `EMAIL_VERIFIED`
- `EMAIL_VERIFICATION_FAILED`
- `EMAIL_VERIFICATION_EXPIRED`

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

Phase 3 application error codes:

- `INVALID_CREDENTIALS`
- `IDENTITY_SUSPENDED`
- `EMAIL_VERIFICATION_REQUIRED`
- `SESSION_INVALID`
- `SESSION_REVOKED`
- `REFRESH_TOKEN_INVALID`
- `REFRESH_TOKEN_EXPIRED`
- `REFRESH_TOKEN_REUSED`
- `REGISTRATION_CONFLICT`
- `PASSWORD_POLICY_VIOLATION`
- `AUTHENTICATION_TRANSACTION_FAILED`

Phase 5 email-verification error codes:

- `EMAIL_ALREADY_VERIFIED`
- `EMAIL_VERIFICATION_TOKEN_INVALID`
- `EMAIL_VERIFICATION_TOKEN_EXPIRED`
- `EMAIL_VERIFICATION_TOKEN_CONSUMED`
- `EMAIL_VERIFICATION_REQUEST_THROTTLED`
- `EMAIL_VERIFICATION_NOT_ALLOWED`
- `EMAIL_VERIFICATION_TRANSACTION_FAILED`

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
- password hash storage format protection
- session state transitions
- refresh-token rotation
- refresh-token reuse detection
- password reset state transitions
- email verification state transitions
- domain event emission
- registration application flow
- duplicate registration conflict mapping
- password-policy failure
- login success and failure
- suspended and unverified login rejection
- refresh-token rotation
- refresh-token replay response
- logout, all-session revocation, and suspension application flows
- Argon2id hashing and verification adapter
- token hashing adapter
- access-token payload exclusions
- maximum session policy evaluation
- credential-rotation policy evaluation
- active-session listing
- selected and administrator session revocation
- revoke-all-except-current
- trusted-device registration and lookup
- email-verification request
- email-verification resend
- resend throttling
- token supersession
- email-verification completion
- invalid, expired and consumed token handling
- verification transaction rollback

Integration tests:

- register identity
- verify email
- identity persistence and rehydration
- normalized email uniqueness
- credential persistence without plaintext values
- session creation
- refresh-token rotation
- repeated refresh-token consumption
- email-verification token single use
- password-reset token single use
- identity suspension and session revocation
- transaction rollback on failure

PostgreSQL execution note:

- repository integration tests are gated behind `RUN_POSTGRES_INTEGRATION=true` and require `DATABASE_URL`.
- they must run against PostgreSQL after migrations are applied.
- local validation may report them as skipped when PostgreSQL is unavailable; skipped tests are not equivalent to database validation.
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
