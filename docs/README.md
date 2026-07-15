# SENEVE Documentation

This directory contains the official project documentation for Seneve.

Seneve is a production-grade, multi-tenant Campaign Operating Platform for configurable digital voting.
The platform must remain modular, auditable, secure, and extensible over the long term.

## Documentation Order

Before implementation, contributors must read:

1. `docs/architecture/ARCHITECTURE.md`
2. `docs/adr/ADR-INDEX.md`
3. `docs/architecture/TENANT_CONTEXT.md`
4. `docs/security/POSTGRESQL_ROW_LEVEL_SECURITY.md`
5. `docs/database/DATABASE_SCHEMA.md`
6. `docs/roadmap/EPIC-001-FOUNDATION.md`

Additional product and module specifications from the source requirements remain authoritative and must be migrated into this documentation set as the repository matures.

## Documentation Rules

- Documentation and implementation must evolve together.
- Business rules must not be invented in code.
- Any change to business behavior requires documentation updates.
- Any significant architecture change requires a new ADR.
- Confirmed votes, ledger entries, payment webhook records, and audit logs are immutable.
- GitHub is the source of truth once the repository is initialized.
