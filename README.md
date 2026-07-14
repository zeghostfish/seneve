# Seneve

Seneve is a production-grade, multi-tenant Campaign Operating Platform for configurable digital voting.

It is designed as a Voting-as-a-Service platform for competitions, awards, private elections, consultations, and digital participation workflows.

## Architecture

Seneve is built as a Modular Monolith following Domain-Driven Design principles.

The `Campaign` aggregate is the central business entity. Business behavior must remain configurable, auditable, secure, and independent of transport interfaces.

See:

- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/adr/ADR-INDEX.md`
- `docs/database/DATABASE_SCHEMA.md`
- `docs/roadmap/EPIC-001-FOUNDATION.md`

## Epic 001

Epic 001 establishes the technical foundation only.

It must not implement business modules such as campaigns, candidates, voting, payments, fraud, workflows, billing, or reporting.

## Development Rules

- GitHub is the source of truth once the remote is connected.
- Never work directly on `main`.
- Use Conventional Commits.
- Keep documentation synchronized with implementation.
- Never hardcode secrets.
- Confirmed votes, ledger entries, payment webhook records, and audit logs are immutable.
