# Platform Permission Catalog

## Status

Epic 002 Phase 8 introduced the immutable permission catalogue. Phase 14 maps Organization HTTP
endpoints to these permission identifiers.

Permission identifiers are stable contracts. Do not rename an identifier after publication; add a
new permission and migration path instead.

## Organization Permissions

| Permission             | Scope        | Purpose                                                          |
| ---------------------- | ------------ | ---------------------------------------------------------------- |
| `organization:create`  | global       | Create an organization.                                          |
| `organization:read`    | organization | Read organization details.                                       |
| `organization:update`  | organization | Update organization profile and non-destructive lifecycle state. |
| `organization:suspend` | organization | Suspend an organization.                                         |
| `organization:close`   | organization | Close an organization.                                           |
| `organization:archive` | organization | Archive a closed organization.                                   |
| `membership:read`      | organization | Read organization memberships.                                   |
| `membership:create`    | organization | Create organization memberships through approved workflows.      |
| `membership:update`    | organization | Change organization membership roles.                            |
| `membership:suspend`   | organization | Suspend organization memberships.                                |
| `membership:remove`    | organization | Remove organization memberships.                                 |
| `invitation:read`      | organization | Read organization invitations.                                   |
| `invitation:create`    | organization | Invite members.                                                  |
| `invitation:revoke`    | organization | Revoke pending invitations.                                      |
| `ownership:transfer`   | organization | Transfer organization ownership.                                 |

## Future V1 Permissions

The catalogue also reserves early V1 capabilities for later Epics:

| Permission         | Scope        | Purpose                                                |
| ------------------ | ------------ | ------------------------------------------------------ |
| `event:create`     | organization | Create future events.                                  |
| `campaign:create`  | organization | Create future campaigns.                               |
| `candidate:create` | organization | Create future candidates.                              |
| `billing:view`     | organization | View future billing data.                              |
| `billing:update`   | organization | Update future billing settings.                        |
| `system:admin`     | platform     | Perform explicitly authorized platform administration. |

Future modules must reuse this catalogue rather than inventing route-local permission names.

## Role Mapping

Roles assign permissions; they are not themselves authorization decisions.

The V1 organization role set is:

```text
OWNER
ADMINISTRATOR
EVENT_MANAGER
FINANCE_MANAGER
CONTENT_MANAGER
VIEWER
AUDITOR
```

The Permission Evaluation Service evaluates role assignment together with policies and runtime
conditions. Controllers and UI components must not duplicate this mapping.
