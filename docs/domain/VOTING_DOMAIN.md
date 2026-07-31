# Voting Domain

## Scope

The Voting bounded context owns vote attempts and confirmed vote facts. The initial implementation
supports authenticated free voting only. Payment, SMS, fraud analysis, public voting pages and
result computation remain separate modules or later phases.

## Aggregate

`VoteAttempt` is the aggregate root. It contains Organization, Campaign, Candidate and authenticated
voter identifiers, a client-generated idempotency UUID, status, timestamps and optimistic version.

Finalized attempts are immutable. Confirmed votes are never updated or deleted. Corrections, if
introduced later, require explicit compensating domain facts.

## Eligibility

A free vote is confirmed only when the identity is active, email is verified when required, the
Campaign is `ACTIVE` inside `[startsAt, endsAt)`, voting mode is `FREE`, the Candidate is `ELIGIBLE`
in the same tenant and the confirmed-vote count remains below `votesPerVoter`.

Private Campaigns are rejected until an explicit voter-admission contract exists. Knowing tenant and
Campaign identifiers is never treated as authorization.

Paid and hybrid Campaigns return `VOTING_PAYMENT_REQUIRED`; Voting does not bypass the future
Financial Platform.

## Idempotence

The tuple `(organizationId, campaignId, voterIdentityId, requestId)` is unique. Replaying the same
request for the same Candidate returns the existing attempt. Reusing it for another Candidate is a
conflict.

`allowMultipleCandidates` belongs to a future multi-selection Ballot contract. The current endpoint
submits one Candidate per request and does not invent Ballot semantics from that flag.

## Ballot Projection

The authenticated ballot is a safe read projection of an active Campaign and its `ELIGIBLE`
Candidates. It exposes presentation fields, Campaign voting rules and the authenticated identity's
remaining quota. It does not contain vote totals, ranks, voter identifiers, idempotency keys or
internal lifecycle data.

Opening a ballot applies the same identity, email-verification, Campaign visibility, free-mode and
schedule checks that protect submission. Candidate eligibility and quota are re-evaluated
transactionally when a vote is submitted.

## Events

- `VoteAttemptCreated`
- `VoteConfirmed`
- `VoteRejected`

Audit records exclude tokens, cookies, contact details and complete request bodies.
