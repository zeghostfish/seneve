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

