# Epic 002 - Identity and Organizations Planning

## Status

Planning only.

No migrations, application modules, or business implementation may be created until this plan is reviewed and approved.

## Objective

Define the Identity, Authentication, Authorization, Organizations, Membership, Invitation, and Tenant Isolation design for Seneve.

Epic 002 establishes who can access the platform, how sessions work, how users belong to organizations, and how tenant isolation is enforced before Campaign functionality begins.

## Scope

Included:

- user identity model
- authentication model
- access-token and refresh-token lifecycle
- refresh-token rotation and reuse detection
- password hashing
- account recovery
- email verification
- organization lifecycle
- membership lifecycle
- invitation lifecycle
- RBAC permission matrix
- policy and condition evaluation model
- tenant context propagation
- PostgreSQL Row-Level Security strategy
- platform administrator cross-tenant access model
- audit taxonomy for identity and organization operations
- soft deletion, suspension, and deactivation rules
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

## Domain Aggregates and Entities

### Identity Aggregate

Aggregate root: `User`

Entities and value objects:

- `User`
- `PasswordCredential`
- `EmailVerification`
- `PasswordResetRequest`
- `RefreshTokenSession`
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

Entities and value objects:

- `Organization`
- `OrganizationSettings`
- `OrganizationBranding`
- `Membership`
- `Invitation`
- `RoleAssignment`

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

Strategic model:

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

- `active` requires verified email unless a future auth method explicitly changes this.
- `suspended` users cannot authenticate.
- `deactivated` users cannot authenticate but historical records remain.
- `archived` users are retained for audit and compliance.

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
  -> active
  -> suspended
  -> archived
```

Rules:

- suspended organizations cannot create or publish future campaigns.
- archived organizations are read-only except for platform administrators.

### MembershipStatus

```text
invited
  -> active
  -> suspended
  -> removed
```

Rules:

- active membership is required for tenant-scoped access.
- removed membership does not delete audit history.

### InvitationStatus

```text
pending
  -> accepted
  -> expired
  -> revoked
