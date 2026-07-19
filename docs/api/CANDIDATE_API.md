# Candidate API

All Candidate endpoints are authenticated and organization/campaign scoped.

Base path:

```text
/organizations/:organizationId/campaigns/:campaignId/candidates
```

## Endpoints

- `POST /organizations/:organizationId/campaigns/:campaignId/candidates`
- `GET /organizations/:organizationId/campaigns/:campaignId/candidates`
- `GET /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId`
- `PATCH /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/eligible`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/suspend`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/reactivate`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/withdraw`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/disqualify`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/:candidateId/archive`
- `POST /organizations/:organizationId/campaigns/:campaignId/candidates/reorder`

## Permissions

- `candidate:create`
- `candidate:read`
- `candidate:update`
- `candidate:manage-status`
- `candidate:reorder`
- `candidate:withdraw`
- `candidate:disqualify`
- `candidate:archive`

Frontend permission checks are usability hints only. The API remains authoritative.

## Reorder Contract

```json
{
  "candidateIds": ["candidate-id-1", "candidate-id-2"]
}
```

The list must be a complete ordering for the campaign. Duplicate, missing or inaccessible candidate identifiers are rejected.

## Error Codes

- `CANDIDATE_NOT_FOUND`
- `CANDIDATE_SLUG_ALREADY_EXISTS`
- `CANDIDATE_LIMIT_REACHED`
- `CANDIDATE_INVALID_STATUS_TRANSITION`
- `CANDIDATE_IMMUTABLE`
- `CANDIDATE_CAMPAIGN_STATE_CONFLICT`
- `CANDIDATE_DUPLICATE_POSITION`
- `CANDIDATE_REORDER_INVALID`
- `CANDIDATE_PERMISSION_DENIED`
- `CANDIDATE_REASON_REQUIRED`

Database constraint messages are not exposed.
