# PostgreSQL RLS Validation

PostgreSQL Row-Level Security is a mandatory production-readiness gate for Seneve tenant isolation.

## Current Status

RLS validation is pending.

RLS policies and gated integration tests exist locally, but they must execute against a real migrated
PostgreSQL database using the runtime application role subject to RLS.

## Required Coverage

Validate:

- migration from a clean database;
- migration from the current schema state;
- tenant context transaction settings;
- organization isolation;
- Campaign isolation;
- Candidate isolation;
- missing tenant-context denial;
- wrong-tenant denial;
- cross-tenant query containment;
- nested relation query containment;
- count and aggregate containment;
- unauthorized inserts;
- unauthorized updates;
- unauthorized deletes;
- Candidate reorder isolation;
- deferrable Candidate position constraint behavior;
- pooled connection safety;
- controlled administrative paths.

## Evidence To Record

Record:

- PostgreSQL version;
- runtime role used;
- migration result;
- RLS policy test result;
- skipped test count;
- any raw SQL probes used;
- failures and corrective actions.

## Production Rule

Do not begin the Voting bounded context until RLS validation has passed with zero PostgreSQL-gated
tests skipped in the target validation environment.
