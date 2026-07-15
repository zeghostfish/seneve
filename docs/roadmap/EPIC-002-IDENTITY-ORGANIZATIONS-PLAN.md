# Epic 002 - Identity and Organizations Planning

## Status

Design approved. Local implementation authorized by project-owner waiver.

Implementation must follow the approved phase order. Phase 11 is implemented and remains limited to PostgreSQL Row-Level Security with no Audit persistence, controllers or REST API.

## Objective

Define the Identity, Authentication, Session, Authorization, Organizations, Membership, Invitation, Audit, and Tenant Isolation design for Seneve.

Epic 002 establishes who can access the platform, how sessions work, how users belong to organizations, and how tenant isolation is enforced before Campaign functionality begins.

## Scope

Included:

- email/password authentication for V1
- access-token and refresh-token lifecycle
- refresh-token rotation and token-family reuse detection
- password hashing
- account recovery
- email verification
- user and identity data model
- organization lifecycle
- membership lifecycle
- invitation lifecycle
- RBAC permission matrix
- policy and condition evaluation model
- tenant context propagation
- PostgreSQL Row-Level Security strategy
- platform administrator cross-tenant access model
- audit taxonomy for identity and organization operations
- soft deletion, suspension, closure, archival, and deactivation rules
- API contracts
- security test matrix
- tenant-isolation test matrix

Excluded:

- Campaign implementation
- Candidate implementation
- Voting implementation
- Payment implementation
- Fraud implementation
- Workflow implementation
- Billing implementation
- Reporting implementation
- Public API keys
- SSO
- OAuth2 provider login
- enterprise identity federation
- phone-number login
- SMS verification

## Implementation Progress

### Phase 1 - Identity Aggregate

Status: complete.

Implemented locally:

- `@seneve/domain-identity` package.
- Identity aggregate root with registration, email-verification activation, authentication eligibility checks, session attachment, and suspension session-revocation behavior.
- Email, identity id, password-hash, token-hash, password-policy, credential, session, refresh-token, email-verification, and password-reset domain abstractions.
- Stable identity domain error codes.
- Versioned identity domain-event contracts.
- Unit tests for email normalization, registration events, email-verification activation, authentication gating, session revocation on suspension, password-hash protection, password-policy validation, refresh-token reuse detection, and one-time verification token reuse/expiry.

Not implemented in Phase 1:

- Prisma schema.
- database migrations.
- repositories.
- transaction management.
- NestJS modules.
- controllers.
- public authentication endpoints.
- email delivery.
- organization aggregate implementation.
- tenant isolation.
- audit persistence.

### Phase 2 - Identity Persistence

Status: implemented, persistence validation pending.

Implemented locally:

- Identity-related Prisma models and enums.
- Versioned SQL migration for Identity persistence.
- PostgreSQL partial unique indexes and check constraints for critical invariants.
- `@seneve/identity-persistence` package outside the domain layer.
- Repository interfaces in the domain boundary using explicit command/read models.
- Prisma repository adapters with explicit mapping and transaction boundaries.
- PostgreSQL-gated integration tests for repository behavior and database constraints.

Not implemented in Phase 2:

- controllers.
- public authentication endpoints.
- registration/login application services.
- password hashing execution.
- token generation.
- email delivery.
- organization persistence.
- tenant RLS.
- generic audit persistence.

### Phase 3 - Authentication Application Services

Status: complete.

Implemented locally:

- `@seneve/identity-application` package.
- `@seneve/identity-crypto` package.
- Authentication service contracts for password hashing, token generation, token hashing, access-token issuing, clock, unit of work, and security-event recording.
- Registration application service with password policy validation, Argon2id hash boundary, email-verification token creation, and generic conflict mapping.
- Login application service with normalized identifier lookup, generic invalid-credential errors, email-verification enforcement, suspended-identity enforcement, session creation, access-token issuance, and refresh-token hash persistence.
- Refresh application service with token hashing, repository-level rotation, replay handling, replacement token issuance, and security-event recording.
- Logout, all-session revocation, and identity suspension application commands.
- Native Node Argon2id password hasher with the approved V1 parameters.
- HMAC-SHA-256 token hasher and minimal signed access-token issuer.

Not implemented in Phase 3:

- NestJS controllers.
- public authentication endpoints.
- cookies.
- OpenAPI authentication routes.
- email-provider delivery.
- Redis-backed rate limiting and lockout.
- email-verification completion service.
- password-reset service.
- organization implementation.

### Phase 4 - Identity Security and Session Management

Status: complete.

Implemented locally:

- trusted-device persistence model and repository contract.
- session metadata for device association, last activity, expiration and revocation reason.
- `ConfigurableSecurityDecisionService` for configurable security-policy evaluation.
- `SessionManagementService` for listing active sessions, counting sessions, selected revocation, revoke-all-except-current and trusted-device identification.
- Authentication service integration with security decisions for login, refresh and device creation.
- expanded identity security-event catalogue for session expiration, new devices, suspicious login, concurrent-session limits, administrator revocation, refresh replay and policy violations.

Concern boundaries:

- Authentication verifies credentials and issues sessions/tokens.
- Session management lists and revokes sessions and manages trusted devices.
- Security evaluates policies and records security facts.
- Authorization remains deferred to the Permission Evaluation phase.

Not implemented in Phase 4:

- browser fingerprint collection.
- NestJS controllers.
- HTTP cookies.
- JWT middleware.
- REST session-management endpoints.
- email-verification completion.
- password reset.
- Redis-backed API rate limiting.

### Phase 5 - Email Verification

Status: complete.

Implemented locally:

- `RequestEmailVerificationService`.
- `CompleteEmailVerificationService`.
- `ResendEmailVerificationService`.
- ephemeral `EmailVerificationNotificationCommand` boundary for raw verification tokens.
- secure token generation and hashing through existing abstractions.
- pending-token supersession before new request/resend token creation.
- resend throttling based on latest token metadata and configured request-window limits.
- atomic token consumption and primary-email verification through `IdentityUnitOfWork`.
- stable email-verification application errors.
- security events for verification request, resend, completion, failure and expiry.

Not implemented in Phase 5:

- external email-provider delivery.
- HTTP controllers.
- REST DTOs.
- cookies.
- JWT middleware.
- password reset.
- Redis/API-layer abuse controls.
- email address change workflow.

