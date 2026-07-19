# Candidate Domain

## Boundary

`Candidate` is the aggregate for campaign participant management. It belongs to one campaign and one organization.

The aggregate owns candidate identity, presentation fields, lifecycle status, ordering position and candidate-level metadata. It does not own votes, payment totals, rankings, fraud scores, voter identity, ballot validation or result computation.

## Lifecycle

Statuses:

- `DRAFT`
- `ELIGIBLE`
- `SUSPENDED`
- `WITHDRAWN`
- `DISQUALIFIED`
- `ARCHIVED`

Approved transitions:

- `DRAFT -> ELIGIBLE`
- `DRAFT -> WITHDRAWN`
- `DRAFT -> ARCHIVED`
- `ELIGIBLE -> SUSPENDED`
- `ELIGIBLE -> WITHDRAWN`
- `ELIGIBLE -> DISQUALIFIED`
- `SUSPENDED -> ELIGIBLE`
- `SUSPENDED -> WITHDRAWN`
- `SUSPENDED -> DISQUALIFIED`
- `WITHDRAWN -> ARCHIVED`
- `DISQUALIFIED -> ARCHIVED`

`ARCHIVED` candidates are immutable. Reinstatement from `WITHDRAWN`, `DISQUALIFIED` or `ARCHIVED` is intentionally deferred.

## Campaign Interaction

Candidate application services load the campaign and enforce lifecycle policy:

- `DRAFT` and `SCHEDULED`: creation, updates, eligibility changes and reordering are allowed.
- `ACTIVE`: only explicit suspension, withdrawal or disqualification is allowed.
- `PAUSED`: status changes and reactivation are allowed.
- `COMPLETED` and `CANCELLED`: only archival is allowed.
- `ARCHIVED`: no candidate operations are allowed.

Controllers do not implement campaign lifecycle rules.

## Invariants

- Candidate belongs to exactly one organization and campaign.
- Organization and campaign identifiers cannot change after creation.
- Display name is required and bounded.
- Slug is normalized, URL-safe and unique within the campaign.
- Position is campaign-scoped and positive.
- Archived candidates are immutable.
- Status transitions must use domain methods.
- Withdrawal, suspension and disqualification require bounded reasons.
- Candidate metadata is bounded and rejects high-risk secret-like keys.

## Events

Versioned domain events:

- `CandidateCreated`
- `CandidateUpdated`
- `CandidateMarkedEligible`
- `CandidateSuspended`
- `CandidateReactivated`
- `CandidateWithdrawn`
- `CandidateDisqualified`
- `CandidateArchived`
- `CandidatesReordered`

Events contain identifiers and safe metadata only.
