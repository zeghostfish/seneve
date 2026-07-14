# ADR-024: Multi-Layer Tenant Isolation

## Status

Accepted

## Context

Seneve is multi-tenant from the first release. Organization data isolation is mandatory.

## Decision

Tenant isolation must use two independent layers:

1. Application authorization.
2. PostgreSQL Row-Level Security.

Both layers are mandatory. Neither layer is sufficient alone.

## Consequences

- Business tables must include `organization_id` unless explicitly documented as global/system data.
- Application services must apply tenant authorization before business logic.
- Database access must set tenant context for RLS-protected queries.
- Tests must verify cross-tenant access denial at both application and database levels.
- Migrations must account for RLS policies as part of schema design.
