# SENEVE Architecture

## Product Architecture

Seneve is a production-grade, multi-tenant Campaign Operating Platform for digital voting.

The platform is not an event management platform with voting attached. The `Campaign` aggregate is the central business entity.

Seneve must support configurable campaigns for competitions, awards, internal elections, public consultations, and future participation workflows without requiring campaign-specific code.

## Architectural Style

Seneve uses a Modular Monolith architecture following Domain-Driven Design principles.

The architecture must preserve clear module boundaries so modules can be extracted into independent services later if justified by business or operational needs.

## Validated Technology Stack

Backend:

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Infrastructure:

- Docker
- Docker Compose
- GitHub Actions

Storage:

- S3-compatible object storage

Authentication:

- JWT access tokens
- Refresh tokens

Documentation:

- OpenAPI / Swagger

Testing:

- Vitest
- Supertest
- Playwright

Monitoring:

- OpenTelemetry
- Prometheus-compatible metrics
- Structured logging

## Monorepo Structure

The approved repository structure is:

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

The domain package contains only business concepts. Infrastructure concerns must remain outside of the domain.

## Module Boundaries

Business logic belongs inside domain modules and application services.

Transport, persistence, framework, queue, storage, and provider concerns are adapters.

Controllers and UI components must not contain business rules.

Recommended dependency direction:

```text
Interface Adapters
  -> Application Services
    -> Domain Modules
      -> Domain Events

Infrastructure Adapters
  -> Application Service Ports
```

Domain modules must not depend on NestJS, Prisma, Redis, BullMQ, HTTP, or payment provider SDKs.

## Campaign Aggregate

The `Campaign` aggregate owns or coordinates:

- configuration
- workflow
- voting rules
- candidates
- verification methods
- payment configuration
- fraud protection
- communications
- reports
- analytics
- settlement

Campaigns may be instantiated from `CampaignTemplate` records whenever possible.

## Campaign Templates

`CampaignTemplate` is a reusable business asset.

Templates may configure:

- categories
- voting rules
- payment packages
- workflow
- notifications
- dashboards
- reports
- branding defaults

Templates must be versioned before published campaign behavior depends on them.

## Business Rules Engine

Seneve must not rely on hardcoded vote rules.

The Business Rules Engine is a strategic component that supports:

- conditions
- operators
- actions
- priorities
- rule composition
- future extensions

The Voting Engine consumes rules. It does not define them.

Example rule shape:

```text
WHEN Campaign.Status == ACTIVE
AND User.Verified == TRUE
AND Payment.Amount >= 500
THEN Votes = 5
```

Rules must be stored, versioned, auditable, and testable.

## Voting Lifecycle

The official voting lifecycle is:

```text
Vote Session
  -> Vote Attempt
  -> Verification
  -> Payment
  -> Fraud Analysis
  -> Vote Confirmation
  -> Ledger Update
  -> Settlement
  -> Audit
```

Each lifecycle stage emits or records an auditable business event.

Paid votes must not be confirmed before definitive payment success.

Confirmed votes are immutable.

## Financial Platform

The Financial Platform includes:

- Payments
- Ledger
- Commission Engine
- Billing
- Refund Engine
- Settlement Engine
- Invoicing
- Accounting Reports

The Voting Engine must never calculate financial information directly.

Financial corrections create compensating entries.

Ledger entries are immutable.

## Internal Event Bus

Seneve is event-driven internally.

Important business actions publish domain events, including:

- `CampaignCreated`
- `CampaignPublished`
- `VotingOpened`
- `VotingClosed`
- `VoteConfirmed`
- `PaymentSucceeded`
- `RefundCompleted`
- `FraudDetected`
- `SettlementGenerated`
- `PayoutCompleted`

Modules communicate through application services or domain events.

Direct dependencies must be minimized and justified.

Events must be idempotent for consumers that can be retried.

## Multi-Tenant Security

Tenant isolation is mandatory and uses two layers:

1. Application authorization.
2. PostgreSQL Row-Level Security.

Both layers must be enabled.

Business tables must include `organization_id` unless explicitly documented as global system tables.

Tests must prove that cross-tenant access is blocked.

## Authorization Model

Authorization uses:

```text
Role
  -> Permission
    -> Policy
      -> Condition
```

Roles alone are insufficient.

Policies and conditions must be explicit, testable, and enforced server-side before business logic.

## API Strategy

REST is the initial delivery mechanism.

Business logic must remain independent of REST because future interfaces may include:

- GraphQL
- SDKs
- Public API
- Mobile applications
- Embedded widgets

All interfaces consume the same application services.

## Version 1 Scope

Version 1 includes:

- Authentication
- Organizations
- Team Management
- Events
- Campaigns
- Categories
- Candidates
- Free Voting
- Paid Voting
- Mobile Money integration
- Card payment integration
- Reporting
- Audit
- Administration

Deferred to later milestones:

- SMS voting
- Public API
- White Label
- Marketplace
- Advanced Workflow Templates
- AI Fraud Analysis
- Native mobile applications

## Epic 001 Constraint

Epic 001 must establish the project foundation only.

It must not implement business functionality.

Allowed deliverables include repository initialization, monorepo structure, Docker, CI/CD, NestJS, Next.js, worker service, Prisma, PostgreSQL, Redis, logging, configuration, health checks, documentation structure, linting, formatting, testing framework, and GitHub workflows.

