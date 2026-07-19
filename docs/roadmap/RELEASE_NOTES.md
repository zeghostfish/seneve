# Release Notes

## Unreleased

### Phase 19 - Runtime Stabilization and Repository Recovery

- Created the Brand through Phase 18 preservation archive for local work pending Git metadata write
  recovery.
- Verified the current branch and latest accepted commit before any repository recovery work.
- Reran static validation and focused non-runtime tests in the restricted environment.
- Added runtime validation, PostgreSQL RLS validation, Redis validation, CI and security-review
  documentation.
- Added a categorized file inventory to support selective staging after repository transfer.
- Git commits, PostgreSQL validation, Redis validation, full test suite, production build, GitHub
  publication and remote CI remain pending until a suitable environment is available.

### Epic 003 Phase 18 - Campaign and Candidate Frontend Management

- Added private authenticated Campaign management screens for listing, filtering, creation,
  overview, settings, lifecycle actions and Phase 16 rule editing.
- Added private Candidate management screens for listing, creation, editing, lifecycle actions and
  accessible move-up/move-down reordering.
- Added centralized Campaign and Candidate frontend API clients.
- Added Campaign and Candidate status presentation helpers.
- Added focused frontend tests for API clients, validation, permissions and status presentation.
- Public voting, vote totals, rankings, payments, fraud controls and public results remain deferred.

### Epic 003 Phase 17 - Candidate Domain and Management Foundation

- Added the `@seneve/domain-candidate` package with the canonical Candidate aggregate, lifecycle
  transitions, stable domain errors and domain events.
- Added Candidate Prisma schema and migration with campaign-scoped unique slugs, campaign-scoped
  positions, indexes, foreign keys and RLS policies.
- Added `@seneve/candidate-persistence` with explicit Prisma mapping and tenant-aware transaction
  integration.
- Added `@seneve/candidate-application` use cases for creation, listing, retrieval, updates,
  status transitions, archival and full-list reordering.
- Added Candidate permissions to the central authorization catalogue.
- Added Candidate audit event names and Candidate domain-event to audit mapping.
- Added authenticated organization- and campaign-scoped Candidate HTTP endpoints.
- Added focused Candidate domain, application and controller tests.
- Voting, Payment, Fraud, SMS, rankings, public candidate pages, public results and public voting
  endpoints remain deferred.

### Epic 003 Phase 16 - Campaign Domain and Application Foundation

- Added the `@seneve/domain-campaign` package with the canonical Campaign aggregate, schedule,
  preliminary rules, result-visibility configuration, lifecycle transitions, stable domain errors
  and domain events.
- Added Campaign Prisma schema and migration with organization-scoped unique slugs, lifecycle
  fields, preliminary voting-rule configuration, indexes and RLS policies.
- Added `@seneve/campaign-persistence` with explicit Prisma mapping and tenant-aware transaction
  integration.
- Added `@seneve/campaign-application` use cases for creation, listing, retrieval, updates,
  scheduling, lifecycle transitions and rule updates.
- Added Campaign permissions to the central authorization catalogue.
- Added Campaign audit event names and Campaign domain-event to audit mapping.
- Added authenticated organization-scoped Campaign HTTP endpoints.
- Added focused Campaign domain, application and controller tests.
- Voting, Payment, Fraud, SMS, public results and public voting endpoints remain deferred.

### Epic 002 Phase 15 - Frontend Authentication and Organization Integration

- Added the first authenticated Next.js frontend shell for Seneve.
- Added centralized web API clients for Authentication, Session and Organization APIs.
- Added in-memory access-token handling with backend-managed `HttpOnly` refresh-cookie assumptions.
- Added registration, login, email-verification and password-reset frontend flows.
- Added protected application shell, responsive navigation and organization switcher.
- Added organization onboarding, organization listing, organization overview, member management,
  invitation management, invitation acceptance, ownership-transfer and session-management screens.
- Added lightweight permission-aware UI helpers while keeping backend authorization authoritative.
- Added frontend validation helpers and focused tests for validation, API error handling and
  permission identifiers.
- PostgreSQL, Redis and full browser runtime validation remain pending in the current sandbox.

### Official Brand Asset Integration