### Phase 6 - Password Reset

Status: complete.

Implemented locally:

- `RequestPasswordResetService`.
- `CompletePasswordResetService`.
- ephemeral `PasswordResetNotificationCommand` boundary for raw reset tokens.
- generic accepted reset-request response that does not expose account existence.
- secure token generation and hashing through existing abstractions.
- pending-token supersession before new reset-token creation.
- request throttling based on latest token metadata and configured request-window limits.
- Model B credential replacement: revoke the active password credential and append a new active credential version.
- password-policy enforcement before token consumption.
- optional current-password reuse rejection when configured.
- atomic reset-token consumption, credential replacement, pending-token revocation, session revocation and refresh-token revocation through `IdentityUnitOfWork`.
- stable password-reset application errors.
- security events for reset request, resend, completion, failure, expiry, credential replacement and session revocation.

Not implemented in Phase 6:

- external email-provider delivery.
- outbox persistence or notification queue integration.
- HTTP controllers.
- REST DTOs.
- cookies.
- JWT middleware.
- authenticated password change.
- historical password reuse comparison beyond the current active password.
- Redis/API-layer abuse controls.

### Phase 7 - Organization Aggregate Foundation

Status: complete.

Implemented locally:

- `@seneve/domain-organization` package.
- `Organization` aggregate root.
- organization profile value object with display name, slug, locale and timezone.
- organization lifecycle state machine: `DRAFT`, `ACTIVE`, `SUSPENDED`, `CLOSED`, `ARCHIVED`.
- membership role catalogue: `OWNER`, `ADMINISTRATOR`, `EVENT_MANAGER`, `FINANCE_MANAGER`, `CONTENT_MANAGER`, `VIEWER`, `AUDITOR`.
- membership lifecycle: `ACTIVE`, `SUSPENDED`, `REMOVED`.
- invitation lifecycle: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- pending membership decision: pending participation is represented by Invitation, not a duplicate Membership state.
- last-owner protection for removal, suspension and downgrade.
- explicit ownership transfer operation.
- duplicate active membership protection.
- duplicate pending invitation protection.
- invitation recipient matching and replay protection.
- stable organization domain errors.
- versioned organization domain-event contracts.

Not implemented in Phase 7:

- Prisma organization models.
- organization migrations.
- repository adapters.
- tenant Row-Level Security.
- Permission Evaluation Service.
- NestJS modules.
- HTTP controllers.
- invitation delivery.
- subscription, billing, API keys, payment accounts or advanced branding.

### Phase 8 - Permission Evaluation Service

Status: complete.

Implemented locally:

- `@seneve/authorization-application` package.
- immutable permission catalogue.
- organization role-to-permission mapping.
- platform administrator role mapping.
- `PermissionEvaluationService`.
- structured authorization decisions with `allowed`, `reasonCode`, `permission`, `policy`, `evaluatedConditions` and role metadata.
- reusable condition names for tenant, membership, role, ownership, organization state, self-operation, invitation and explicit-deny checks.
- declarative policy names for organization, membership, invitation, ownership, billing and future campaign-related permissions.
- explicit platform administrator override path.
- explicit deny precedence for last-owner-sensitive membership operations.
- self-service membership read support.
- stable authorization errors.

Not implemented in Phase 8:

- Prisma authorization tables.
- migrations.
- custom role persistence.
- policy persistence.
- tenant request context propagation.
- PostgreSQL Row-Level Security.
- NestJS guards.
- HTTP middleware.
- audit persistence.

### Phase 9 - Organization Persistence

Status: implemented, PostgreSQL runtime validation pending.

Implemented locally:

- Organization Prisma models and enums for organizations, memberships and invitations.
- Versioned SQL migration for Organization persistence.
- Repository contracts in `@seneve/domain-organization`.
- `@seneve/organization-persistence` package with Prisma repository adapters.
- Explicit mapping between Prisma records and organization persistence read models.
- Unit-of-work transaction wrapper for organization persistence operations.
- Atomic organization creation with initial owner membership.
- Atomic invitation acceptance with membership creation.
- Atomic ownership transfer.
- Conditional updates for lifecycle mutations and invitation consumption.
- PostgreSQL partial unique indexes for active memberships and pending invitations.
- PostgreSQL-gated integration tests for organization persistence, constraints, transaction rollback, ownership transfer and invitation acceptance.

Not implemented in Phase 9:

- tenant request context propagation.
- PostgreSQL Row-Level Security policies.
- NestJS controllers.
- REST DTOs.
- organization HTTP API.
- invitation delivery.
- generic audit persistence.
- custom role persistence.
- subscriptions, billing, API keys, campaign functionality or tenant-scoped business modules.

### Phase 10 - Tenant Context Engine

Status: complete.

Implemented locally:

- `@seneve/tenant-context` package.
- canonical `TenantContext`.
- `TenantScope`.
- `TenantResolver`.
- `TenantContextProvider`.
- `TenantExecutionContext`.
- AsyncLocalStorage propagation provider.
- execution modes for anonymous, authenticated, tenant, platform administration, cross-tenant and system execution.
- execution-source support for HTTP requests, worker jobs, CLI commands, scheduled tasks, internal workflows, future webhooks and future API tokens.
- cross-tenant execution validation requiring platform administrator role, target tenant, reason and correlation identifier.
- authorization integration through canonical tenant context consumption.
- tests for HTTP context creation, worker propagation, nested application-service propagation, unit-of-work propagation, cross-tenant rejection, platform override, missing tenant, anonymous execution and correlation propagation.

Not implemented in Phase 10:

- PostgreSQL Row-Level Security policies.
- `SET LOCAL`.
- database session variables.
- Prisma middleware for RLS.
- tenant-aware HTTP middleware.
- REST controllers.
- generic audit persistence.

### Phase 11 - PostgreSQL Row-Level Security

Status: implemented, PostgreSQL runtime validation pending.

Implemented locally:

- versioned RLS migration for organization-scoped tables.
- RLS helper functions under the `app` schema.
- transaction-local database settings for tenant, identity, execution mode, correlation, platform-admin and cross-tenant metadata.
- `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` for protected organization tables.
- `USING` and `WITH CHECK` policies for organizations, memberships and invitations.
- `PrismaTenantRlsTransactionBoundary`.
- controlled organization-bootstrap operation.
- controlled invitation-acceptance operation.
- platform-administration and cross-tenant database execution paths.
- PostgreSQL-gated RLS integration tests.
- unit tests for tenant-aware transaction setting behavior.

