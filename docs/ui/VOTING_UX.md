# Voting UX

## Authenticated Ballot

The initial Seneve ballot requires an authenticated identity and supports free voting only. It
shows eligible Candidates, remaining quota and explicit confirmation feedback without exposing
totals or rankings.

## Voting Receipts

`/vote/:organizationId/history` provides a responsive, keyboard-accessible list of the identity's
confirmed votes in the selected Organization. Each receipt shows:

- Campaign name;
- Candidate display name;
- confirmation time;
- immutable receipt identifier;
- a route back to the Campaign ballot.

Receipts load through the centralized Voting API client with bounded cursor pagination. Empty,
loading, authentication and recoverable error states remain explicit. Organization and identity
isolation are enforced by the API and PostgreSQL RLS; the client never treats cached receipt data as
authorization.

## Deferred

Anonymous ballots, public Campaign discovery, multi-selection submission, Payment, SMS, fraud
controls, results and rankings remain deferred.
