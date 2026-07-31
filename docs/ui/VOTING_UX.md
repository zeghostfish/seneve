# Voting UX

## Authenticated Ballot

The initial Seneve ballot requires an authenticated identity and supports free voting only. It
shows eligible Candidates, remaining quota and explicit confirmation feedback without exposing
totals or rankings.

When `allowMultipleCandidates` is enabled, the ballot presents keyboard-accessible checkboxes and
limits the current selection to the remaining quota. Confirmation submits all selected Candidates
atomically. Otherwise, radio controls preserve single-Candidate selection and backend rules prevent
later votes from switching Candidates.

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

## Private Results

Authorized Campaign administrators can open `/campaigns/:campaignId/results` from the Campaign
overview. The responsive page displays confirmed-vote and distinct-voter aggregates plus Candidate
totals in configured Campaign order. It deliberately avoids rank, winner and voter-level
presentation.

Changing the active Organization clears the current result view before the next tenant-scoped
request resolves. Permission denial and inaccessible Campaigns use the shared error state; the
backend remains authoritative.

## Deferred

Anonymous ballots, public Campaign discovery, Payment, SMS, fraud controls, public results and
rankings remain deferred.
