# Continuous Integration

Remote CI is required before Epic 002 and Epic 003 foundations can be treated as production-ready.

## Current Status

CI status is pending.

The repository currently has no confirmed official GitHub remote in this local implementation
environment.

Phase 19D Git recovery is complete. Phase 19E preparation is complete through:

- `.github/workflows/ci.yml`;
- `docker-compose.yml`;
- `scripts/run-phase19e.sh`;
- `docs/engineering/PHASE-19E-EXECUTION.md`.

The workflow has not yet executed remotely. Phase 19 remains open until CI runs against PostgreSQL
and Redis and reports a successful result.

## Required CI Jobs

CI must run:

- dependency installation;
- Prisma generation;
- Prisma schema validation;
- migration deployment;
- migration status verification;
- format check;
- lint;
- type checking;
- unit tests;
- PostgreSQL integration tests;
- Redis integration tests;
- production build.

PostgreSQL and Redis suites must not silently skip when service containers are available.

## Prepared Workflow

The prepared workflow is:

```text
.github/workflows/ci.yml
```

It uses:

- Node.js `24`, compatible with the repository requirement of `>=22.0.0`;
- Corepack-managed pnpm;
- PostgreSQL `17-alpine`;
- Redis `7-alpine`;
- `RUN_POSTGRES_INTEGRATION=true`;
- GitHub Actions secrets for JWT token secrets.

Required repository secrets:

```text
JWT_ACCESS_TOKEN_SECRET
JWT_REFRESH_TOKEN_SECRET
```

The workflow must fail if any mandatory validation fails. Do not add `continue-on-error: true` to
required validation jobs.

## Remote Publication

When an official remote is provided:

1. verify the remote URL;
2. push the `feature/identity-organizations` branch without rewriting accepted history;
3. open or prepare a pull request;
4. confirm CI execution;
5. document any skipped checks.

Do not create an arbitrary public repository without explicit authorization.
