# Testing Strategy

## Principles

Every feature requires automated tests.

Testing must cover:

- business rules
- authorization
- tenant isolation
- validation
- idempotency
- failure cases
- audit behavior

## Test Types

Unit tests:

- domain rules
- value objects
- policy evaluation
- pure services

Integration tests:

- API endpoints
- database persistence
- RLS behavior
- queue processing
- provider adapter boundaries

End-to-end tests:

- critical user workflows
- voting flows
- paid vote confirmation
- administration review flows

Regression tests:

- duplicate vote prevention
- payment webhook replay
- cross-tenant access denial
- immutable record correction behavior

## Epic 001 Testing

Epic 001 requires foundation smoke tests only:

- API health check
- web app render
- worker boot
- configuration validation
- PostgreSQL connection
- Redis connection
- CI quality gate

No business workflow tests are expected until business modules exist.

## PostgreSQL Integration Tests

PostgreSQL-backed tests are gated locally unless a migrated database is available.

Required local execution:

```bash
docker compose up -d postgres redis
# Apply database/migrations in lexical order with the deployment migration runner.
RUN_POSTGRES_INTEGRATION=true corepack pnpm test
```

The PostgreSQL suite currently covers:

- Identity persistence;
- Organization persistence;
- PostgreSQL Row-Level Security tenant isolation.
- Audit persistence and audit RLS.

Phase 11 validation target:

- no PostgreSQL tests skipped in CI;
- RLS policies active;
- transaction-local tenant settings applied;
- pooled connection leakage tested;
- unfiltered, nested, aggregate and bulk organization queries isolated by the database.

If PostgreSQL is unavailable locally, tests may remain skipped only in local development. CI must provide PostgreSQL and execute them.
