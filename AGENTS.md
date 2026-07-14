# SENEVE - AI Engineering Guide

Version: 1.0

This document defines mandatory engineering rules for AI coding agents contributing to Seneve.

## Mission

Build and maintain Seneve as a production-grade SaaS platform that is secure, scalable, maintainable, testable, and documented.

Quality takes priority over implementation speed.

## Product Vision

Seneve is a configurable Voting-as-a-Service platform and Campaign Operating Platform.

It is not a one-off voting website.

Every implementation must preserve flexibility for multiple organizations, campaign types, payment models, verification methods, fraud controls, and reporting needs.

## Source of Truth

GitHub is the official source of truth once connected.

Documentation in `docs/` is authoritative and must be updated together with implementation.

## Required Reading

Before implementing, read:

1. `docs/README.md`
2. `docs/architecture/ARCHITECTURE.md`
3. `docs/architecture/MODULE_BOUNDARIES.md`
4. `docs/adr/ADR-INDEX.md`
5. `docs/database/DATABASE_SCHEMA.md`
6. The relevant roadmap or module specification.

## Architecture Rules

- Use a Modular Monolith.
- Follow Domain-Driven Design.
- Keep the domain layer free of infrastructure concerns.
- Prefer domain events over tight coupling.
- Avoid circular dependencies.
- Keep business logic out of controllers, UI components, workers, and provider adapters.

## Campaign Rules

The `Campaign` aggregate is the center of the platform.

Campaign behavior must be configuration-driven.

Do not hardcode campaign-specific behavior.

## Engine Boundaries

Never bypass:

- Business Rules Engine
- Voting Engine
- Verification Engine
- Financial Platform
- Fraud Engine
- Workflow Engine
- Audit Engine

## Security Rules

- Validate all inputs.
- Authorize before business logic.
- Use both application authorization and PostgreSQL Row-Level Security for tenant isolation.
- Never expose or commit secrets.
- Protect every webhook.
- Log and audit critical actions.

## Data Rules

- Use UUID primary keys for business entities.
- Tenant-scoped business tables require `organization_id`.
- Confirmed votes are immutable.
- Ledger entries are immutable.
- Audit logs are immutable.
- Payment webhook records are immutable.
- Corrections use compensating records.

## Testing Rules

Every implementation requires appropriate automated tests.

Critical workflows require integration and end-to-end coverage.

Never ignore failing tests.

## Git Rules

- Never work directly on `main`.
- Use feature branches.
- Use Conventional Commits.
- Push stable increments to GitHub.
- Keep Pull Requests updated with progress, tests, risks, and documentation changes.

## Epic 001 Constraint

Epic 001 is foundation-only.

Do not implement business functionality during Epic 001.

