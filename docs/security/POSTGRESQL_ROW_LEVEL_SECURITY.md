# PostgreSQL Row-Level Security

## Status

Implemented in Epic 002 Phase 11. Runtime validation remains provisional until the PostgreSQL integration suite runs against a migrated database.

## Protected Tables

RLS is enabled and forced on:

- `organizations`
- `organization_memberships`
- `organization_invitations`
- `audit_records`

Identity authentication tables remain platform-scoped in this phase. They do not receive organization RLS until a concrete tenant-owned identity record exists.

Audit rows are protected by tenant stream or explicit platform context. Audit records remain append-only and cannot be updated or deleted through normal application paths.

## Policy Semantics

Organization rows use:

```sql
organizations.id = app.current_tenant_id()
```

Organization child rows use:

```sql
organization_scoped_table.organization_id = app.current_tenant_id()
```

Policies are default-deny:

- missing tenant setting returns no organization-scoped rows;
- anonymous execution returns no organization-scoped rows;
- authenticated execution without a controlled operation returns no organization-scoped rows;
- wrong tenant returns no rows or write denial;
- tenant execution sees only its tenant;
- cross-tenant execution is limited to the explicit target tenant;
- platform administration requires explicit privileged context.

Both `USING` and `WITH CHECK` policies are defined so reads, updates, deletes, inserts and tenant reassignment attempts are protected.

## Transaction-Local Settings

The application boundary sets these PostgreSQL variables transaction-locally:

- `app.tenant_id`
- `app.identity_id`
- `app.execution_mode`
- `app.correlation_id`
- `app.platform_admin`
- `app.cross_tenant`
- `app.privileged_reason`
- `app.operation`

Settings are applied through `set_config(..., true)` inside the Prisma transaction. Persistent connection-level tenant state is not used.

## Prisma Integration

`PrismaTenantRlsTransactionBoundary` is the centralized RLS boundary.

Responsibilities:

- read the canonical `TenantExecutionContext`;
- reject missing or invalid context;
- open a Prisma transaction;
- set transaction-local PostgreSQL variables;
- expose only the transaction-scoped Prisma client to repository work;
- clear database state automatically through transaction completion.

Repositories must not issue independent tenant-setting SQL.

## Organization HTTP Integration

Epic 002 Phase 14 routes organization-scoped mutations through Organization application services,
which establish Tenant Context before calling the tenant-aware Prisma transaction boundary.

The HTTP layer must not use migration or RLS-bypass database credentials. API tests that exercise
Organization routes must use the runtime application role once PostgreSQL integration is available.

`GET /organizations` is a controlled access-index query for organizations reachable by the
authenticated identity. After a concrete organization is selected, tenant-owned resources must be
read or mutated under tenant context and RLS.

## Bootstrap Flows

### Organization Creation

Organization creation uses controlled `ORGANIZATION_BOOTSTRAP` execution.

The application supplies the future organization ID to the transaction boundary. The boundary sets `app.tenant_id` to that future ID before inserting:

1. `organizations`;
2. initial owner `organization_memberships`.

RLS is not disabled for bootstrap creation.

### Invitation Acceptance

Invitation acceptance uses controlled `INVITATION_ACCEPTANCE` execution.

The application must derive the target organization from a verified invitation token flow before setting tenant context. The transaction then:

1. establishes the target tenant;
2. conditionally accepts the invitation;
3. creates the membership;
4. commits atomically.

Untrusted request data must not be allowed to select an arbitrary tenant.

## Platform Administration

Platform access is explicit and exceptional.

Policies require:

- `app.platform_admin = true`;
- privileged execution mode;
- correlation identifier;
- target tenant and reason for cross-tenant mode.

`CROSS_TENANT` mode is restricted to the explicit target tenant. `PLATFORM_ADMIN` mode is reserved for controlled platform operations and must be audited in the future Audit phase.

## Database Roles

Recommended deployment roles:

- `seneve_migration`: owns and alters schema objects;
- `seneve_application`: runtime role subject to RLS;
- `seneve_readonly_operations`: controlled read-only operational role.

The normal application role must not:

- own protected tables in production;
- have `BYPASSRLS`;
- run migrations;
- receive unrestricted schema privileges.

Role creation is environment-specific and is not fully encoded in the local schema migration. Deployment must provision roles before production rollout.

## FORCE ROW LEVEL SECURITY

`FORCE ROW LEVEL SECURITY` is enabled for protected tables to reduce accidental owner bypass.

Operational exception:

- migration and break-glass maintenance roles may still require elevated privileges, but those roles must not be used by the runtime application.

## Test Strategy

PostgreSQL-backed tests cover:

- missing context denial;
- correct-tenant reads and writes;
- wrong-tenant denial;
- unfiltered query isolation;
- nested relation isolation;
- aggregate/count isolation;
- bulk update isolation;
- pooled connection leakage;
- organization bootstrap;
- platform and cross-tenant administrative paths.

The Identity and Organization repository integration suites remain part of the full PostgreSQL validation target.

## Recovery

Emergency recovery in a non-production environment may disable RLS temporarily:

```sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations DISABLE ROW LEVEL SECURITY;
```

Production recovery must use documented operational access with approvals, correlation identifiers and post-incident audit reconstruction. Disabling RLS in production is a break-glass operation.