Not implemented in Phase 11:

- generic Audit persistence.
- NestJS middleware.
- HTTP tenant headers.
- REST controllers.
- frontend tenant selection.
- production role provisioning automation.

## Confirmed V1 Authentication Decisions

Supported V1 authentication methods:

- email and password
- email verification
- JWT access token
- opaque refresh token with rotation

Deferred authentication methods:

- OAuth2 social login
- SSO
- passkeys
- magic links
- phone-only login

Password hashing:

- algorithm: Argon2id
- memory cost: 64 MiB
- time cost: 3 iterations
- parallelism: 1
- salt: unique per password
- pepper: optional server secret if operational secret management is available
- fallback only if Argon2id cannot be deployed: bcrypt with cost factor 12, documented by ADR before implementation

Access token:

- JWT
- lifetime: 15 minutes
- signed with configured server secret
- includes `sub`, `sessionId`, `tokenVersion`, `iat`, `exp`
- may include active `organizationId` only as request context hint
- must not include permission lists as source of truth

Refresh token:

- opaque random token, at least 256 bits of entropy
- lifetime: 30 days absolute
- idle timeout: 7 days since last successful rotation
- storage strategy for browser clients: `HttpOnly`, `Secure`, `SameSite=Lax` cookie in production
- local development may use non-secure cookie only when `NODE_ENV=development`
- stored server-side only as HMAC-SHA-256 or Argon2id hash of token value
- raw token is never logged or stored

Token rotation:

- every successful refresh rotates the refresh token
- previous token is marked `rotated`
- new token belongs to the same token family
- rotation emits `RefreshTokenRotated`

Token-family reuse detection:

- reuse of a rotated, revoked, or expired refresh token marks the token family compromised
- all active sessions in that token family are revoked
- event emitted: `RefreshTokenReuseDetected`
- audit event emitted: `auth.refresh_token_reuse_detected`

Session revocation:

- logout revokes the current refresh-token session
- password reset completion revokes all active refresh-token sessions for the user
- administrator suspension revokes all active sessions
- compromised-session handling revokes the affected token family immediately

Logout behavior:

- requires authentication when possible
- revokes current refresh-token session
- clears refresh-token cookie
- emits `UserLoggedOut`
- writes `auth.logout`

Password reset lifecycle:

- request creates single-use expiring token
- token lifetime: 30 minutes
- token stored as hash only
- completion changes password credential
- completion revokes active refresh sessions
- completion emits `PasswordResetCompleted`
- both request and completion are audited

Email verification lifecycle:

- verification token lifetime: 24 hours
- token stored as hash only
- token is single-use
- successful verification sets `email_verified_at`
- verified email is required before organization creation or accepting organization membership
- verification completion emits `UserEmailVerified`

Account lockout and rate limiting:

- login: max 5 failed attempts per normalized email and IP in 15 minutes
- lockout: 15 minutes after 10 failed attempts in 30 minutes
- password reset request: max 3 requests per email per hour
- email verification resend: max 3 requests per email per hour
- refresh endpoint: max 30 attempts per session per hour
- rate-limit decisions must not reveal whether an email exists

## User and Identity Model

The model distinguishes:

- user account: durable person-level account
- authentication identity: login method and credential set
- verified email: email address confirmed through token lifecycle
- verified phone number: future verification attribute, not V1 login method
- session: refresh-token-backed authenticated session
- credential: password credential or future auth credential
- organization membership: tenant relationship between user and organization

A user account does not belong directly to a single organization.

A user may belong to multiple organizations through memberships.

## Domain Aggregates and Entities

### Identity Aggregate

Aggregate root: `Identity`

The Identity aggregate owns authentication identity and session lifecycle. `User` is a child entity representing the person/account profile, not the aggregate root.

Recommended aggregate structure:

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

This design keeps authentication independent from the `User` entity and prepares the platform for multiple authentication providers, passwordless authentication, magic links, passkeys/WebAuthn, OAuth, SAML, and enterprise SSO.

Entities and value objects:

- `Identity`
- `User`
- `AuthenticationIdentity`
- `Credential`
- `PasswordCredential`
- `EmailAddress`
- `PhoneNumber`
- `EmailVerification`
- `PasswordResetRequest`
- `RefreshTokenSession`
- `RefreshTokenFamily`
- `Session`
- `RefreshToken`
- `LoginHistory`
- `UserSecurityEvent`

Responsibilities:

- authentication identity
- credential lifecycle
- account state
- email verification
- session ownership
- security event history

Non-responsibilities:

- organization permissions
- campaign access
- tenant data ownership

### Organization Aggregate

Aggregate root: `Organization`

Recommended aggregate structure:

```text
Organization
  -> Membership
  -> Invitation
  -> OrganizationSettings
  -> Branding
  -> Subscription
  -> BillingProfile
  -> APIKey
```

`Subscription`, `BillingProfile`, and `APIKey` are included in the aggregate boundary for future extensibility, but billing and public API key implementation remains outside Epic 002 unless separately approved.

Entities and value objects:

- `Organization`
- `OrganizationSettings`
- `OrganizationBranding`
- `Subscription`
- `BillingProfile`
- `Membership`
- `Invitation`
- `RoleAssignment`
- `APIKey`

Responsibilities:

- tenant lifecycle
- membership lifecycle
- invitations
- organization settings
- role assignment within the tenant

Non-responsibilities:

- global platform administration policy
- campaign business rules
- billing calculations

### Authorization Aggregate

Authorization model:

```text
Role
  -> Permission
    -> Policy
      -> Condition
```

Entities and value objects:

- `Role`
- `Permission`
- `Policy`
- `Condition`
- `AuthorizationDecision`

Responsibilities:

- permission mapping
- policy evaluation
- condition evaluation
- deny/allow decision explanation

### Permission Evaluation Service

Authorization checks must be centralized in a dedicated Permission Evaluation Service.

Application controllers and transport adapters must not evaluate permissions directly.

The service answers questions such as:

- can this user create a campaign?
- can this user transfer ownership?
- can this user view billing?
- can this user manage API keys?

Evaluation flow:

