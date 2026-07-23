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
5. `docs/security/AUDIT_ARCHITECTURE.md`
6. `docs/security/AUDIT_EVENT_CATALOG.md`
7. `docs/security/AUTHENTICATION_HTTP_SECURITY.md`
8. `docs/api/AUTHENTICATION_API.md`
9. `docs/brand/BRAND_ASSET_GUIDELINES.md`
10. `docs/ui/DESIGN_SYSTEM.md`
11. `docs/database/DATABASE_SCHEMA.md`
12. `docs/domain/CAMPAIGN_DOMAIN.md`
13. `docs/architecture/CAMPAIGN_ARCHITECTURE.md`
14. `docs/api/CAMPAIGN_API.md`
15. `docs/domain/CANDIDATE_DOMAIN.md`
16. `docs/architecture/CANDIDATE_ARCHITECTURE.md`
17. `docs/api/CANDIDATE_API.md`
18. `docs/domain/VOTING_DOMAIN.md`
19. `docs/architecture/VOTING_ARCHITECTURE.md`
20. `docs/api/VOTING_API.md`
21. `docs/ui/CAMPAIGN_MANAGEMENT_UX.md`
22. `docs/ui/CANDIDATE_MANAGEMENT_UX.md`
23. `docs/engineering/RUNTIME_VALIDATION.md`
24. `docs/engineering/POSTGRESQL_RLS_VALIDATION.md`
25. `docs/engineering/REDIS_VALIDATION.md`
26. `docs/engineering/CI.md`
27. `docs/engineering/SECURITY_REVIEW.md`
28. `docs/roadmap/PHASE-19-STABILIZATION.md`
29. `docs/roadmap/PHASE-19-FILE-INVENTORY.md`
30. `docs/roadmap/EPIC-001-FOUNDATION.md`

Additional product and module specifications from the source requirements remain authoritative and must be migrated into this documentation set as the repository matures.

## Documentation Rules

- Documentation and implementation must evolve together.
- Business rules must not be invented in code.
- Any change to business behavior requires documentation updates.
- Any significant architecture change requires a new ADR.
- Confirmed votes, ledger entries, payment webhook records, and audit logs are immutable.
- GitHub is the source of truth once the repository is initialized.
