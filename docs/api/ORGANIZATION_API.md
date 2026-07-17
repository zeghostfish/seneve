# Organization API

## Status

Epic 002 Phase 14 exposes the approved Organization, Membership, Invitation and Ownership
workflows through the NestJS REST boundary.

Frontend pages, production invitation delivery, custom roles, subscriptions, billing, API keys and
Campaign functionality remain out of scope.

## Base Paths

```text
/api/v1/organizations
/api/v1/invitations
```

All organization endpoints require bearer authentication. Invitation acceptance also requires an
authenticated identity in V1.

## Implemented Endpoints

```text
POST   /organizations
GET    /organizations
GET    /organizations/:organizationId
PATCH  /organizations/:organizationId

POST   /organizations/:organizationId/activate
POST   /organizations/:organizationId/suspend
POST   /organizations/:organizationId/reactivate
POST   /organizations/:organizationId/close
POST   /organizations/:organizationId/archive

GET    /organizations/:organizationId/memberships
PATCH  /organizations/:organizationId/memberships/:membershipId
POST   /organizations/:organizationId/memberships/:membershipId/suspend
DELETE /organizations/:organizationId/memberships/:membershipId

POST   /organizations/:organizationId/invitations
GET    /organizations/:organizationId/invitations
POST   /organizations/:organizationId/invitations/:invitationId/revoke

POST   /organizations/:organizationId/ownership-transfer

POST   /invitations/accept
```

## Processing Order

Every protected organization route must follow this order:

```text
HTTP authentication
tenant resolution
permission evaluation
application service
domain invariant validation
tenant-aware transaction
PostgreSQL RLS
mandatory audit append
response mapping
```

Controllers may validate requests, extract authentication context, manage transport concerns and map
responses. They must not implement organization governance rules, permission checks or persistence
logic.

## Tenant Resolution

Existing organization routes derive the target tenant from the path `organizationId`. The server then
verifies current membership and permission before executing tenant-scoped repository operations.

The API does not accept a generic `X-Tenant-Id` header as sufficient authority.

Organization creation uses the controlled bootstrap operation because the tenant does not yet exist.
Invitation acceptance uses the verified invitation token to resolve the target tenant before the
controlled acceptance operation.

## Organization Listing

`GET /organizations` lists organizations accessible to the authenticated identity through the
approved membership access-index query. This is the only Phase 14 listing exception to single-tenant
repository access. After a specific organization is selected, tenant-scoped reads and writes use the
Tenant Context Engine and RLS transaction boundary.

## Invitation Token Transport

Invitation creation produces an ephemeral notification command containing the raw invitation token.
The HTTP response never includes the raw invitation token.

Invitation acceptance accepts:

```json
{
  "tokenId": "...",
  "token": "...",
  "recipientEmail": "member@example.com"
}
```

Only the token hash is used for lookup. Raw invitation tokens must not be logged, persisted, audited
or returned in API responses.

## Optimistic Concurrency

Mutable organization lifecycle and profile commands use an explicit `expectedVersion` field. Stale
updates map to:

```text
409 ORGANIZATION_VERSION_CONFLICT
```

## Public Error Shape

```json
{
  "code": "PERMISSION_DENIED",
  "message": "Permission denied.",
  "correlationId": "..."
}
```

Cross-tenant resource concealment should use `404` where the caller must not learn whether a
resource exists.

## Rate Limiting

Phase 14 preserves the API rate-limiting boundary but does not claim production-distributed
organization rate limiting until Redis-backed runtime validation is complete.

Invitation-related keys must use hashed identifiers and must not expose plaintext recipient email
addresses.

## OpenAPI

The NestJS OpenAPI generator discovers the Organization controllers and DTOs through the API module.
Generated schemas must expose transport contracts only. Domain aggregates, Prisma records, raw token
material and audit internals must not appear in OpenAPI schemas.