```

Rules:

- invitation tokens are single-use.
- accepted invitations create or activate membership.
- revoked invitations cannot be accepted.

## Authentication and Session Model

Initial V1 authentication:

- email and password
- email verification
- JWT access tokens
- refresh tokens with rotation

Access token:

- short-lived
- signed JWT
- contains user id, active organization context where applicable, token version, issued-at, expiry
- does not contain permission lists as source of truth

Refresh token:

- long-lived but rotated
- opaque random token
- stored only as a hash
- linked to device/session metadata
- reuse detection revokes token family

Password hashing:

- use Argon2id if dependency and deployment compatibility are accepted
- otherwise bcrypt with documented cost factor
- passwords are never logged
- password hashes are never exposed

Account recovery:

- password reset request creates a single-use, expiring token
- reset completion invalidates active refresh-token sessions unless policy explicitly allows otherwise
- all recovery actions are audited

## Role and Permission Matrix

Initial system roles:

| Role                       | Scope        | Description                               |
| -------------------------- | ------------ | ----------------------------------------- |
| Platform Administrator     | global       | Seneve operator with supervised access    |
| Organization Owner         | organization | Tenant owner with full organization admin |
| Organization Administrator | organization | Manages settings, team, and future assets |
| Campaign Manager           | organization | Future campaign operations role           |
| Analyst                    | organization | Future read/reporting role                |
| Support                    | organization | Limited support and review role           |
| Member                     | organization | Basic authenticated member                |

Initial permissions:

| Permission              | Owner | Org Admin | Campaign Manager | Analyst | Support | Member |
| ----------------------- | ----- | --------- | ---------------- | ------- | ------- | ------ |
| `organization.read`     | yes   | yes       | yes              | yes     | yes     | yes    |
| `organization.update`   | yes   | yes       | no               | no      | no      | no     |
| `organization.archive`  | yes   | no        | no               | no      | no      | no     |
| `membership.read`       | yes   | yes       | no               | no      | yes     | no     |
| `membership.invite`     | yes   | yes       | no               | no      | no      | no     |
| `membership.updateRole` | yes   | yes       | no               | no      | no      | no     |
| `membership.remove`     | yes   | yes       | no               | no      | no      | no     |
| `audit.read`            | yes   | yes       | no               | yes     | yes     | no     |

Platform Administrator permissions are global and must be constrained by policy, reason capture, and audit.

Future campaign permissions are named but not implemented in Epic 002 unless explicitly approved:

- `campaign.create`
- `campaign.update`
- `campaign.publish`
- `campaign.close`
- `campaign.read`

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

- organization must be active
- membership must be active
- actor must belong to organization
- platform admin must provide reason for cross-tenant access
- target membership cannot remove last owner

## Tenant-Isolation Design

Tenant isolation uses two layers:

1. Application authorization.
2. PostgreSQL Row-Level Security.

Tenant context propagation:

- API authenticates request.
- Tenant resolver determines active `organization_id`.
- Application service receives tenant context explicitly.
- Database connection sets tenant context for RLS-protected queries.

Proposed PostgreSQL setting:

```sql
SET LOCAL app.current_organization_id = '<organization-uuid>';
```

RLS policy pattern:

```sql
organization_id = current_setting('app.current_organization_id')::uuid
```

Platform admin access:

- must use explicit elevated context
- must require permission
- must require reason capture
- must create audit event
- must not silently disable RLS for ordinary requests

## Database Proposal

Candidate tables for Epic 002:

- `users`
- `password_credentials`
- `email_verifications`
- `password_reset_requests`
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

No migration should be created until this proposal is approved.

## API Endpoint Proposal

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
- `POST /api/v1/organizations/{organizationId}/archive`

Memberships:

- `GET /api/v1/organizations/{organizationId}/members`
- `PATCH /api/v1/organizations/{organizationId}/members/{membershipId}`
- `DELETE /api/v1/organizations/{organizationId}/members/{membershipId}`

Invitations:

- `POST /api/v1/organizations/{organizationId}/invitations`
- `GET /api/v1/organizations/{organizationId}/invitations`
- `POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/revoke`
- `POST /api/v1/invitations/accept`

Authorization metadata:

- `GET /api/v1/organizations/{organizationId}/roles`
- `GET /api/v1/organizations/{organizationId}/permissions`

## Domain Events

Identity events:

- `UserRegistered`
- `UserEmailVerificationRequested`
- `UserEmailVerified`
- `UserLoginSucceeded`
- `UserLoginFailed`
- `UserLoggedOut`
- `RefreshTokenRotated`
- `RefreshTokenReuseDetected`
- `PasswordResetRequested`
- `PasswordResetCompleted`
- `UserSuspended`
- `UserDeactivated`

Organization events:

- `OrganizationCreated`
- `OrganizationUpdated`
- `OrganizationSuspended`
- `OrganizationArchived`
- `MembershipInvited`
- `MembershipActivated`
- `MembershipRoleChanged`
- `MembershipSuspended`
- `MembershipRemoved`
- `InvitationAccepted`
- `InvitationRevoked`

Authorization events:

- `AuthorizationDenied`
- `PlatformAdminTenantAccessed`

## Audit Events

Mandatory audit events:

- registration
- login success
- login failure
- logout
- refresh token rotation
- refresh token reuse detection
- password reset request
- password reset completion
- email verification request
- email verification completion
- organization creation
- organization update
- organization suspension
- organization archival
- invitation creation
- invitation acceptance
- invitation revocation
- membership role change
- membership suspension
- membership removal
- authorization denial for sensitive actions
- platform admin cross-tenant access

Audit payloads must redact:

- passwords
- raw tokens
- authorization headers
- reset tokens
- verification tokens
- refresh tokens

## Security Controls

- rate limiting for login, refresh, password reset, and verification endpoints
- password hashing with approved algorithm
- token hashing for refresh, reset, and verification tokens
- refresh-token rotation
- refresh-token reuse detection
- account lockout or throttling policy
- constant-time token comparison where applicable
- server-side authorization before business logic
- RLS-backed tenant isolation
- structured audit logging
- input validation
- normalized email handling
- secret-free logs
- secure cookie strategy if refresh tokens are cookie-bound

## Test Matrix

Authentication tests:

- registration succeeds with valid input
- registration rejects duplicate email
- login succeeds with verified active user
- login rejects wrong password
- suspended user cannot login
- access token expires according to configuration
- refresh rotates token
- reused refresh token revokes token family
- logout revokes session
- password reset token is single-use
- email verification token is single-use

Authorization tests:

- role grants expected permission
- missing permission denies action
- deny policy overrides allow policy
- inactive organization blocks protected actions
- inactive membership blocks tenant access
- last owner cannot be removed

Tenant-isolation tests:

- user in organization A cannot read organization B
- user in organization A cannot mutate organization B
- RLS blocks direct cross-tenant query
- application authorization blocks cross-tenant request before service execution
- platform admin access requires explicit elevated context and audit reason

Audit tests:

- login success creates audit event
- login failure creates security event
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

## Implementation Sequence

After approval:

1. Update `DATABASE_SCHEMA.md` with approved Epic 002 tables.
2. Add ADR if any security/session decision differs from existing architecture.
3. Define domain types and state machines.
4. Create Prisma migration with RLS policies.
5. Implement password and token hashing utilities.
6. Implement identity application services.
7. Implement auth API endpoints.
8. Implement organization and membership services.
9. Implement invitation lifecycle.
10. Implement authorization policy evaluator.
11. Implement tenant context propagation.
12. Add audit events.
13. Add unit tests.
14. Add integration tests.
15. Add tenant-isolation tests.
16. Update OpenAPI documentation.
17. Update release notes and PR checklist.

## Migration Strategy

Migration planning rules:

- one migration for approved identity/organization foundation
- include RLS enablement and policies
- include indexes and unique constraints
- avoid nullable fields unless lifecycle requires them
- store token hashes, not raw tokens
- no destructive changes
- rollback guidance required

No migration will be generated until this planning document is approved.

## Acceptance Criteria

Epic 002 can be considered complete only when:

- users can register, verify email, login, refresh, and logout
- refresh-token rotation and reuse detection work
- organizations can be created and managed according to permissions
- invitations can be created, accepted, expired, and revoked
- membership lifecycle is implemented
- role/permission/policy/condition evaluation is enforced
- tenant context is propagated consistently
- PostgreSQL RLS is active on tenant-scoped tables
- platform admin cross-tenant access is explicit and audited
- all relevant API endpoints are documented
- security and tenant-isolation tests pass
- documentation and release notes are updated

## Unresolved Decisions

These require approval before implementation:

1. Password hashing algorithm: Argon2id vs bcrypt.
2. Refresh-token transport: HTTP-only secure cookie vs response body for first V1.
3. Access token lifetime.
4. Refresh token absolute lifetime.
5. Refresh token idle timeout.
6. Account lockout or throttling thresholds.
7. Email provider for verification and recovery.
8. Whether email verification is mandatory before first organization creation.
9. Whether a user can create multiple organizations in V1.
10. Platform administrator bootstrap process.
11. Whether organization owner transfer is included in Epic 002.
12. Whether audit logs are in the Epic 002 migration or foundation audit is deferred.
13. Whether RLS bypass is permitted for background workers and under what controlled context.
