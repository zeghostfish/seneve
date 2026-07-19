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
- Authentication HTTP behavior with Supertest and application-service test doubles.
- Organization HTTP behavior with Supertest and application-service test doubles.
- Audit persistence and audit RLS.

Phase 11 validation target:

- no PostgreSQL tests skipped in CI;
- RLS policies active;
- transaction-local tenant settings applied;
- pooled connection leakage tested;
- unfiltered, nested, aggregate and bulk organization queries isolated by the database.

If PostgreSQL is unavailable locally, tests may remain skipped only in local development. CI must provide PostgreSQL and execute them.

## Organization HTTP Tests

Phase 14 HTTP tests cover:

- organization creation request/response mapping;
- permission-denial public error mapping;
- invitation creation without raw token exposure;
- last-owner protection mapped to conflict;
- invitation acceptance routing through token id and raw token input.

Runtime integration remains pending for PostgreSQL RLS, Redis-backed rate limiting, mandatory audit
rollback and real repository execution.

## Frontend Tests

Phase 15 frontend tests focus on deterministic unit and structural behavior that does not require a
browser runtime:

- official brand asset path validation;
- logo component variant rendering;
- metadata and manifest asset references;
- frontend form validation helpers;
- public API error model preservation;
- frontend permission-catalog identifiers.

Full browser and runtime integration remains pending until the environment permits local port
binding and the API can run with PostgreSQL, Redis, RLS and audit persistence enabled.

Future browser tests should cover:

- registration and login;
- email verification;
- password reset;
- refresh failure and recovery;
- protected-route redirect;
- organization onboarding;
- organization switching;
- session revocation;
- invitation acceptance.

## Campaign Tests

Phase 16 adds focused Campaign tests for:

- domain aggregate creation and lifecycle transitions;
- invalid name, slug, schedule and result-visibility configuration;
- archived-campaign immutability;
- active-campaign foundational rule restrictions;
- application-service authorization and audit-event recording;
- Campaign HTTP response mapping and permission-denial mapping.

PostgreSQL-backed Campaign repository and RLS tests remain required once a migrated PostgreSQL
runtime is available. They must cover organization-scoped slug uniqueness, cross-tenant reads and
writes, lifecycle persistence, pagination/filtering and tenant setting leakage.

## Candidate Tests

Phase 17 adds focused Candidate tests for:

- domain aggregate creation and lifecycle transitions;
- invalid display names, slugs and positions;
- archived-candidate immutability;
- required reasons for suspension, withdrawal and disqualification;
- application-service authorization, candidate limits, campaign-state restrictions and reorder validation;
- Candidate HTTP response mapping and permission-denial mapping.

PostgreSQL-backed Candidate repository and RLS tests remain required once a migrated PostgreSQL
runtime is available. They must cover organization isolation, campaign scoping, campaign-scoped slug
uniqueness, atomic reorder behavior, foreign keys and RLS policy enforcement.

## Campaign And Candidate Frontend Tests

Phase 18 adds focused frontend tests for:

- Campaign and Candidate API client route construction;
- Campaign and Candidate field validation;
- Campaign and Candidate status presentation;
- frontend permission catalogue coverage.

These tests do not require a browser runtime. Full browser integration remains deferred until the
environment permits local server port binding.
