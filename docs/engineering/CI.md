# Continuous Integration

Remote CI is required before Epic 002 and Epic 003 foundations can be treated as production-ready.

## Current Status

CI status is pending.

The repository currently has no confirmed official GitHub remote in this local implementation
environment.

## Required CI Jobs

CI must run:

- dependency installation;
- Prisma generation;
- Prisma schema validation;
- format check;
- lint;
- type checking;
- unit tests;
- PostgreSQL integration tests;
- Redis integration tests;
- production build.

PostgreSQL and Redis suites must not silently skip when service containers are available.

## Remote Publication

When an official remote is provided:

1. verify the remote URL;
2. push the `feature/identity-organizations` branch without rewriting accepted history;
3. open or prepare a pull request;
4. confirm CI execution;
5. document any skipped checks.

Do not create an arbitrary public repository without explicit authorization.
