# Release Notes

## Unreleased

### Documentation

- Added architecture documentation for Campaign-centric Modular Monolith.
- Added ADRs for campaign templates, business rules, financial platform, tenant isolation, authorization, voting lifecycle, API strategy, and V1 scope.
- Added initial database schema reference.
- Added Epic 001 Foundation implementation plan.
- Added local development documentation.

### Foundation

- Initialized Git repository and `feature/foundation` branch locally.
- Added pnpm monorepo workspace structure.
- Added NestJS API shell with health/readiness endpoints and OpenAPI bootstrap.
- Added Next.js web shell.
- Added BullMQ-ready worker shell with health endpoint.
- Added Prisma schema shell without business models.
- Added PostgreSQL and Redis local Docker Compose services.
- Added Dockerfiles for API, web, and worker.
- Added GitHub Actions CI workflow.
- Added structured logging and correlation ID foundations.

### Known Limitations

- Repository has been initialized locally, but no official GitHub remote is configured.
- Official GitHub remote has not been provided or confirmed.
- No business functionality has been implemented.
