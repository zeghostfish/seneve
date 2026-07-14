# ADR-028: Version 1 Scope

## Status

Accepted

## Context

The original V1 scope was broad. The immediate goal is a stable, production-ready platform foundation and a focused first product version.

## Decision

Version 1 includes:

- Authentication
- Organizations
- Team Management
- Events
- Campaigns
- Categories
- Candidates
- Free Voting
- Paid Voting
- Mobile Money integration
- Card payment integration
- Reporting
- Audit
- Administration

Moved to later milestones:

- SMS voting
- Public API
- White Label
- Marketplace
- Advanced Workflow Templates
- AI Fraud Analysis
- Native mobile applications

## Consequences

- Epic 001 must only establish foundation and no business functionality.
- Later Epics must avoid pulling deferred features into V1 unless a new ADR changes scope.
- The architecture must still keep deferred interfaces and modules possible.