```text
Role
  -> Permission
    -> Policy
      -> Condition
        -> Decision
```

Inputs:

- actor identity id
- user id
- organization id where applicable
- requested permission
- target resource
- request context
- correlation id

Output:

- allow or deny
- reason code
- evaluated policies
- failed conditions
- audit requirement

## State Machines

### UserStatus

```text
registered
  -> email_verification_pending
  -> active
  -> suspended
  -> deactivated
  -> archived
```

Rules:

- `active` requires verified email.
- `suspended` users cannot authenticate.
- `deactivated` users cannot authenticate but historical records remain.
- `archived` users are retained for audit and compliance.
- suspended, deactivated, and archived states revoke active sessions.

### EmailVerificationStatus

```text
created
  -> sent
  -> verified
  -> expired
  -> revoked
```

Rules:

- verification tokens are single-use.
- expired tokens cannot be reactivated.
- new verification requests create new records.

### PasswordResetStatus

```text
requested
  -> completed
  -> expired
  -> revoked
```

Rules:

- reset tokens are single-use.
- completion revokes active sessions.
- expired or revoked reset requests cannot be completed.

### RefreshTokenSessionStatus

```text
active
  -> rotated
  -> revoked
  -> reused
  -> expired
```

Rules:

- refresh tokens rotate on every use.
- reuse of a rotated token revokes the token family.
- token hashes are stored, never raw tokens.

### OrganizationStatus

```text
draft
  -> onboarding
  -> active
  -> suspended
  -> closed
  -> archived
```

Allowed actions:

| State        | Read | Update settings | Invite members | Create future campaigns | Authentication into tenant | Archive |
| ------------ | ---- | --------------- | -------------- | ----------------------- | -------------------------- | ------- |
| `draft`      | yes  | yes             | owner only     | no                      | owner only                 | yes     |
| `onboarding` | yes  | yes             | yes            | no                      | yes                        | yes     |
| `active`     | yes  | yes             | yes            | yes                     | yes                        | yes     |
| `suspended`  | yes  | limited         | no             | no                      | limited admin only         | yes     |
| `closed`     | yes  | no              | no             | no                      | read-only admin only       | yes     |
| `archived`   | yes  | no              | no             | no                      | platform admin only        | no      |

Rules:

- `closed` means the tenant relationship is ended but retained.
- `archived` is immutable read-only retention.
- closed or archived organizations cannot create campaigns.

### MembershipStatus

```text
active
  -> suspended
  -> removed
```

Rules:

- pending participation is represented by `InvitationStatus.pending`; Phase 7 does not create a duplicate pending Membership state.
- active membership is required for normal tenant-scoped access.
- removed membership does not delete audit history.
- suspended membership cannot access tenant resources.
- every active organization must retain at least one active owner.

### InvitationStatus

```text
pending
  -> accepted
  -> expired
  -> revoked
```

Rules:

- invitation tokens are single-use.
- invitation lifetime: 7 days.
- accepted invitations create or activate membership.
- revoked invitations cannot be accepted.
- duplicate pending invitations for the same email and organization are rejected with `INVITATION_ALREADY_PENDING`.
- accepting an invitation as an existing user links the membership to the existing user after email match and authentication.
- accepting an invitation as a new user requires registration and email verification before membership activation.

### Ownership Transfer

Ownership transfer is included in Epic 002 planning and implementation scope.

Rules:

- target user must have active membership.
- transfer requires `organization.owner.transfer`.
- transfer is audited.
- the previous owner remains an organization administrator unless explicitly removed later.
- organization cannot be left without an active owner.

## Role and Permission Matrix

V1 roles:

| Role                         | Scope        | Description                                      |
| ---------------------------- | ------------ | ------------------------------------------------ |
| Platform Super Administrator | global       | Seneve operator with exceptional tenant access   |
| Organization Owner           | organization | Tenant owner and ownership-transfer authority    |
| Organization Administrator   | organization | Manages organization settings and team           |
| Event Manager                | organization | Future event/campaign operations role            |
| Finance Manager              | organization | Future payment and financial administration role |
| Content Manager              | organization | Future candidate/content administration role     |
| Viewer                       | organization | Read-only operational visibility                 |
| Auditor                      | organization | Read-only audit and compliance visibility        |

V1 permissions:

| Permission                    | Super Admin | Owner | Org Admin | Event Manager | Finance Manager | Content Manager | Viewer | Auditor |
| ----------------------------- | ----------- | ----- | --------- | ------------- | --------------- | --------------- | ------ | ------- |
| `platform.tenant.access`      | yes         | no    | no        | no            | no              | no              | no     | no      |
| `organization.create`         | yes         | yes   | no        | no            | no              | no              | no     | no      |
| `organization.read`           | yes         | yes   | yes       | yes           | yes             | yes             | yes    | yes     |
| `organization.update`         | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `organization.suspend`        | yes         | no    | no        | no            | no              | no              | no     | no      |
| `organization.close`          | yes         | yes   | no        | no            | no              | no              | no     | no      |
| `organization.archive`        | yes         | yes   | no        | no            | no              | no              | no     | no      |
| `organization.owner.transfer` | yes         | yes   | no        | no            | no              | no              | no     | no      |
| `membership.read`             | yes         | yes   | yes       | no            | no              | no              | no     | yes     |
| `membership.invite`           | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `membership.update_role`      | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `membership.suspend`          | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `membership.remove`           | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `invitation.create`           | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `invitation.read`             | yes         | yes   | yes       | no            | no              | no              | no     | yes     |
| `invitation.revoke`           | yes         | yes   | yes       | no            | no              | no              | no     | no      |
| `audit.read`                  | yes         | yes   | yes       | no            | no              | no              | no     | yes     |
| `auth.session.revoke`         | yes         | self  | no        | no            | no              | no              | no     | no      |

Future permissions may be named but not implemented until later Epics:

- `event.create`
- `event.update`
- `campaign.create`
- `campaign.update`
- `candidate.manage`
- `finance.read`
- `finance.manage`

## Protected Action Requirements

