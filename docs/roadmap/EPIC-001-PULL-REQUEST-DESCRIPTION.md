# Pull Request Draft - Epic 001 Foundation

## Title

```text
feat(foundation): establish Seneve monorepo and infrastructure baseline
```

## Objective

Establish the technical foundation for Seneve without implementing business functionality.

Epic 001 creates the repository structure, application shells, local infrastructure definitions, quality tooling, CI workflow, configuration baseline, health checks, documentation structure, and release notes required for future Epics.

## Implemented Components

- Git repository initialized locally with `main` and `feature/foundation`
- pnpm workspace monorepo
- NestJS API shell
- Next.js web shell
- BullMQ-ready worker shell
- shared packages for config, contracts, shared utilities, UI, and testing
- domain package directory structure
- Prisma schema shell without business models
- PostgreSQL and Redis Docker Compose services
- Dockerfiles for API, web, and worker
- GitHub Actions CI workflow
- structured logging helper
- API correlation ID middleware
- health and readiness endpoints
- OpenAPI bootstrap
- local development documentation
- release notes

## Repository Structure

```text
apps/
  api/
  web/
  worker/
packages/
  config/
  contracts/
  domain/
  shared/
  testing/
  ui/
database/
  prisma/
  migrations/
  seed/
docs/
infra/
tools/
```

## Local Validation Results

Passed locally:

- `corepack pnpm db:validate`
- `corepack pnpm format:check`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`

Test result:

- 4 test files
- 5 tests passed

## Docker Validation Status

Not completed locally because Docker was unavailable in the implementation environment.

Required before final Epic 001 closure:

```bash
docker compose config
docker compose build
docker compose up -d postgres redis
docker compose ps
```

Runtime validation required:

- API health endpoint returns success
- API readiness endpoint verifies PostgreSQL and Redis
- web application loads
- worker health endpoint responds
- structured logs are emitted
- correlation ID header is set by API middleware

## Prisma and Migrations

- Prisma generator and PostgreSQL datasource are configured.
- No business models were added.
- No migrations were created.
- Business schema work is deferred until approved domain documentation exists.

## Environment Variables

Required:

- `DATABASE_URL`
- `REDIS_URL`

Optional/defaulted:

- `NODE_ENV`
- `LOG_LEVEL`
- `API_PORT`
- `WEB_PORT`
- `WORKER_HEALTH_PORT`
- `OTEL_SERVICE_NAME`

Placeholders:

- `JWT_ACCESS_TOKEN_SECRET`
- `JWT_REFRESH_TOKEN_SECRET`

No real secrets are committed.

## Local Startup

```bash
corepack pnpm install
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

## Known Limitations

- Official GitHub remote is not yet configured.
- Remote GitHub Actions has not yet run.
- Docker validation has not yet run locally.
- No business functionality is implemented.
- RLS strategy is documented but no business tables exist yet.

## Remaining Validation Checklist

- [ ] Push `main`
- [ ] Push `feature/foundation`
- [ ] Open Pull Request
- [ ] Run GitHub Actions CI
- [ ] Validate Docker image builds
- [ ] Validate Docker Compose runtime
- [ ] Verify PostgreSQL readiness
- [ ] Verify Redis readiness
- [ ] Verify API `/ready` with dependencies running
- [ ] Update PR description with remote CI and Docker results
