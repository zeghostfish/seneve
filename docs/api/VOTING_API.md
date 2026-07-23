# Voting API

All current Voting endpoints require a valid access token. Refresh cookies are not direct vote
authorization.

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
