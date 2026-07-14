# ADR-025: Rich Authorization Model

## Status

Accepted

## Context

Roles alone are not expressive enough for a SaaS platform with organization membership, subscriptions, campaign state, and conditional access rules.

## Decision

Authorization uses a layered model:

```text
Role
  -> Permission
    -> Policy
      -> Condition
```

Example:

- Role: Organization Administrator
- Permission: Create Campaign
- Policy: Subscription must be active
- Condition: User belongs to organization

## Consequences

- Permissions must be explicit.
- Policies must be testable.
- Conditions must be evaluated consistently in application services.
- UI authorization is advisory only; server-side enforcement is mandatory.
- Future authorization expansion must not require redesigning the access model.

