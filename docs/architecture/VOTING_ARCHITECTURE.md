# Voting Architecture

## Boundaries

The domain package contains `VoteAttempt` and the eligibility policy. It has no NestJS, Prisma,
Redis, payment-provider or HTTP dependency.

The application service coordinates Identity, Campaign and Candidate read models, idempotence,
quota enforcement, persistence and audit. PostgreSQL is the authoritative concurrency boundary.

The persistence adapter executes inside `VOTE_SUBMISSION`, an authenticated tenant context that
contains an Organization and Identity but no fabricated Organization membership or management
permission.

## Persistence and RLS

`vote_attempts` has foreign keys to Organization, Campaign, Candidate and Identity. RLS restricts
authenticated reads and inserts to the active tenant and current voter identity. No delete policy is
provided. A trigger rejects updates and deletes of finalized attempts.

## Transaction

Campaign state, Candidate eligibility, confirmed-vote count and insertion are evaluated in one
tenant-scoped transaction. A voter-scoped PostgreSQL advisory lock serializes quota checks, and the
unique request constraint closes concurrent idempotency races.

Vote persistence and audit append share the same Prisma transaction and RLS settings. A failed audit
append therefore rolls back the confirmed vote, and a failed vote cannot leave a success audit fact.

## Deferred Stages

Verification providers, Payment, Fraud, Ballot composition, result projections, public interfaces
and notifications remain outside this foundation. They must not mutate confirmed records.
