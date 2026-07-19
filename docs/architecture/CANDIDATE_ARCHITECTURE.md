# Candidate Architecture

## Packages

- `@seneve/domain-candidate`: aggregate, value objects, errors, events and repository contracts.
- `@seneve/candidate-application`: use cases, authorization, campaign lifecycle policy, audit integration and transaction orchestration.
- `@seneve/candidate-persistence`: Prisma repository adapter and tenant-aware unit of work.

The domain package has no dependency on Prisma, NestJS, HTTP, Redis, PostgreSQL or UI code.

## Application Use Cases

- `CreateCandidate`
- `ListCandidates`
- `GetCandidate`
- `UpdateCandidate`
- `MarkCandidateEligible`
- `SuspendCandidate`
- `ReactivateCandidate`
- `WithdrawCandidate`
- `DisqualifyCandidate`
- `ArchiveCandidate`
- `ReorderCandidates`

Each use case requires authenticated identity, active organization context, permission evaluation, campaign lifecycle policy, domain invariant validation, tenant-aware persistence and audit recording.

## Ordering

Candidate ordering uses a campaign-scoped `position` field. Listing orders by:

```text
position ASC, createdAt ASC, id ASC
```

Reordering uses a full-list contract. The supplied list must contain every candidate in the campaign exactly once. Persistence updates occur inside one tenant-aware transaction.

## Candidate Limit

The default application limit is 500 candidates per campaign. This protects administration screens, reorder operations and future ballot generation. The value is injected into the application service rather than scattered through controllers.

## Tenant Isolation

All Candidate repository operations include:

```text
organizationId
campaignId
candidateId where applicable
```

The `candidates` table has a direct `organization_id` for PostgreSQL RLS. Cross-organization resources are treated as not found unless an explicit privileged path is introduced later.

## Audit

Mandatory audit records are mapped from Candidate domain events for creation, update, lifecycle transitions and reordering. Audit metadata is limited to identifiers, safe event payloads and correlation data.

## Deferred

Candidate management does not implement public candidate pages, votes, rankings, fraud scoring, payment data, public results or media-management workflows.
