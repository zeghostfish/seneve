# ADR-023: Financial Platform

## Status

Accepted

## Context

The original requirements referenced payments, commissions, refunds, settlements, invoices, and ledger integrity, but did not include a complete dedicated Financial Engine specification.

## Decision

Create a complete Financial Platform subsystem.

It includes:

- Payments
- Ledger
- Commission Engine
- Billing
- Refund Engine
- Settlement Engine
- Invoicing
- Accounting Reports

The Voting Engine must never calculate financial information directly.

## Consequences

- Financial calculations belong exclusively to the Financial Platform.
- Payment providers are adapters, not domain logic.
- Ledger entries are immutable.
- Refunds and corrections create compensating entries.
- Voting consumes financial outcomes through application services or domain events.
