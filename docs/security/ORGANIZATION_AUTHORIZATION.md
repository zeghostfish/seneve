# Organization Authorization

## Status

Epic 002 Phase 14 applies the Phase 8 Permission Evaluation Service to Organization HTTP
workflows.

Authorization remains centralized. Controllers do not infer access from role names.

## Evaluation Inputs

Organization authorization evaluates:

- authenticated actor identity;
- tenant context;
- active organization membership;
- organization status;
- requested permission;
- target membership or invitation where applicable;
- contextual conditions such as last-owner protection.

The result is a structured decision containing the outcome, permission, policy and reason code.

## Endpoint Permission Map

| Endpoint group            | Permission             |
| ------------------------- | ---------------------- |
| Create organization       | `organization:create`  |
| Read organization         | `organization:read`    |
| Update profile            | `organization:update`  |
| Activate/reactivate/close | `organization:update`  |
| Suspend organization      | `organization:suspend` |
| Archive organization      | `organization:archive` |
| List memberships          | `membership:read`      |
| Update membership role    | `membership:update`    |
| Suspend membership        | `membership:suspend`   |
| Remove membership         | `membership:remove`    |
| List invitations          | `invitation:read`      |
| Create invitation         | `invitation:create`    |
| Revoke invitation         | `invitation:revoke`    |
| Transfer ownership        | `ownership:transfer`   |

Invitation acceptance is a controlled token-based workflow. It validates the invitation and
recipient before creating membership in the target tenant transaction.

## Non-Bypassable Domain Invariants

Permission approval does not override Organization invariants:

- archived organizations are read-only;
- suspended organizations cannot create new invitations;
- the last active owner cannot be removed, suspended or downgraded;
- ownership transfer is atomic;
- expired, revoked or accepted invitations cannot be accepted;
- duplicate active memberships are rejected.

Domain errors are mapped separately from authorization denials.

## Tenant Isolation

Application authorization is the first isolation layer. PostgreSQL Row-Level Security is the second
layer.

Organization-scoped repository operations must execute through the tenant-aware transaction
boundary. A missing or wrong tenant context must not fall back to unrestricted access.

## Platform Administration

Platform administration remains explicit and exceptional. A platform actor must pass authentication,
permission evaluation and execution-mode validation before any privileged tenant context is
established.

Client-provided headers or payload fields may not set platform-admin, cross-tenant or privileged
database context.

## Audit

Mandatory audit applies to:

- organization creation;
- lifecycle transitions;
- membership role changes;
- membership suspension and removal;
- invitation creation, revocation and acceptance;
- ownership transfer;
- future privileged cross-tenant organization mutations.

Critical mutations and audit append must remain one logical transaction where required by the Audit
Architecture.