| Action                  | Permission                    | Tenant scope | Conditions                              | Audit event                         |
| ----------------------- | ----------------------------- | ------------ | --------------------------------------- | ----------------------------------- |
| Register account        | none                          | global       | email unique, valid password            | `identity.account_registered`       |
| Login                   | none                          | global       | active verified account                 | `auth.login_succeeded/failed`       |
| Refresh token           | session ownership             | global       | active session, token not reused        | `auth.refresh_token_rotated`        |
| Logout                  | session ownership             | global       | active session if present               | `auth.logout`                       |
| Request password reset  | none                          | global       | rate limit                              | `auth.password_reset_requested`     |
| Complete password reset | reset token                   | global       | token valid, password policy            | `auth.password_reset_completed`     |
| Verify email            | verification token            | global       | token valid                             | `identity.email_verified`           |
| Create organization     | `organization.create`         | new tenant   | verified email, user active             | `organization.created`              |
| Update organization     | `organization.update`         | organization | org active/onboarding                   | `organization.updated`              |
| Suspend organization    | `organization.suspend`        | organization | platform admin path                     | `organization.suspended`            |
| Close organization      | `organization.close`          | organization | no required active operations           | `organization.closed`               |
| Archive organization    | `organization.archive`        | organization | closed/suspended/draft only             | `organization.archived`             |
| Invite member           | `invitation.create`           | organization | org active/onboarding, email not active | `organization.invitation_created`   |
| Revoke invitation       | `invitation.revoke`           | organization | invitation pending                      | `organization.invitation_revoked`   |
| Accept invitation       | invitation token              | organization | token pending, verified email           | `organization.invitation_accepted`  |
| Change membership role  | `membership.update_role`      | organization | cannot remove last owner                | `organization.membership_role_set`  |
| Suspend membership      | `membership.suspend`          | organization | cannot suspend last owner               | `organization.membership_suspended` |
| Remove membership       | `membership.remove`           | organization | cannot remove last owner                | `organization.membership_removed`   |
| Transfer ownership      | `organization.owner.transfer` | organization | target active member                    | `organization.owner_transferred`    |
| Read audit logs         | `audit.read`                  | organization | active membership or admin path         | optional read audit                 |
| Platform tenant access  | `platform.tenant.access`      | organization | reason required, admin path             | `platform.cross_tenant_access`      |

## Aggregate Invariants

Identity invariants:

- A normalized email address cannot belong to multiple active identities when used as a unique login identifier.
- A credential must never expose or retain a plaintext secret.
- A refresh token must be stored only as a secure hash or equivalent non-reversible representation.
- Refresh-token reuse must revoke the affected token family or session according to the approved security policy.
- Expired, revoked, or consumed verification tokens cannot be reused.
- Authentication failure must not reveal whether a specific account exists.
- Account suspension must invalidate or restrict active sessions according to the documented lifecycle.
- Identity closure must preserve the minimum immutable audit history required by the platform.

Organization invariants:

- Every active organization must have at least one active owner.
- The last active owner cannot be removed, suspended, or downgraded without a valid ownership transfer.
- A user cannot hold duplicate active memberships in the same organization.
- An invitation cannot be accepted after expiration, revocation, or prior consumption.
- An accepted invitation cannot be replayed.
- Membership role changes require the appropriate permission and tenant scope.
- Cross-tenant membership operations are prohibited.
- Organization suspension must not delete historical data.

Permission invariants:

- Permissions are denied by default.
- Tenant context is mandatory for organization-scoped actions.
- Platform-level permissions must not be inferred from organization roles.
- Cross-tenant administrative actions require a dedicated privileged path.
- Every privileged cross-tenant action must include a reason, correlation id, and immutable audit record.

## Policy Evaluation Rules

Authorization decision inputs:

- actor user id
- organization id
- requested permission
- target resource
- user status
- organization status
- membership status
- role assignments
- policy definitions
- request context
- correlation id

Evaluation order:

1. Authenticate user.
2. Validate user status.
3. Resolve tenant context.
4. Verify active membership unless platform admin path applies.
5. Resolve roles.
6. Resolve permissions.
7. Evaluate policies.
8. Evaluate conditions.
9. Apply explicit deny before allow.
10. Return decision with explanation code.

Policy examples:

- organization must be `active` or `onboarding`
- membership must be `active`
- actor must belong to organization
- platform admin must provide reason for cross-tenant access
- target membership cannot remove last active owner
- verified email required before organization creation

## Tenant-Isolation Design

Tenant isolation uses two mandatory layers:

1. Application-level tenant scoping and authorization.
2. PostgreSQL Row-Level Security.

Tenant context establishment:

- Public auth endpoints do not use tenant context unless accepting an invitation.
- Authenticated organization endpoints require an explicit path `organizationId` or active organization header.
- Path `organizationId` takes precedence over active organization header.
- Application service receives tenant context explicitly.

Tenant context propagation through API requests:

- API guard authenticates user.
- tenant resolver validates requested organization.
- authorization service checks membership, policies, and conditions.
- Prisma transaction wrapper sets tenant context before tenant-scoped queries.

Tenant context propagation through jobs:

- every tenant-scoped job payload must include `organizationId`
- job producers validate authorization before enqueueing
- workers set database tenant context inside transaction before processing
- jobs without tenant context are rejected unless explicitly global/system scoped

Prisma strategy:

- all tenant-scoped data access goes through repository helpers that require tenant context
- repository helpers run tenant-scoped work inside a transaction
- transaction begins with `SET LOCAL app.current_organization_id = '<uuid>'`
- platform-admin path uses a distinct helper requiring reason, permission, and audit event

PostgreSQL setting:

```sql
SET LOCAL app.current_organization_id = '<organization-uuid>';
```

RLS policy pattern:

```sql
organization_id = current_setting('app.current_organization_id', true)::uuid
```

Accidental unrestricted query prevention:

- application services cannot receive raw Prisma client for tenant-scoped operations
- lint or architecture tests should block direct Prisma imports outside persistence adapters
- integration tests must prove missing tenant context fails
- RLS must be enabled and forced on tenant-scoped tables where practical

Platform administrator access:

- dedicated administrative execution path
- requires `platform.tenant.access`
- requires reason/justification
- records correlation id
- emits immutable audit event
- does not silently disable RLS for ordinary requests

## Platform Administration

Cross-tenant administrative access is explicit, exceptional, and audited.

Required fields for privileged cross-tenant operation:

- platform administrator user id
- target organization id
- permission
- reason
- correlation id
- timestamp
- target resource
- action performed

Forbidden:

