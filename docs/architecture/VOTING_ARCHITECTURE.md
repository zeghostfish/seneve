# Voting Architecture

## Boundaries

The domain package contains `VoteAttempt` and the eligibility policy. It has no NestJS, Prisma,
Redis, payment-provider or HTTP dependency.

The application service coordinates Identity, Campaign and Candidate read models, idempotence,
quota enforcement, persistence and audit. PostgreSQL is the authoritative concurrency boundary.

The ballot query uses the same authenticated voting tenant context and returns only the active
Campaign plus eligible Candidate presentation fields. The web application keeps the access token in
the existing authentication provider, generates a UUID idempotency key per submission attempt and
refetches the authoritative ballot after confirmation.

Multi-candidate submission is an application-level transaction over immutable `VoteAttempt`
aggregates, not a second mutable aggregate. Each selection has its own idempotency UUID. The
application locks the voter, resolves replays, verifies the Campaign allocation rule and quota,
loads every Candidate in the tenant context, then persists all new attempts and audit events in one
transaction.

The receipt query uses the same voter-scoped tenant context. It joins only safe Campaign and
Candidate presentation fields to the authenticated identity's confirmed attempts, applies bounded
cursor pagination and never builds vote totals or result projections.

The private result query uses a separate Organization-member application service and the explicit
`voting:results:read` permission. PostgreSQL aggregates immutable confirmed attempts inside a
tenant-scoped RLS transaction. The projection is generated on demand and contains Candidate totals
and a distinct-voter aggregate only; it never returns voter rows or creates a mutable tally table.

The persistence adapter executes inside `VOTE_SUBMISSION`, an authenticated tenant context that
contains an Organization and Identity but no fabricated Organization membership or management
permission.

## Persistence and RLS

`vote_attempts` has foreign keys to Organization, Campaign, Candidate and Identity. RLS restricts
authenticated reads and inserts to the active tenant and current voter identity. No delete policy is
provided. A trigger rejects updates and deletes of finalized attempts. A separate SELECT policy
permits tenant-context result aggregation after application authorization without expanding voter
submission privileges.

## Transaction

Campaign state, Candidate eligibility, confirmed-vote count and insertion are evaluated in one
tenant-scoped transaction. A voter-scoped PostgreSQL advisory lock serializes quota checks, and the
unique request constraint closes concurrent idempotency races.

Vote persistence and audit append share the same Prisma transaction and RLS settings. A failed audit
append therefore rolls back the confirmed vote, and a failed vote cannot leave a success audit fact.

## Deferred Stages

Verification providers, Payment, Fraud, anonymous admission, public result publication, rankings,
public discovery and notifications remain outside this foundation. They must not mutate confirmed
records.
