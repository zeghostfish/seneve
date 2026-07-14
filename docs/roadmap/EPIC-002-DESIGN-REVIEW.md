# Epic 002 Design Review

## 1. Documentation Reviewed

- `AGENTS.md`
- `ARCHITECTURE_DECISIONS.md`
- `docs/adr/ADR-000-020-BASELINE.md`
- `docs/adr/ADR-024-MULTI-LAYER-TENANT-ISOLATION.md`
- `docs/adr/ADR-025-RICH-AUTHORIZATION-MODEL.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/database/DATABASE_SCHEMA.md`
- `docs/roadmap/EPIC-001-FOUNDATION.md`
- `docs/roadmap/EPIC-002-IDENTITY-ORGANIZATIONS-PLAN.md`

## 2. Decisions Confirmed

- Epic 002 remains planning-only until explicit approval.
- V1 authentication uses email/password, email verification, JWT access tokens, and rotating opaque refresh tokens.
- The Identity aggregate root is `Identity`, not `User`.
- Authentication is not coupled directly to the `User` entity.
- User accounts are global and do not belong directly to one organization.
- Organization access is modeled through memberships.
- Authorization follows `Role -> Permission -> Policy -> Condition`.
- Permission checks are centralized through a dedicated Permission Evaluation Service.
- Tenant isolation requires both application-level scoping and PostgreSQL Row-Level Security.
- Platform administration is exceptional, explicit, reasoned, and audited.
- Audit logs are immutable and must redact secrets.
- No Campaign, Voting, Payment, Fraud, Workflow, Billing, or Reporting implementation belongs in Epic 002.

## 3. Contradictions Found

The first Epic 002 planning draft left some required decisions unresolved:

- password hashing algorithm
- access-token and refresh-token lifetimes
- refresh-token storage strategy
- organization `closed` lifecycle state
- richer V1 role matrix required by the latest review
- API endpoint contract details
- data lifecycle and personal-data deletion interaction with audit retention

These were resolved in the updated plan.

No contradiction was found with the Modular Monolith, DDD, domain-boundary, tenant-isolation, or API-first requirements after the plan update.

## 4. Missing Decisions

Resolved in the updated plan:

- Argon2id password hashing parameters.
- 15-minute access token lifetime.
- 30-day refresh token absolute lifetime.
- 7-day refresh token idle timeout.
- `HttpOnly`, `Secure`, `SameSite=Lax` refresh-token cookie strategy for browser clients.
- Refresh-token family reuse detection behavior.
- Account lockout and endpoint rate-limit thresholds.
- Organization state model including `closed`.
- Invitation expiration, revocation, duplicate handling, existing-user acceptance, and new-user acceptance.
- Ownership transfer and last-owner protection.
- Canonical audit taxonomy.
- Tenant context propagation for API requests and background jobs.

Still external:

- email provider selection
- first Platform Super Administrator bootstrap procedure
- production secret-management provider
- jurisdiction-specific audit retention period

## 5. Proposed Resolutions

The planning document now proposes:

- Argon2id as the password hashing algorithm.
- JWT access tokens with 15-minute lifetime.
- opaque rotating refresh tokens stored in secure HTTP-only cookies for browser clients.
- token hashes only in persistence.
- email verification required before organization creation or invitation acceptance.
- organization lifecycle: `draft -> onboarding -> active -> suspended -> closed -> archived`.
- explicit owner transfer in Epic 002.
- RLS enforced through transaction-scoped tenant context.
- platform admin access through a dedicated administrative execution path.

## 6. Final Domain Entities

Identity:

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

Organization:

- `Organization`
- `OrganizationSettings`
- `OrganizationBranding`
- `Subscription`
- `BillingProfile`
- `Membership`
- `Invitation`
- `RoleAssignment`
- `APIKey`

Authorization:

- `Role`
- `Permission`
- `Policy`
- `Condition`
- `AuthorizationDecision`
- `PermissionEvaluationService`

## 7. Final State Machines

User:

```text
registered -> email_verification_pending -> active -> suspended -> deactivated -> archived
```

Organization:

```text
draft -> onboarding -> active -> suspended -> closed -> archived
```

Membership:

```text
invited -> active -> suspended -> removed
```

Invitation:

```text
pending -> accepted -> expired -> revoked
```

Refresh token session:

```text
active -> rotated -> revoked -> reused -> expired
```

## 8. Final Role and Permission Matrix

V1 roles:

- Platform Super Administrator
- Organization Owner
- Organization Administrator
- Event Manager
- Finance Manager
- Content Manager
- Viewer
- Auditor

The final permission matrix is defined in `EPIC-002-IDENTITY-ORGANIZATIONS-PLAN.md`.

Critical permissions include:

- `platform.tenant.access`
- `organization.create`
- `organization.read`
- `organization.update`
- `organization.suspend`
- `organization.close`
- `organization.archive`
- `organization.owner.transfer`
- `membership.read`
- `membership.invite`
- `membership.update_role`
- `membership.suspend`
- `membership.remove`
- `invitation.create`
- `invitation.read`
- `invitation.revoke`
- `audit.read`
- `auth.session.revoke`

## 9. Final Tenant-Isolation Strategy

Tenant isolation uses two mandatory layers:

1. Application authorization and explicit tenant context.
2. PostgreSQL Row-Level Security.

API requests:

- authenticate user
- resolve tenant from path or active organization context
- authorize membership/policy/conditions
- run tenant-scoped persistence inside transaction with `SET LOCAL app.current_organization_id`

Background jobs:

- tenant-scoped jobs must include `organizationId`
- workers set tenant context before database access
- missing tenant context fails unless job is explicitly global/system scoped

Platform admin:

- dedicated elevated execution path
- permission required
- reason required
- correlation id required
- immutable audit event required

## 10. Final API Surface

The proposed API surface includes:

- authentication endpoints
- current-user endpoints
- organization endpoints
- membership endpoints
- invitation endpoints
- role and permission metadata endpoints

Each proposed endpoint now identifies:

- authentication requirement
- permission requirement
- tenant-resolution method
- success response
- domain error codes
- idempotency requirement
- audit event
- rate-limit policy

## 11. Final Audit Taxonomy

Canonical audit categories:

- identity registration and verification
- authentication success/failure
- session rotation/revocation/reuse detection
- password reset and password change
- organization lifecycle
- invitation lifecycle
- membership lifecycle
- ownership transfer
- privileged cross-tenant platform administration

Audit records are immutable, redacted, and retained according to compliance policy.

## 12. Final Implementation Sequence

After approval:

1. Update `DATABASE_SCHEMA.md` for approved Epic 002 tables.
2. Add ADR only if a security/session decision changes from the plan.
3. Define domain types and state machines.
4. Create Prisma migration with RLS policies.
5. Implement password and token hashing utilities.
6. Implement identity application services.
7. Implement authentication endpoints.
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

## 13. Go / No-Go Recommendation

Recommendation: No-Go for implementation until this design-review report and the updated Epic 002 plan are explicitly approved.

Reason:

- The design is now internally consistent with the official documentation.
- Required security, authorization, tenant-isolation, audit, and API decisions are documented.
- External operational decisions remain, but they do not block design approval if defaults or adapters are accepted later.
- Implementation must still wait for explicit approval and for Epic 001 GitHub publication/remote CI path to be resolved.
