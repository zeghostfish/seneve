# Campaign Architecture

## Boundary

Campaign is a strategic bounded context in Seneve.

Phase 16 implements:

- `@seneve/domain-campaign`;
- `@seneve/campaign-application`;
- `@seneve/campaign-persistence`;
- organization-scoped Campaign HTTP endpoints.

The domain package has no dependency on NestJS, Prisma, PostgreSQL, Redis, HTTP, payment providers
or UI code.

## Dependency Direction

```text
HTTP controller
  -> Campaign application service
    -> Campaign domain
    -> Campaign repository contract
      <- Prisma persistence adapter
```

Authorization, tenant context and audit are consumed through existing platform services.

## Tenant Isolation

Campaigns are tenant-scoped by `organization_id`.

Every campaign command requires:

- authenticated identity;
- active organization membership;
- tenant context;
- permission evaluation;
- tenant-aware transaction boundary;
- PostgreSQL RLS-compatible persistence.

Cross-tenant campaign reads and writes must be concealed as missing resources unless a future
explicit platform-administrator path is approved.

## Audit

Campaign state changes emit domain events mapped to immutable audit records.

Audited actions include:

- creation;
- detail updates;
- rule updates;
- schedule changes;
- lifecycle transitions;
- cancellation;
- archival.

Audit metadata contains safe summaries only. It does not contain votes, payment secrets, request
bodies or future candidate data.

## Deferred Systems

Strictly deferred:

- Candidate aggregate;
- Vote aggregate;
- ballot lifecycle;
- voter identity;
- payment transaction;
- SMS integration;
- email vote confirmation;
- fraud scoring;
- result computation;
- public campaign pages;
- webhook ingestion;
- monetization.