- Added the official Seneve source logo assets under `apps/web/public/brand/master`.
- Added optimized web logo assets, standalone mark, favicon, PWA icons and Apple touch icon derived
  from the supplied source files without recoloring or geometry changes.
- Added centralized web brand constants and CSS brand tokens using extracted logo colors:
  `#b20000` and `#363636`.
- Added reusable `SeneveLogo` component with `transparent`, `whiteBackground` and `mark` variants.
- Integrated Seneve branding into the web shell header, auth layout placeholder, loading state,
  metadata and web manifest.
- Added structural tests for logo rendering, variant selection, header usage, metadata and manifest
  icon paths.
- Added brand asset guidelines and initial design-system documentation.

### Epic 002 Phase 14 - Organization HTTP API

- Added the transport-independent Organization application service package.
- Added the NestJS Organization HTTP module with organization, membership, invitation and
  ownership-transfer routes.
- Added DTO validation, response mapping, public error mapping and OpenAPI-discoverable controller
  metadata for Organization APIs.
- Integrated Organization HTTP workflows with the Permission Evaluation Service, Tenant Context
  Engine, tenant-aware transaction boundary, RLS-ready repositories and mandatory audit event
  recording.
- Added invitation token transport rules that keep raw invitation tokens out of HTTP responses,
  logs, persistence and audit records.
- Added Supertest coverage for organization creation, permission denial mapping, invitation token
  redaction, last-owner protection mapping and invitation acceptance routing.
- PostgreSQL, Redis, RLS and audit-backed Organization HTTP runtime validation remains pending until
  a complete runtime environment is available.

### Epic 002 Phase 13 - HTTP Authentication API

- Added the NestJS authentication HTTP module with registration, login, refresh, logout,
  email-verification, password-reset and session-management routes.
- Added secure refresh-cookie transport and short-lived access-token response mapping.
- Added DTO validation, CSRF origin checks, credentialed CORS configuration, Helmet headers and
  `Cache-Control: no-store` for authentication responses.
- Added access-token verification with live session and identity validation.
- Added Redis-backed authentication rate-limiter boundary with an in-memory test fallback.
- Added Supertest coverage for token redaction, cookie issuance, refresh transport, password-reset
  anti-enumeration response, session ownership checks and CSRF origin rejection.
- Added Authentication API and HTTP security documentation.
- PostgreSQL, Redis and RLS-backed HTTP integration validation remains pending until a complete
  runtime environment is available.

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
- Added Phase 7 organization aggregate domain foundation, including lifecycle governance, membership and invitation models, ownership-transfer invariants, stable organization errors, domain events, and unit tests.
- Added Phase 8 permission evaluation service, immutable permission catalogue, role-to-permission mapping, declarative policy checks, structured authorization decisions, explicit deny precedence, platform administrator override, and authorization tests.
- Added Phase 9 organization persistence schema, migration, repository contracts, Prisma adapters, unit-of-work transactions, PostgreSQL partial indexes, and gated integration tests for organization, membership and invitation persistence.
- Added Phase 10 tenant context engine, canonical execution context, tenant resolver, AsyncLocalStorage propagation, cross-tenant execution safeguards, authorization integration, and tenant-context architecture documentation.
- Added Phase 11 PostgreSQL Row-Level Security migration, transaction-local tenant settings, tenant-aware Prisma transaction boundary, RLS unit tests, PostgreSQL-gated tenant-isolation tests, and RLS security documentation.
- Added Phase 12 generic audit persistence, immutable audit record model, event catalogue, per-stream hash chaining, metadata sanitization, audit append service, Prisma persistence adapter, integration adapters for Identity and Organization events, and PostgreSQL-gated audit tests.

### Known Limitations

- Repository has been initialized locally, but no official GitHub remote is configured.
- Official GitHub remote has not been provided or confirmed.
- GitHub Actions has not run remotely.
- Docker image build and Docker Compose startup validation have not run locally because Docker was unavailable.
- Epic 002 Phase 15 has no Campaign, Voting, billing, custom-role UI, production email delivery,
  authenticated password change, frontend Playwright suite, audit HTTP endpoints, audit UI, export
  files, retention deletion jobs, SIEM integration or external log shipping.
- PostgreSQL repository integration tests are present but skipped locally unless `RUN_POSTGRES_INTEGRATION=true` and `DATABASE_URL` point to a migrated PostgreSQL database.
