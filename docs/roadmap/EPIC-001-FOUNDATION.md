# Epic 001 - Foundation

## Status

Provisionally accepted, pending GitHub publication and remote CI validation.

Epic 001 remains open until all mandatory remote and Docker validation checks are complete.

## Objective

Establish the technical foundation for Seneve without implementing business functionality.

This Epic creates the repository, monorepo structure, local development environment, CI/CD baseline, application shells, shared tooling, health checks, documentation structure, and testing framework required for future Epics.

## Scope

Allowed:

- repository initialization
- monorepo structure
- Docker and Docker Compose
- GitHub Actions
- NestJS application shell
- Next.js application shell
- worker service shell
- Prisma setup
- PostgreSQL setup
- Redis setup
- BullMQ setup
- configuration management
- structured logging
- health checks
- OpenAPI shell
- linting
- formatting
- test framework
- documentation structure
- release notes structure

Not allowed:

- authentication business flows
- organization management
- campaign creation
- voting logic
- payment logic
- fraud logic
- workflow business rules
- reporting features
- administration features

## Architectural Principles

Epic 001 must preserve the approved architecture:

- Modular Monolith
- Domain-Driven Design
- Campaign-centric architecture
- domain package as the center of business concepts
- no infrastructure dependencies inside domain packages
- interface-independent business logic
- PostgreSQL Row-Level Security planned from the schema baseline
- event-driven internal architecture prepared, not fully implemented

## Deliverables

### Repository

- Initialize Git repository.
- Create default branch according to repository policy.
- Create feature branch: `feature/foundation`.
- Add `.gitignore`.
- Add root `README.md`.
- Add license if required by the project owner.
- Add `CHANGELOG.md` or release notes structure.

### Monorepo

Create the approved structure:

```text
apps/
  api/
  web/
  worker/

packages/
  domain/
    identity/
    organization/
    campaign/
    voting/
    verification/
    payment/
    fraud/
    workflow/
    reporting/
    notification/
    administration/
  shared/
  contracts/
  ui/
  config/
  testing/

database/
  prisma/
  migrations/
  seed/

docs/
infra/
tools/
```

### Package Management

- Configure workspace package manager.
- Define root scripts for build, lint, test, typecheck, format, and clean.
- Configure TypeScript project references or equivalent monorepo typing strategy.

### Backend Shell

- Create NestJS application shell in `apps/api`.
- Add health endpoint only.
- Add OpenAPI setup shell.
- Add global validation infrastructure without business DTOs.
- Add global error response format aligned with API documentation.
- Add structured logging baseline.
- Add configuration module integration.

### Frontend Shell

- Create Next.js application shell in `apps/web`.
- Configure TypeScript.
- Configure Tailwind CSS.
- Configure shadcn/ui baseline.
- Add a minimal non-business health/status page.
- Add accessibility and responsive defaults.

### Worker Shell

- Create worker service shell in `apps/worker`.
- Configure Redis connection.
- Configure BullMQ baseline.
- Add worker health check.
- Do not define business queues yet.

### Database

- Configure Prisma in `database/prisma`.
- Configure PostgreSQL connection.
- Add initial migration only if it contains no business functionality or is limited to technical metadata required for health checks.
- Prepare migration conventions.
- Document RLS policy approach.
- Do not create full business schema in Epic 001 unless approved as a separate database foundation task.

### Redis / Queue

- Add Redis service to Docker Compose.
- Verify API and worker can connect to Redis.
- Do not create business queue processors.

### Docker

- Add Dockerfiles for API, web, and worker.
- Add Docker Compose for local development:
  - API
  - web
  - worker
  - PostgreSQL
  - Redis
- Add health checks where practical.

### Configuration

- Add typed environment configuration package in `packages/config`.
- Add `.env.example`.
- Validate required environment variables at startup.
- Never commit secrets.

### Logging and Observability

- Add structured JSON logging baseline.
- Add request correlation ID support.
- Add health check endpoints.
- Prepare OpenTelemetry integration points.
- Do not add business metrics yet.

### Testing

- Configure Vitest.
- Configure Supertest for API integration tests.
- Configure Playwright for future E2E tests.
- Add foundation smoke tests:
  - API health check
  - web app renders
  - worker bootstraps
  - configuration validation
  - database connection if enabled
  - Redis connection if enabled

