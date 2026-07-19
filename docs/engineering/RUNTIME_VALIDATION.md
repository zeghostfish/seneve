# Runtime Validation

Runtime validation proves that the locally implemented Seneve foundation works with real runtime
services, not only static checks and focused unit tests.

## Current Status

Runtime validation is pending.

The current sandbox has preserved the local implementation and can run static validation and focused
tests, but it has not provided the required PostgreSQL, Redis, Git metadata write access, production
build validation, or browser/runtime startup evidence.

## Required Environment

Use an environment with:

- writable Git metadata;
- PostgreSQL compatible with the project Prisma migrations;
- Redis compatible with the API rate-limiting boundary;
- local port binding for API and web startup;
- the project package manager and Node runtime;
- no production secrets committed to the repository.

## Required Commands

Run the project-equivalent commands for:

```bash
corepack pnpm db:generate
corepack pnpm db:validate
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

PostgreSQL-gated tests must run with PostgreSQL enabled and must not silently skip. Redis-dependent
tests must run with Redis enabled and must not silently skip.

## Smoke Tests

At minimum, validate:

- API health;
- registration;
- login;
- refresh;
- organization creation;
- Campaign creation;
- Candidate creation;
- Campaign listing;
- Candidate listing;
- logout;
- landing page;
- authenticated shell;
- organization onboarding;
- Campaign management pages;
- Candidate management pages.

## Evidence To Record

Record:

- service versions;
- command outputs and totals;
- skipped test count;
- production build warnings;
- runtime smoke-test notes;
- browser console issues, if any;
- remaining blockers.
