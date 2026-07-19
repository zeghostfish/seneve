# Campaign Domain

## Status

Epic 003 Phase 16 introduces the Campaign bounded context foundation.

## Aggregate

`Campaign` is the aggregate root and canonical business term.

A campaign represents one configured voting operation owned by one tenant organization.

The initial aggregate contains:

- identity: `id`, `organizationId`, `name`, `slug`;
- lifecycle: `status`, `visibility`;
- schedule: `startsAt`, `endsAt`, `timezone`, `locale`;
- preliminary voting rules;
- result-visibility configuration;
- creation metadata;
- optimistic `version`.

No separate `Event`, `Election`, `Contest`, `Poll` or `VotingEvent` aggregate is introduced in
Phase 16.

## Lifecycle

Configured lifecycle states:

- `DRAFT`;
- `SCHEDULED`;
- `ACTIVE`;
- `PAUSED`;
- `COMPLETED`;
- `CANCELLED`;
- `ARCHIVED`.

Allowed transitions:

- `DRAFT -> SCHEDULED`;
- `DRAFT -> CANCELLED`;
- `SCHEDULED -> DRAFT`;
- `SCHEDULED -> ACTIVE`;
- `SCHEDULED -> CANCELLED`;
- `ACTIVE -> PAUSED`;
- `ACTIVE -> COMPLETED`;
- `ACTIVE -> CANCELLED`;
- `PAUSED -> ACTIVE`;
- `PAUSED -> COMPLETED`;
- `PAUSED -> CANCELLED`;
- `COMPLETED -> ARCHIVED`;
- `CANCELLED -> ARCHIVED`.

Time-based activation is not automatic in Phase 16. A future scheduler may evaluate campaign
availability and issue explicit activation commands. Query handlers must not perform hidden writes.

## Invariants

- campaign belongs to exactly one organization;
- organization id cannot change after creation;
- name is required and bounded;
- slug is normalized and organization-unique;
- schedule start precedes end;
- persisted instants are UTC timestamps;
- timezone is retained for display and rule interpretation;
- lifecycle transitions are explicit;
- archived campaigns are immutable;
- active campaigns cannot change foundational voting rules;
- scheduled result visibility requires a reveal timestamp;
- non-scheduled result visibility must not carry a reveal timestamp.

## Preliminary Rules

Phase 16 stores configuration only.

Supported `votingMode` values:

- `FREE`;
- `PAID`;
- `HYBRID`.

Supported `resultsVisibility` values:

- `HIDDEN`;
- `LIVE`;
- `AFTER_CAMPAIGN`;
- `SCHEDULED`.

No vote storage, payment execution, result computation or public voting endpoint exists in this
phase.

## Events

Versioned domain events:

- `CampaignCreated`;
- `CampaignUpdated`;
- `CampaignScheduled`;
- `CampaignActivated`;
- `CampaignPaused`;
- `CampaignCompleted`;
- `CampaignCancelled`;
- `CampaignArchived`;
- `CampaignRulesUpdated`.

Events represent completed business facts and exclude vote, payment, candidate and fraud behavior.
