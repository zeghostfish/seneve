# Campaign API

## Status

Epic 003 Phase 16 adds authenticated, organization-scoped Campaign endpoints.

All endpoints require a valid access token and backend authorization.

## Routes

```text
POST  /organizations/:organizationId/campaigns
GET   /organizations/:organizationId/campaigns
GET   /organizations/:organizationId/campaigns/:campaignId
PATCH /organizations/:organizationId/campaigns/:campaignId
PATCH /organizations/:organizationId/campaigns/:campaignId/rules
POST  /organizations/:organizationId/campaigns/:campaignId/schedule
POST  /organizations/:organizationId/campaigns/:campaignId/activate
POST  /organizations/:organizationId/campaigns/:campaignId/pause
POST  /organizations/:organizationId/campaigns/:campaignId/complete
POST  /organizations/:organizationId/campaigns/:campaignId/cancel
POST  /organizations/:organizationId/campaigns/:campaignId/archive
```

No unauthenticated public campaign routes exist in Phase 16.

## Permissions

Required permissions:

- `campaign:create`;
- `campaign:read`;
- `campaign:update`;
- `campaign:schedule`;
- `campaign:activate`;
- `campaign:pause`;
- `campaign:complete`;
- `campaign:cancel`;
- `campaign:archive`;
- `campaign:manage-rules`.

Controllers do not evaluate roles directly. They delegate to Campaign application services, which use
the Permission Evaluation Service.

## Listing

Supported filters:

- `status`;
- `visibility`;
- `search`;
- `createdFrom`;
- `createdTo`;
- `startsFrom`;
- `startsTo`.

Pagination uses `limit` and cursor. Default ordering is `createdAt DESC, id DESC`.

## Errors

Stable codes include:

- `CAMPAIGN_NOT_FOUND`;
- `CAMPAIGN_SLUG_ALREADY_EXISTS`;
- `CAMPAIGN_INVALID_SCHEDULE`;
- `CAMPAIGN_INVALID_STATUS_TRANSITION`;
- `CAMPAIGN_IMMUTABLE`;
- `CAMPAIGN_RULE_CHANGE_NOT_ALLOWED`;
- `CAMPAIGN_RESULT_VISIBILITY_INVALID`;
- `CAMPAIGN_PERMISSION_DENIED`;
- `CAMPAIGN_VERSION_CONFLICT`.

Database constraint names and internal stack traces must not be exposed.