### Linting and Formatting

- Configure ESLint.
- Configure Prettier.
- Add formatting check.
- Add typecheck.
- Ensure CI runs all checks.

### CI/CD

Add GitHub Actions workflows:

- install dependencies
- lint
- format check
- typecheck
- unit tests
- integration tests
- build
- Docker build validation

Deployment should not be automated to production in Epic 001 unless the target environment is explicitly defined.

### Documentation

- Keep all current docs under `docs/`.
- Add setup guide.
- Add development workflow guide.
- Add architecture overview links.
- Add database migration guide.
- Add testing guide.
- Add release notes placeholder.

## Implemented Repository Tree

The current tracked repository tree is:

```text
.editorconfig
.env.example
.github/workflows/ci.yml
.gitignore
.prettierignore
.prettierrc.json
AGENTS.md
ARCHITECTURE_DECISIONS.md
PROMPTS.md
README.md
apps/api/
apps/web/
apps/worker/
database/migrations/
database/prisma/schema.prisma
database/seed/
docker-compose.yml
docs/
eslint.config.mjs
infra/docker/
package.json
packages/config/
packages/contracts/
packages/domain/
packages/shared/
packages/testing/
packages/ui/
pnpm-lock.yaml
pnpm-workspace.yaml
tools/
tsconfig.base.json
vitest.config.ts
```

## Runtime and Package Manager

- Node.js: `v24.14.0` during local implementation.
- pnpm: `10.14.0`, pinned through the root `packageManager` field.
- Lockfile: `pnpm-lock.yaml` is committed.
- CI uses Corepack with frozen lockfile installation.

## Application Ports

- API: `3000`
- Web: `3001`
- Worker health: `3002`
- PostgreSQL: `5432`
- Redis: `6379`

## Environment Variables

Required foundation variables:

- `DATABASE_URL`
- `REDIS_URL`

Optional or defaulted foundation variables:

- `NODE_ENV`
- `LOG_LEVEL`
- `API_PORT`
- `WEB_PORT`
- `WORKER_HEALTH_PORT`
- `OTEL_SERVICE_NAME`

Auth-related placeholder variables in `.env.example`:

- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`

These are placeholders only. Real secrets must never be committed.

## Installation and Validation Commands

```bash
corepack pnpm install
corepack pnpm db:validate
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Startup Commands

```bash
cp .env.example .env
docker compose up postgres redis
corepack pnpm dev
```

Endpoints:

- API health: `http://localhost:3000/api/v1/health`
- API readiness: `http://localhost:3000/api/v1/ready`
- OpenAPI: `http://localhost:3000/api/docs`
- Web: `http://localhost:3001`
- Worker health: `http://localhost:3002`

## Local Validation Completed

The following local checks passed:

- Prisma schema validation
- formatting check
- linting
- TypeScript type checking
- unit tests
- production build

Current test coverage is foundation-level only:

- configuration validation
- API health controller
- worker health server
- structured log entry helper

## Docker Validation Status

Docker was not installed or not available on PATH during local implementation.

The following checks remain mandatory before closing Epic 001:

```bash
docker compose config
docker compose build
docker compose up -d postgres redis
docker compose ps
```

Then validate:

```bash
corepack pnpm db:validate
corepack pnpm dev
```

Required runtime confirmations:

- API health endpoint returns success.
- API readiness endpoint checks PostgreSQL and Redis availability.
- Web application loads.
- Worker health endpoint responds.
- Logs are structured JSON.
- Correlation ID header is set by API request middleware.

## GitHub Publication Status

Local branches:

- `main`
- `feature/foundation`

Local commits:

- `732e32a chore(foundation): bootstrap repository documentation and workspace`
- `78a1504 test(foundation): add workspace quality baseline`
- `9dd5e39 feat(foundation): initialize api web and worker shells`
- `8a716ae feat(foundation): add database redis docker and ci baseline`
- `b9b8232 feat(foundation): add observability and local development docs`

No official GitHub remote is configured yet.

Do not force-push if the remote already contains commits. Inspect and reconcile histories safely.

