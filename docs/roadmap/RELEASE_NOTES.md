# Release Notes

## Unreleased

### Documentation

- Added architecture documentation for Campaign-centric Modular Monolith.
- Added ADRs for campaign templates, business rules, financial platform, tenant isolation, authorization, voting lifecycle, API strategy, and V1 scope.
- Added initial database schema reference.
- Added Epic 001 Foundation implementation plan.
- Added local development documentation.
- Updated Epic 001 status with provisional acceptance, final local validation, Docker validation gap, GitHub publication status, runtime versions, ports, environment variables, startup commands, and PR requirements.
- Added Epic 002 Identity and Organizations planning document.
- Refined Epic 002 planning with explicit authentication, authorization, tenant-isolation, audit, data-lifecycle, API, and security-test decisions.
- Added Epic 002 design-review report.
- Added Epic 001 Pull Request description draft.
- Formalized Identity as the aggregate root for authentication.
- Formalized Organization aggregate boundaries for future subscription, billing, and API key support.
- Added Permission Evaluation Service as the centralized authorization decision point.
- Added Identity Aggregate implementation plan.
- Added explicit identity, organization, and permission invariants.
- Added Epic 002 error taxonomy, transaction boundaries, rollback considerations, and readiness report.

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
- GitHub Actions has not run remotely.
- Docker image build and Docker Compose startup validation have not run locally because Docker was unavailable.
- No business functionality has been implemented.