- implicit global bypass in normal services
- unreasoned cross-tenant data reads
- unaudited support access
- reusing organizer endpoints with hidden tenant bypass

## Database Proposal

Candidate tables for Epic 002:

- `users`
- `authentication_identities`
- `password_credentials`
- `email_verifications`
- `password_reset_requests`
- `refresh_token_families`
- `refresh_token_sessions`
- `organizations`
- `memberships`
- `invitations`
- `roles`
- `permissions`
- `role_permissions`
- `membership_roles`
- `policies`
- `audit_logs`

Migration constraints:

- UUID primary keys
- timestamps
- tenant-scoped tables include `organization_id`
- RLS enabled on tenant-scoped tables
- no cascade deletes on audit-relevant records
- token values stored as hashes only
- unique normalized email
- unique organization slug
- unique membership per organization/user
- unique pending invitation per organization/email
- indexes for `organization_id`, `user_id`, `status`, `created_at`

No migration should be created until this proposal is approved.

## Transaction Boundaries

Identity transactions are defined in `EPIC-002-IDENTITY-AGGREGATE-IMPLEMENTATION-PLAN.md`.

Organization transactions:

- organization creation: create organization, owner membership, role assignment, domain event, and audit record atomically.
- invitation creation: create invitation and audit record atomically; email delivery is asynchronous.
- invitation acceptance: consume invitation, create or activate membership, assign role, emit event, and audit atomically.
- membership role change: update assignment, enforce last-owner invariant, emit event, and audit atomically.
- ownership transfer: assign new owner, preserve at least one owner throughout, emit event, and audit atomically.
- organization suspension/closure/archive: update status, enforce lifecycle rules, emit event, and audit atomically.

Permission evaluation must occur before mutating transactions begin, and the final mutation must still enforce database constraints.

## Data Lifecycle

Soft-deletable records:

- organizations before archival only through status transition and `deleted_at` where appropriate
- invitations may be expired or revoked, not physically deleted
- organization settings may be superseded by update history

Deactivation-only records:

- users
- memberships
- roles
- policies

Immutable or append-only records:

- audit logs
- security events
- password reset request history
- email verification history
- refresh-token session history after terminal state

Identity retention after account closure:

- retain user id, normalized email hash or redacted email, status, and audit references
- remove or redact optional profile fields where legally required
- retain immutable audit events with sensitive metadata redacted

Membership audit retention:

- memberships are not physically deleted
- removal uses `removed` status
- role changes are audited

Active session invalidation:

- user suspension, deactivation, password reset completion, and compromised-session handling revoke active sessions
- organization suspension does not revoke global user sessions but blocks tenant access

Personal-data deletion requests:

- redact non-essential personal fields where allowed
- preserve immutable audit records required for integrity and compliance
- store deletion request audit event
- never delete audit logs directly

## Error Taxonomy

Identity and authentication:

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

Organization and membership:

- `ORGANIZATION_SLUG_TAKEN`
- `ORG_NOT_FOUND`
- `ORG_NOT_ACTIVE`
- `ORG_STATE_INVALID`
- `ORG_HAS_BLOCKING_OPERATIONS`
- `MEMBERSHIP_ALREADY_EXISTS`
- `MEMBERSHIP_NOT_FOUND`
- `MEMBERSHIP_NOT_ACTIVE`
- `LAST_OWNER_INVALID`
- `TARGET_NOT_ACTIVE_MEMBER`
- `ROLE_INVALID`

Invitation:

- `INVITATION_ALREADY_PENDING`
- `INVITATION_NOT_FOUND`
- `INVITATION_NOT_PENDING`
- `INVITATION_EXPIRED`
- `INVITATION_REVOKED`
- `INVITATION_REPLAYED`

Authorization and tenant isolation:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `TENANT_SCOPE_REQUIRED`
- `TENANT_SCOPE_MISMATCH`
- `POLICY_DENIED`
- `PLATFORM_ADMIN_REASON_REQUIRED`

Shared:

- `VALIDATION_FAILED`
- `RATE_LIMITED`
- `CONFLICT`
- `INTERNAL_ERROR`

## API Contracts

All endpoints use `/api/v1`, JSON, validation, standard response envelope, documented domain error codes, and OpenAPI.

Representative V1 contracts:

