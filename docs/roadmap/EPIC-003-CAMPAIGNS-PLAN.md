# Epic 003 - Campaigns

## Status

Phase 16, Phase 17 and Phase 18 are implemented locally under the local development continuation waiver. Git commits,
PostgreSQL runtime validation, Redis validation, GitHub publication and remote CI remain pending.

## Phase 16 Scope

Implemented:

- Campaign domain aggregate;
- lifecycle state machine;
- schedule and preliminary rules value objects;
- Campaign domain events;
- Campaign Prisma schema and migration;
- Campaign repository contracts and Prisma adapter;
- Campaign application service;
- Campaign permissions;
- audit-event mapping;
- authenticated organization-scoped Campaign HTTP API;
- focused domain, application and controller tests;
- Campaign domain, architecture and API documentation.

Deferred:

- vote storage;
- public voting endpoints;
- payment execution;
- SMS flows;
- fraud scoring;
- live results;
- Campaign frontend workflows beyond Phase 15 foundation.

## Phase 17 Scope

Implemented:

- Candidate domain aggregate;
- candidate lifecycle state machine;
- campaign lifecycle interaction policy;
- Candidate domain events;
- Candidate Prisma schema and migration;
- Candidate repository contracts and Prisma adapter;
- Candidate application service;
- Candidate permissions;
- audit-event mapping;
- authenticated organization- and campaign-scoped Candidate HTTP API;
- focused domain, application and controller tests;
- Candidate domain, architecture and API documentation.

Deferred:

- public candidate pages;
- vote submission;
- vote counting;
- payment execution;
- fraud scoring;
- rankings;
- public results.

## Runtime Validation

PostgreSQL-backed RLS and repository tests remain gated until a runtime database is available.

The full test suite and production build remain blocked in the current sandbox if port binding is
still unavailable.

## Phase 18 Scope

Implemented:

- private authenticated Campaign management routes;
- Campaign list, filtering, creation, overview, settings, lifecycle actions and rules form;
- centralized Campaign frontend API client;
- private Candidate management routes scoped by Campaign;
- Candidate list, creation, detail, editing, lifecycle actions and accessible reordering;
- centralized Candidate frontend API client;
- Campaign and Candidate status presentation helpers;
- focused frontend tests;
- Campaign and Candidate management UX documentation.

Deferred:

- public campaign pages;
- public candidate pages;
- vote submission;
- vote counting;
- payment execution;
- fraud controls;
- rankings;
- public results.

## Phase 19 Recommendation

Do not begin Voting or Payment work until Phase 18 is reviewed and the outstanding runtime
validation plan is accepted.

Recommended next increment:

- PostgreSQL and Redis runtime validation for accumulated Epic 002 and Epic 003 work;
- frontend browser integration once local port binding is available;
- only then plan Voting Engine foundations.