Required publication commands once the official remote is available:

```bash
git remote add origin <official-repository-url>
git remote -v
git push -u origin main
git push -u origin feature/foundation
```

## Pull Request Requirements

Open a Pull Request from `feature/foundation` into `main`.

Suggested title:

```text
feat(foundation): establish Seneve monorepo and infrastructure baseline
```

The PR must include:

- Epic objective
- implemented components
- repository structure
- local validation results
- Docker validation status
- Prisma schema status
- environment variables required
- local startup instructions
- known limitations
- checklist of remaining validation items

## Architectural Decisions Introduced

Epic 001 incorporated and documented:

- Campaign-centric architecture
- Campaign templates
- Financial Platform
- multi-layer tenant isolation
- rich authorization model
- expanded voting lifecycle
- interface-independent business logic
- reduced V1 scope

Implementation-level foundation decisions:

- pnpm workspace monorepo
- Node.js 24 runtime baseline
- NestJS API shell
- Next.js web shell
- BullMQ-ready worker shell
- Prisma schema shell without business entities
- structured JSON log entry helper
- API correlation ID middleware
- health/readiness split

## Implementation Sequence

1. Initialize Git repository and branch.
2. Create monorepo package structure.
3. Configure package manager and TypeScript.
4. Add documentation baseline.
5. Add backend shell.
6. Add frontend shell.
7. Add worker shell.
8. Add database and Redis local infrastructure.
9. Add configuration package.
10. Add logging and health checks.
11. Add linting and formatting.
12. Add testing framework and smoke tests.
13. Add Docker Compose and service Dockerfiles.
14. Add GitHub Actions.
15. Run local checks.
16. Update documentation and release notes.
17. Commit with Conventional Commits.
18. Push branch to GitHub.
19. Open or update Pull Request.

## Impacted Modules

No business modules are implemented.

Foundation touches:

- repository root
- `apps/api`
- `apps/web`
- `apps/worker`
- `packages/config`
- `packages/shared`
- `packages/testing`
- `database`
- `infra`
- `tools`
- `docs`

Domain package directories may be created as placeholders only.

## Architectural Impacts

- Establishes monorepo boundaries.
- Establishes domain-first project layout.
- Establishes application shells for future module integration.
- Establishes quality gates.
- Establishes local development environment.
- Prepares for tenant isolation and RLS without prematurely modeling all business data.

## Required Tests

Minimum tests for Epic 001:

- API health endpoint returns success.
- API returns standardized error shape for unknown routes or validation smoke case.
- Web application renders root/status page.
- Worker process starts with configuration.
- Configuration validation rejects missing required variables.
- Database connection check succeeds in local/CI.
- Redis connection check succeeds in local/CI.

## Acceptance Criteria

Epic 001 is complete when:

- monorepo structure matches approved architecture
- API, web, and worker can run locally
- PostgreSQL and Redis run through Docker Compose
- Prisma is configured
- linting passes
- formatting check passes
- typecheck passes
- tests pass
- CI workflow passes
- documentation is updated
- release notes are updated
- branch is committed and pushed
- Pull Request is ready for review

## Known Limitations

- No business functionality will exist after Epic 001.
- No full business database schema will be implemented unless separately approved.
- No production deployment target is defined yet.
- Payment provider selection remains unresolved.
- Full authorization policy matrix remains to be specified in a later Epic.

## Risks

- Over-scaffolding may introduce unused complexity. Keep foundation minimal but extensible.
- Creating business schema too early may lock incorrect assumptions. Defer detailed business migrations until the relevant Epic.
- CI may require GitHub repository secrets or runner configuration not available during local planning.
- RLS must be designed carefully before tenant-scoped business tables are introduced.

## Required Documentation Updates During Epic

- `docs/README.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/engineering/DEVELOPMENT_WORKFLOW.md`
- `docs/engineering/TESTING.md`
- `docs/database/DATABASE_SCHEMA.md`
- `docs/roadmap/EPIC-001-FOUNDATION.md`
- release notes

## Completion Report Format

At Epic completion, report:

- technical summary
- implemented foundation components
- architectural decisions taken
- modified files
- database changes
- API changes
- test results
- documentation changes
- known limitations
- recommended next Epic