| Endpoint                                                                 | Auth | Permission                    | Tenant resolution | Success                            | Errors                                                                                  | Idempotency       | Audit                               | Rate limit   |
| ------------------------------------------------------------------------ | ---- | ----------------------------- | ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ----------------- | ----------------------------------- | ------------ |
| `POST /auth/register`                                                    | no   | none                          | none              | user registered, verification sent | `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD`, `VALIDATION_FAILED`                            | email unique      | `identity.account_registered`       | per IP/email |
| `POST /auth/login`                                                       | no   | none                          | none              | access token, refresh cookie       | `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_LOCKED`, `USER_SUSPENDED`         | no                | login success/failure               | strict       |
| `POST /auth/logout`                                                      | yes  | session ownership             | none              | session revoked                    | `SESSION_NOT_FOUND`                                                                     | yes               | `auth.logout`                       | normal       |
| `POST /auth/refresh`                                                     | no   | refresh token                 | none              | new access token, refresh cookie   | `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`, `SESSION_REVOKED`                      | token rotation    | `auth.refresh_token_rotated/reused` | strict       |
| `POST /auth/password-reset/request`                                      | no   | none                          | none              | accepted                           | `RATE_LIMITED`, `VALIDATION_FAILED`                                                     | email/time window | `auth.password_reset_requested`     | strict       |
| `POST /auth/password-reset/confirm`                                      | no   | reset token                   | none              | password changed                   | `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED`, `WEAK_PASSWORD`                           | token single-use  | `auth.password_reset_completed`     | strict       |
| `POST /auth/email/verify`                                                | no   | verification token            | none              | email verified                     | `VERIFICATION_TOKEN_INVALID`, `VERIFICATION_TOKEN_EXPIRED`                              | token single-use  | `identity.email_verified`           | strict       |
| `POST /auth/email/resend`                                                | no   | none                          | none              | accepted                           | `RATE_LIMITED`, `EMAIL_ALREADY_VERIFIED`                                                | email/time window | `identity.email_verification_sent`  | strict       |
| `GET /me`                                                                | yes  | self                          | none              | current user                       | `UNAUTHENTICATED`                                                                       | no                | none                                | normal       |
| `GET /me/organizations`                                                  | yes  | self                          | memberships       | organization list                  | `UNAUTHENTICATED`                                                                       | no                | none                                | normal       |
| `POST /organizations`                                                    | yes  | `organization.create`         | new tenant        | organization created               | `EMAIL_NOT_VERIFIED`, `ORGANIZATION_SLUG_TAKEN`, `VALIDATION_FAILED`                    | slug unique       | `organization.created`              | normal       |
| `GET /organizations/{organizationId}`                                    | yes  | `organization.read`           | path              | organization                       | `ORG_NOT_FOUND`, `FORBIDDEN`, `TENANT_SCOPE_REQUIRED`                                   | no                | optional read audit                 | normal       |
| `PATCH /organizations/{organizationId}`                                  | yes  | `organization.update`         | path              | organization updated               | `ORG_NOT_ACTIVE`, `FORBIDDEN`, `VALIDATION_FAILED`                                      | no                | `organization.updated`              | normal       |
| `POST /organizations/{organizationId}/close`                             | yes  | `organization.close`          | path              | organization closed                | `ORG_HAS_BLOCKING_OPERATIONS`, `FORBIDDEN`                                              | yes               | `organization.closed`               | normal       |
| `POST /organizations/{organizationId}/archive`                           | yes  | `organization.archive`        | path              | organization archived              | `ORG_STATE_INVALID`, `FORBIDDEN`                                                        | yes               | `organization.archived`             | normal       |
| `POST /organizations/{organizationId}/owner-transfer`                    | yes  | `organization.owner.transfer` | path              | ownership transferred              | `TARGET_NOT_ACTIVE_MEMBER`, `LAST_OWNER_INVALID`, `FORBIDDEN`                           | no                | `organization.owner_transferred`    | strict       |
| `GET /organizations/{organizationId}/members`                            | yes  | `membership.read`             | path              | member list                        | `FORBIDDEN`, `TENANT_SCOPE_REQUIRED`                                                    | no                | optional read audit                 | normal       |
| `PATCH /organizations/{organizationId}/members/{membershipId}`           | yes  | `membership.update_role`      | path              | membership updated                 | `LAST_OWNER_INVALID`, `ROLE_INVALID`, `FORBIDDEN`                                       | no                | `organization.membership_role_set`  | normal       |
| `POST /organizations/{organizationId}/members/{membershipId}/suspend`    | yes  | `membership.suspend`          | path              | membership suspended               | `LAST_OWNER_INVALID`, `FORBIDDEN`                                                       | yes               | `organization.membership_suspended` | normal       |
| `DELETE /organizations/{organizationId}/members/{membershipId}`          | yes  | `membership.remove`           | path              | membership removed                 | `LAST_OWNER_INVALID`, `FORBIDDEN`                                                       | yes               | `organization.membership_removed`   | normal       |
| `POST /organizations/{organizationId}/invitations`                       | yes  | `invitation.create`           | path              | invitation created                 | `INVITATION_ALREADY_PENDING`, `MEMBERSHIP_ALREADY_EXISTS`, `FORBIDDEN`                  | email/org unique  | `organization.invitation_created`   | normal       |
| `GET /organizations/{organizationId}/invitations`                        | yes  | `invitation.read`             | path              | invitation list                    | `FORBIDDEN`                                                                             | no                | optional read audit                 | normal       |
| `POST /organizations/{organizationId}/invitations/{invitationId}/revoke` | yes  | `invitation.revoke`           | path              | invitation revoked                 | `INVITATION_NOT_PENDING`, `FORBIDDEN`                                                   | yes               | `organization.invitation_revoked`   | normal       |
| `POST /invitations/accept`                                               | yes  | invitation token              | token             | membership activated               | `INVITATION_EXPIRED`, `INVITATION_REVOKED`, `EMAIL_NOT_VERIFIED`, `INVITATION_REPLAYED` | token single-use  | `organization.invitation_accepted`  | strict       |
| `GET /organizations/{organizationId}/roles`                              | yes  | `membership.read`             | path              | role list                          | `FORBIDDEN`                                                                             | no                | none                                | normal       |
| `GET /organizations/{organizationId}/permissions`                        | yes  | `membership.read`             | path              | permission list                    | `FORBIDDEN`                                                                             | no                | none                                | normal       |

## Domain Events

Identity events:

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
- `UserRegistered`
- `UserEmailVerificationRequested`
- `UserEmailVerified`
- `UserLoginSucceeded`
- `UserLoginFailed`
- `UserLoggedOut`
- `RefreshTokenRotated`
- `RefreshTokenReuseDetected`
- `SessionRevoked`
- `PasswordChanged`
- `PasswordResetRequested`
- `PasswordResetCompleted`
- `UserSuspended`
- `UserDeactivated`

Organization events:

- `OrganizationCreated`
- `OrganizationActivated`
- `OrganizationUpdated`
- `OrganizationSuspended`
- `OrganizationClosed`
- `OrganizationArchived`
- `OrganizationOwnerTransferred`
- `MembershipInvited`
- `MembershipActivated`
- `MembershipCreated`
- `MembershipUpdated`
- `MembershipRoleChanged`
- `MembershipSuspended`
- `MembershipRemoved`
- `InvitationCreated`
- `InvitationAccepted`
- `InvitationRevoked`
- `InvitationExpired`
- `OwnershipTransferred`

Authorization events:

- `AuthorizationDenied`
- `PlatformAdminTenantAccessed`

## Audit Taxonomy

Canonical audit events:

