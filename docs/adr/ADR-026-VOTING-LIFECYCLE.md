# ADR-026: Voting Lifecycle

## Status

Accepted

## Context

The simplified vote flow was useful conceptually, but production voting requires a richer lifecycle with auditable business stages.

## Decision

The official voting lifecycle is:

```text
Vote Session
  -> Vote Attempt
  -> Verification
  -> Payment
  -> Fraud Analysis
  -> Vote Confirmation
  -> Ledger Update
  -> Settlement
  -> Audit
```

Each stage represents an auditable business event.

## Consequences

- A vote session captures the user voting interaction context.
- A vote attempt is an intention, not a confirmed vote.
- Verification, payment, fraud analysis, ledger update, settlement, and audit must not be bypassed.
- Paid votes must not be confirmed before definitive payment success.
- Every stage must be idempotent where replay or retry is possible.

