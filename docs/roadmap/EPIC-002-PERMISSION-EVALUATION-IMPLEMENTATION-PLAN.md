# Epic 002 - Permission Evaluation Implementation Plan

## Status

Phase 8 implementation complete under the approved Local Implementation Waiver.

Phase 8 is application/domain-boundary only. It introduces no Prisma models, migrations, repositories, tenant RLS, controllers, middleware, API DTOs, or persistence-backed authorization tables.

## Package

Implemented package:

- `@seneve/authorization-application`

The package is stateless and does not import Identity or Organization aggregates. Callers provide authorization snapshots:

- actor
- tenant context
- organization status
- membership assignment
- target resource context

## Evaluation Flow

Implemented evaluation flow:

```text
Actor
-> Tenant Context
-> Membership
-> Role
-> Permissions
-> Policies
-> Conditions
-> Decision
```

Controllers and route handlers must consume the Permission Evaluation Service instead of implementing permission logic directly.

## Concepts

Role:

- assignment such as `OWNER`, `ADMINISTRATOR`, or `FINANCE_MANAGER`.

Permission:

- immutable capability identifier such as `organization:update`.

Policy:

- declarative business rule such as `organization.mutable` or `ownership.owner_required`.

Condition:

- reusable runtime check such as `IsOrganizationActive`, `IsMembershipActive`, or `IsSameTenant`.

Decision:

- structured authorization result with `allowed`, `reasonCode`, `permission`, `policy`, `evaluatedConditions`, and assigned role when applicable.

## Permission Catalogue

Implemented stable permission identifiers:

- `organization:create`
- `organization:read`
- `organization:update`
- `organization:suspend`
- `organization:close`
- `organization:archive`
- `membership:read`
- `membership:create`
- `membership:update`
- `membership:suspend`
- `membership:remove`
- `invitation:read`
- `invitation:create`
- `invitation:revoke`
- `ownership:transfer`
- `event:create`
- `campaign:create`
- `candidate:create`
- `billing:view`
- `billing:update`
- `system:admin`

Permission identifiers are immutable.

## Role Mapping

Implemented organization role assignments:

- `OWNER`
- `ADMINISTRATOR`
- `EVENT_MANAGER`
- `FINANCE_MANAGER`
- `CONTENT_MANAGER`
- `VIEWER`
- `AUDITOR`

Implemented platform role:

- `PLATFORM_SUPER_ADMINISTRATOR`

Platform administrative access is represented as an explicit exceptional override path and returns `platform.administrator.override` as the evaluated policy.

## Policies

Implemented policies:

- `permission.catalogue`
- `platform.administrator.override`
- `global.permission`
- `organization.create.verified_actor`
- `tenant.scope`
- `role.permission`
- `explicit.deny.precedence`
- `organization.readable`
- `organization.mutable`
- `organization.archivable`
- `organization.suspend.platform_only`
- `ownership.owner_required`
- `membership.active_organization`
- `invitation.active_organization`
- `business_operations.active_organization`
- `billing.active_organization`

Explicit deny is evaluated before role permission and permission-specific policy success.

## Conditions

Implemented condition names:

- `PermissionExists`
- `IsActorActive`
- `IsActorEmailVerified`
- `TenantRequired`
- `IsSameTenant`
- `IsPlatformAdministrator`
- `HasAssignedRole`
- `RoleGrantsPermission`
- `IsMembershipActive`
- `IsOrganizationActive`
- `IsOrganizationReadable`
- `IsOrganizationMutable`
- `IsOrganizationArchivable`
- `IsOrganizationOwner`
- `IsSelfOperation`
- `IsInvitationPending`
- `ExplicitDenyAbsent`

## Decision Reasons

Implemented decision reason codes:

- `ALLOWED`
- `PERMISSION_DENIED`
- `POLICY_VIOLATION`
- `ROLE_NOT_ASSIGNED`
- `TENANT_REQUIRED`
- `INVALID_MEMBERSHIP`
- `ORGANIZATION_INACTIVE`
- `OWNERSHIP_REQUIRED`
- `EXPLICIT_DENY`
- `CROSS_TENANT_DENIED`

Stable authorization error codes are also defined for application callers that need to convert denied decisions into exceptions:

- `PERMISSION_DENIED`
- `POLICY_VIOLATION`
- `ROLE_NOT_ASSIGNED`
- `TENANT_REQUIRED`
- `INVALID_MEMBERSHIP`
- `ORGANIZATION_INACTIVE`
- `OWNERSHIP_REQUIRED`

## Implemented Rules

- verified active identities may create organizations.
- organization-scoped actions require tenant context.
- cross-tenant requests are denied.
- active membership is required for organization-scoped role permissions.
- role must grant the requested permission.
- suspended and archived organizations deny operational actions according to policy.
- archived organizations are not readable through normal organization-scope evaluation.
- only explicit platform administrator path may suspend organizations.
- ownership transfer requires owner role and active target membership.
- last-owner membership removal, suspension and downgrade are explicitly denied.
- invitation revocation requires a pending invitation.
- self-service membership read can be allowed for the actor's own membership without granting broad membership-read authority.
- platform administrators use a dedicated override path; this is not inferred from organization roles.

## Testing

Tests cover:

- every permission has one positive and one negative evaluation.
- role evaluation.
- permission resolution.
- policy evaluation.
- condition evaluation.
- ownership protection.
- self-service membership reads.
- cross-tenant denial.
- suspended organization denial.
- archived organization denial.
- administrator override.
- explicit deny precedence.

## Known Limitations

- no persistence-backed custom roles.
- no persistence-backed policy registry.
- no tenant request context propagation.
- no PostgreSQL RLS integration.
- no audit persistence.
- no HTTP middleware or guards.
- no UI authorization helpers.