| Event name                               | Actor             | Target             | Tenant scope        | Metadata                                 | Retention |
| ---------------------------------------- | ----------------- | ------------------ | ------------------- | ---------------------------------------- | --------- |
| `identity.account_registered`            | user/system       | user               | global              | normalized email hash, registration path | immutable |
| `auth.login_succeeded`                   | user              | session            | global              | session id, IP hash, user agent hash     | immutable |
| `auth.login_failed`                      | unknown/user      | user/email         | global              | email hash, reason, IP hash              | immutable |
| `auth.logout`                            | user              | session            | global              | session id                               | immutable |
| `auth.session_revoked`                   | user/admin/system | session            | global              | reason                                   | immutable |
| `auth.password_changed`                  | user              | user               | global              | session revocation count                 | immutable |
| `auth.password_reset_requested`          | unknown/user      | user/email         | global              | email hash, request id                   | immutable |
| `auth.password_reset_completed`          | user              | user               | global              | request id, sessions revoked             | immutable |
| `identity.email_verified`                | user              | email verification | global              | verification id                          | immutable |
| `organization.created`                   | user              | organization       | organization        | organization id, slug                    | immutable |
| `organization.updated`                   | user              | organization       | organization        | changed fields                           | immutable |
| `organization.suspended`                 | platform admin    | organization       | organization        | reason                                   | immutable |
| `organization.closed`                    | owner/admin       | organization       | organization        | reason                                   | immutable |
| `organization.archived`                  | owner/admin       | organization       | organization        | reason                                   | immutable |
| `organization.invitation_created`        | member/admin      | invitation         | organization        | invited email hash, role keys            | immutable |
| `organization.invitation_revoked`        | member/admin      | invitation         | organization        | reason                                   | immutable |
| `organization.invitation_accepted`       | invited user      | membership         | organization        | invitation id                            | immutable |
| `organization.membership_created`        | system/member     | membership         | organization        | source                                   | immutable |
| `organization.membership_role_changed`   | member/admin      | membership         | organization        | old roles, new roles                     | immutable |
| `organization.membership_suspended`      | member/admin      | membership         | organization        | reason                                   | immutable |
| `organization.membership_removed`        | member/admin      | membership         | organization        | reason                                   | immutable |
| `organization.owner_transferred`         | owner/admin       | organization       | organization        | previous owner id, new owner id          | immutable |
| `platform.cross_tenant_action_performed` | platform admin    | target resource    | organization/global | permission, reason, correlation id       | immutable |

Audit metadata rules:

- raw tokens are never stored
- passwords are never stored
- authorization headers are never stored
- IP addresses and user agents should be hashed or minimized
- audit logs are immutable and never physically deleted

## Security Controls

- rate limiting for login, refresh, password reset, and verification endpoints
- Argon2id password hashing
- token hashing for refresh, reset, and verification tokens
- refresh-token rotation
- refresh-token reuse detection
- account lockout and throttling
- constant-time token comparison where applicable
- server-side authorization before business logic
- RLS-backed tenant isolation
- structured audit logging
- input validation
- normalized email handling
- secret-free logs
- `HttpOnly` refresh-token cookie for browser clients
- no server-only secrets exposed to Next.js client bundles

## Test Matrix

Authentication tests:

- invalid credentials
- brute-force protection
- registration succeeds with valid input
- registration rejects duplicate email
- login succeeds with verified active user
- login rejects wrong password
- suspended user cannot login
- expired access token
- expired refresh token
- refresh-token replay
- revoked session
- logout revokes current session
- password reset token is single-use
- email verification token is single-use
- unverified email restrictions

Invitation and membership tests:

- invitation replay
- expired invitation
- revoked invitation
- duplicate invitation
- existing user accepts invitation
- new user accepts invitation after registration and verification
- duplicate membership rejected
- unauthorized role assignment
- last-owner removal prevention
- ownership transfer
- suspended membership cannot access tenant

Authorization tests:

- role grants expected permission
- missing permission denies action
- deny policy overrides allow policy
- inactive organization blocks protected actions
- inactive membership blocks tenant access
- platform-admin access without required authorization denied

Tenant-isolation tests:

- cross-organization reads blocked
- cross-organization writes blocked
- RLS blocks direct cross-tenant query
- application authorization blocks cross-tenant request before service execution
- missing tenant scope fails
- background-job tenant leakage is detected
- platform admin access requires explicit elevated context and audit reason

Audit tests:

- audit generated for every critical action
- login success creates audit event
- login failure creates security event
- session revocation creates audit event
- password reset creates audit events
- membership role change creates audit event
- platform admin cross-tenant access creates audit event
- audit payload redacts secrets

API tests:

- endpoints return standard response envelope
- validation errors use documented error format
- unauthorized requests return `401`
- forbidden requests return `403`
- conflict cases return `409`
- semantic validation failures return `422`
- rate-limited requests return `429`

## Implementation Sequence

After approval:

1. Update `DATABASE_SCHEMA.md` with approved Epic 002 tables.
2. Add ADR if any security/session decision changes from this plan.
3. Implement Identity Aggregate domain model.
4. Implement authentication application services.
5. Implement session and refresh-token lifecycle.
6. Implement email verification lifecycle.
7. Implement password reset lifecycle.
8. Implement Organization Aggregate domain model.
9. Implement membership lifecycle.
10. Implement invitation lifecycle.
11. Implement Permission Evaluation Service.
12. Implement tenant context propagation and RLS strategy.
13. Integrate immutable audit event generation.
14. Add API controllers and OpenAPI documentation.
15. Add unit tests.
16. Add integration tests.
17. Add security tests.
18. Add tenant-isolation tests.
19. Update documentation, release notes, and PR checklist.

## Migration Strategy

Migration planning rules:

- one migration for approved identity/organization foundation unless size requires a documented split
- include RLS enablement and policies
- include indexes and unique constraints
- avoid nullable fields unless lifecycle requires them
- store token hashes, not raw tokens
- no destructive changes
- rollback guidance required
- migration tests required

No migration will be generated until this planning document is approved.

## Acceptance Criteria

Epic 002 can be considered complete only when:

- users can register, verify email, login, refresh, and logout
- refresh-token rotation and reuse detection work
- organizations can be created and managed according to permissions
- invitations can be created, accepted, expired, and revoked
- membership lifecycle is implemented
- ownership transfer is implemented
- role/permission/policy/condition evaluation is enforced
- tenant context is propagated consistently
- PostgreSQL RLS is active on tenant-scoped tables
- platform admin cross-tenant access is explicit and audited
- all relevant API endpoints are documented
- security and tenant-isolation tests pass
- documentation and release notes are updated

## Remaining External Decisions

The following operational selections remain external but do not change the core design:

Non-blocking:

1. Email provider for verification and recovery delivery.
2. Platform Super Administrator bootstrap method for the first production environment.
3. Final production secret-management provider.
4. Legal retention period for identity audit logs by operating jurisdiction.

Blocking:

- none after the latest approved Identity, Organization, Permission Evaluation, event, and invariant decisions.
