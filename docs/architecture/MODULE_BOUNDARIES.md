# SENEVE Module Boundaries

## Rule

Business logic belongs only in domain modules and application services.

No interface, adapter, UI component, controller, queue processor, database mapper, or provider integration may define campaign behavior.

## Domain Modules

The approved domain modules are:

- Identity
- Organization
- Campaign
- Voting
- Verification
- Payment / Financial Platform
- Fraud
- Workflow
- Reporting
- Notification
- Administration

## Strategic Modules

The following modules are strategic and must be designed for long-term extensibility:

- Campaign
- Business Rules Engine
- Voting Engine
- Financial Platform
- Workflow Engine
- Audit

## Dependency Policy

Allowed:

- Application service invokes a domain module.
- Application service publishes a domain event.
- Module consumes another module's public application service contract.
- Module reacts to another module's domain event.

Forbidden:

- Voting Engine directly calling payment provider SDKs.
- UI components calculating business rules.
- Payment module calculating vote results.
- Notification module modifying campaign state.
- Workflow Engine duplicating business logic from domain modules.
- Direct database access from UI or transport layers.
- Circular module dependencies.

## Domain Event Policy

Domain events describe completed business facts.

Examples:

- `CampaignCreated`
- `CampaignPublished`
- `VoteSessionStarted`
- `VoteAttemptCreated`
- `VerificationCompleted`
- `PaymentSucceeded`
- `FraudDetected`
- `VoteConfirmed`
- `LedgerEntryCreated`
- `SettlementGenerated`
- `AuditLogRecorded`

Events must include enough metadata for traceability:

- event id
- event type
- aggregate id
- organization id where applicable
- actor id where applicable
- occurred at
- correlation id
- causation id
- payload version

## Infrastructure Adapters

Infrastructure adapters include:

- Prisma repositories
- Redis cache
- BullMQ queues
- payment provider SDKs
- email/SMS providers
- S3 storage
- OpenTelemetry exporters
- HTTP controllers
- webhook controllers

Adapters depend on application ports. Domain modules must not depend on adapters.

