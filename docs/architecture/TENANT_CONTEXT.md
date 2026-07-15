# Tenant Context

## Status

Implemented in Epic 002 Phase 10.

This document defines the canonical tenant execution context for Seneve. PostgreSQL Row-Level Security is intentionally deferred to Phase 11 and must consume this context instead of defining a separate tenant model.

## Purpose

Tenant Context answers:

- who is executing;
- which organization tenant is targeted;
- which membership and role are active;
- which permissions are available as hints for application services;
- where the execution originated;
- which correlation and request identifiers tie the operation together.

No transport, repository or worker may invent independent tenant semantics.

## Components

Implemented package:

- `@seneve/tenant-context`

Implemented components:

- `TenantContext`
- `TenantScope`
- `TenantResolver`
- `TenantContextProvider`
- `TenantExecutionContext`
- `AsyncLocalStorageTenantContextProvider`

## Canonical Context

Minimum fields:

- `tenantId`: current organization tenant, or `null` when execution is not tenant-scoped
- `identityId`: current identity, or `null` for anonymous/system execution
- `membershipId`: active organization membership, or `null`
- `role`: organization role, platform role, or `null`
- `permissions`: resolved permission hints
- `correlationId`: required stable correlation identifier
- `requestId`: request identifier where applicable
- `executionSource`: source environment
- `executionMode`: isolation mode
- `scope`: explicit scope metadata
- `auditMetadata`: optional structured audit-support metadata

## Execution Sources

Supported sources:

- `HTTP_REQUEST`
- `WORKER_JOB`
- `CLI_COMMAND`
- `SCHEDULED_TASK`
- `INTERNAL_WORKFLOW`
- `WEBHOOK`
- `API_TOKEN`

Future transports must resolve into this model before calling application services.

## Execution Modes

### Anonymous

No identity and no tenant. Allowed only for explicitly public or pre-authentication operations.

### Authenticated

Identity is known, but no organization tenant has been selected. Organization-scoped actions must deny this mode.

### Tenant

Identity, tenant, membership and role are known. This is the normal organization-scoped execution mode.

### Platform Administration

Privileged platform identity with system scope. It does not implicitly bypass tenant resolution for tenant data.

### Cross-Tenant

Exceptional privileged execution against a target tenant. It requires:

- platform administrator identity;
- explicit target tenant;
- explicit reason;
- correlation identifier;
- audit metadata where applicable.

### System

Internal execution for CLI, scheduled tasks, worker-maintenance jobs or internal workflows. It must not be used as an implicit replacement for tenant-scoped business operations.

## Propagation

The default provider uses Node `AsyncLocalStorage`.

`TenantExecutionContext.run(context, work)` establishes context for:

- application services;
- nested service calls;
- repositories;
- Unit of Work boundaries;
- transaction callbacks;
- worker handlers;
- internal domain workflows.

Consumers call `current()` or `requireCurrent()` instead of passing primitive tenant arguments through every method.

## Repository and Unit-of-Work Boundary

Repositories may read the active context through the execution context once they become tenant-aware.

Phase 10 does not enforce database isolation. It prepares the propagation path that Phase 11 will use for:

- transaction-scoped tenant settings;
- RLS policy activation;
- tenant-aware repository safeguards;
- integration tests that detect missing tenant scope.

## Authorization Integration

The Permission Evaluation Service now consumes the canonical `TenantContext`.

Authorization decisions still require explicit organization, membership and resource inputs where the caller has already loaded those records. Tenant Context supplies the execution scope; it does not replace current membership or organization state queries.

## RLS Boundary

Phase 10 explicitly does not implement:

- HTTP tenant middleware;
- HTTP tenant headers;
- controller integration.

Epic 002 Phase 11 implements PostgreSQL RLS through a dedicated transaction boundary that consumes this context.

## Testing Requirements

The Tenant Context test suite covers:

- HTTP anonymous and tenant context creation;
- worker context propagation;
- nested service and unit-of-work propagation;
- cross-tenant platform administrator requirements;
- system execution;
- missing correlation rejection.

Phase 11 must add PostgreSQL-backed tests for tenant isolation and RLS enforcement.
