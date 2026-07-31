# Voting API

All current Voting endpoints require a valid access token. Refresh cookies are not direct vote
authorization.

## Read Authenticated Ballot

`GET /voting/organizations/:organizationId/campaigns/:campaignId/ballot`

The response contains safe Campaign presentation and voting-rule fields, ordered eligible
Candidates, the authenticated identity's confirmed-vote count and remaining quota. It excludes
voter identifiers, vote totals, rankings and request identifiers.

The Campaign must be active, inside its configured UTC voting window, non-private and configured for
free voting. Candidate eligibility and quota are checked again during submission.

## Submit Free Vote

`POST /voting/organizations/:organizationId/campaigns/:campaignId/votes`

```json
{
  "candidateId": "44444444-4444-4444-8444-444444444444",
  "requestId": "77777777-7777-4777-8777-777777777777"
}
```

`requestId` is a client-generated idempotency UUID. The response contains `replayed: true` for a
successful replay and excludes voter identity and request identifiers.

## Read Own Vote

`GET /voting/organizations/:organizationId/votes/:voteAttemptId`

Only the owning identity can resolve the attempt. Cross-identity and cross-tenant lookups return not
found.

## List Own Voting Receipts

`GET /voting/organizations/:organizationId/votes?limit=25&cursor=:voteAttemptId`

Returns confirmed receipts for the authenticated identity in reverse chronological order. Each
receipt contains safe Campaign and Candidate names, the immutable vote-attempt identifier and the
confirmation time. The response includes `nextCursor` when another page exists.

The endpoint excludes voter identifiers, idempotency keys, vote totals and rankings. A cursor never
grants access to a receipt outside the authenticated voter and Organization context.

## Stable Errors

- `VOTE_NOT_FOUND`
- `VOTE_REQUEST_CONFLICT`
- `VOTING_CAMPAIGN_NOT_FOUND`
- `VOTING_CANDIDATE_NOT_FOUND`
- `VOTING_IDENTITY_NOT_FOUND`
- `VOTING_IDENTITY_INACTIVE`
- `VOTING_EMAIL_VERIFICATION_REQUIRED`
- `VOTING_CAMPAIGN_NOT_ACTIVE`
- `VOTING_CAMPAIGN_PRIVATE`
- `VOTING_CAMPAIGN_OUTSIDE_WINDOW`
- `VOTING_CANDIDATE_NOT_ELIGIBLE`
- `VOTING_PAYMENT_REQUIRED`
- `VOTING_QUOTA_REACHED`

Database errors, policy details and cross-tenant existence are never exposed.

## Web Route

`/vote/:organizationId/:campaignId`

The route requires the existing Seneve authentication session. It uses the ballot endpoint and
submits a client-generated UUID through the free-vote endpoint. Anonymous voting is not supported.

`/vote/:organizationId/history` lists the signed-in identity's confirmed voting receipts for the
Organization.
