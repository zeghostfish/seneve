# ADR-000 to ADR-020: Baseline Architecture Decisions

This document captures the baseline architecture decisions from the initial Seneve project documentation.

Detailed future changes must be recorded as separate ADRs.

## ADR-000: Project Philosophy

Status: Accepted

Seneve is a configurable Voting-as-a-Service platform, not a custom voting application.

Consequences:

- features must remain generic
- campaign-specific behavior must be configuration-driven
- long-term extensibility takes priority over shortcuts

## ADR-001: Modular Monolith Architecture

Status: Accepted

Seneve starts as a Modular Monolith.

Consequences:

- modules must remain independent
- boundaries must be clear
- future extraction into services must remain possible

## ADR-002: PostgreSQL as Primary Database

Status: Accepted

PostgreSQL is the primary relational database.

Consequences:

- migrations target PostgreSQL
- ACID transactions are required for critical workflows
- indexing, constraints, and RLS are part of schema design

## ADR-003: UUID Primary Keys

Status: Accepted

Business entities use UUID identifiers.

Consequences:

- public URLs must not expose sequential IDs
- generated IDs must not reveal data volume

## ADR-004: Domain-Driven Design

Status: Accepted

Business logic is organized around domain modules.

Baseline modules:

- Identity
- Organizations
- Campaigns
- Voting
- Payments
- Fraud
- Workflow
- Reporting
- Administration

## ADR-005: Internal Event-Driven Communication

Status: Accepted

Modules communicate through domain events whenever appropriate.

Examples:

- `VoteConfirmed`
- `PaymentCompleted`
- `CampaignPublished`
- `FraudDetected`
- `WorkflowExecuted`

## ADR-006: Configurable Business Rules Engine

Status: Accepted

Campaign behavior is driven by configurable business rules.

Updated by later clarification:

- the Business Rules Engine is a strategic platform component
- the Voting Engine consumes rules but does not define them
- rules support conditions, operators, actions, priorities, and composition

## ADR-007: Workflow Engine

Status: Accepted

Campaign processes are orchestrated through a Workflow Engine.

Consequences:

- workflows are configurable
- workflows are event-triggered
- workflow actions must be idempotent and audited
- workflow logic must not duplicate domain business rules

## ADR-008: Immutable Financial Ledger

Status: Accepted

Financial records are immutable.

Consequences:

- corrections create compensating entries
- history is never rewritten
- ledger integrity remains auditable

## ADR-009: Immutable Votes

Status: Accepted

Confirmed votes cannot be deleted or modified.

Consequences:

- election integrity requires permanent traceability
- corrections generate new business events or compensating records

## ADR-010: Audit by Default

Status: Accepted

Critical business actions automatically generate audit records.

Examples:

- authentication
- vote confirmation
- payment confirmation
- campaign publication
- fraud review
- administration

## ADR-011: API-First Application Services

Status: Accepted

Every feature is implemented through internal services exposed initially by REST APIs.

Updated by later clarification:

- business logic is independent of REST
- future interfaces consume the same application services

## ADR-012: Multi-Tenant by Design

Status: Accepted

The platform is multi-tenant from the first release.

Updated by later clarification:

- tenant isolation requires both application authorization and PostgreSQL Row-Level Security

## ADR-013: GitHub as Source of Truth

Status: Accepted

GitHub is the authoritative repository.

Consequences:

- completed milestones must be committed, documented, and pushed immediately
- long-running local-only development is prohibited

## ADR-014: Documentation-Driven Development

Status: Accepted

Documentation is updated before or together with implementation.

Consequences:

- documentation guides AI-assisted development
- behavior changes require documentation updates

## ADR-015: Security by Default

Status: Accepted

Security controls are enabled by default.

Examples:

- authorization
- validation
- audit
- rate limiting
- webhook verification
- input sanitization

## ADR-016: Validated Technology Stack

Status: Accepted

The validated stack is:

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Docker
- GitHub Actions

## ADR-017: Testing Strategy

Status: Accepted

Every feature includes automated tests.

Minimum requirements:

- unit tests
- integration tests
- critical end-to-end tests
- security validation where applicable

## ADR-018: Semantic Versioning

Status: Accepted

Seneve uses Semantic Versioning.

Examples:

- `v0.1.0`
- `v0.5.0`
- `v1.0.0`
- `v2.0.0`

## ADR-019: AI-Assisted Development

Status: Accepted

AI coding agents are first-class contributors.

Consequences:

- documentation must be explicit
- assumptions must be minimized
- business rules must remain centralized

## ADR-020: Decision Lifecycle

Status: Accepted

Every future architecture decision must include:

- identifier
- title
- status
- context
- problem statement
- alternatives considered
- decision
- rationale
- consequences
- migration plan where applicable
- related documents

Architecture decisions are never removed. If a decision changes, a new ADR references the previous one.

