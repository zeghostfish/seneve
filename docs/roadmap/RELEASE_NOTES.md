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

### Identity And Organizations

- Started Epic 002 local implementation under the approved Local Implementation Waiver.
- Created the `@seneve/domain-identity` package for Phase 1 domain-only Identity Aggregate work.
- Added Identity aggregate, identity value objects, credential/session/refresh-token models, one-time token models, stable domain error codes, and versioned identity domain-event contracts.
- Added unit tests for Identity registration, email verification, authentication gating, suspension session revocation, password-hash protection, password-policy validation, refresh-token reuse detection, and one-time verification token reuse/expiry.
- Added Phase 2 Identity persistence schema, migration, repository contracts, Prisma adapters, transaction boundaries, and PostgreSQL-gated integration tests.
- Added Phase 3 authentication application services, crypto abstractions, native Node Argon2id password hasher, token hashing, access-token issuing, and unit tests for registration, login, refresh, logout, revocation, and suspension flows.
- Added Phase 4 identity security and session management foundations, including trusted-device persistence, configurable security decisions, session listing/revocation services, device identification, and expanded security events.
- Added Phase 5 email-verification application services, ephemeral notification command boundary, token supersession, resend throttling, atomic completion, and lifecycle tests.
- Added Phase 6 password-reset application services, generic reset-request responses, ephemeral notification command boundary, Model B credential replacement, session and refresh-token revocation, and lifecycle tests.

### Known Limitations

- Repository has been initialized locally, but no official GitHub remote is configured.
- Official GitHub remote has not been provided or confirmed.
- GitHub Actions has not run remotely.
- Docker image build and Docker Compose startup validation have not run locally because Docker was unavailable.
- Epic 002 Phase 6 has no controllers, public API, cookies, OpenAPI authentication routes, browser fingerprinting, email-provider delivery, notification outbox, Redis-backed rate limiting, authenticated password change, organization persistence, tenant isolation, or generic audit persistence.
- PostgreSQL repository integration tests are present but skipped locally unless `RUN_POSTGRES_INTEGRATION=true` and `DATABASE_URL` point to a migrated PostgreSQL database.
