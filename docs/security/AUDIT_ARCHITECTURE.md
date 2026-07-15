# Audit Architecture

## Status

Implemented in Epic 002 Phase 12.

The Audit subsystem is transport-neutral and append-only. It records significant business, security and privileged actions without becoming mutable application state.

## Packages

- `@seneve/domain-audit`
- `@seneve/audit-application`
- `@seneve/audit-persistence`

Dependency direction:

```text
Audit domain
-> Audit application
-> Audit persistence
```

The domain package does not depend on Prisma, NestJS, PostgreSQL, HTTP or logging frameworks.

## Record Model

Implemented table:

- `audit_records`

Core fields:

- `id`
- `tenant_id`
- `stream_type`
- `stream_id`
- `sequence_number`
- `event_name`
- `event_version`
- `occurred_at`
- `actor_type`
- `actor_identity_id`
- `actor_membership_id`
- `execution_mode`
- `execution_source`
- `resource_type`
- `resource_id`
- `action`
- `outcome`
- `reason_code`
- `correlation_id`
- `request_id`
- `job_id`
- `privileged`
- `privileged_reason`
- `retention_category`
- `metadata_json`
- `previous_record_hash`
- `record_hash`
- `created_at`

## Streams and Hash Chain

Hash chaining is per stream.

Implemented stream types:

- `TENANT`: one chain per tenant.
- `PLATFORM`: one chain for platform/global records.

Sequence allocation is protected by a PostgreSQL advisory transaction lock on the stream key. The database also enforces unique `(stream_type, stream_id, sequence_number)`.

Record hash:

```text
sha256(previousRecordHash or GENESIS + canonicalAuditPayload)
```

Canonical serialization sorts object keys and normalizes dates to ISO-8601.

## Immutability

Audit records are append-only.

The database rejects:

- update;
- delete.

Corrections require a new audit record. There is no application `save()` method for modifying audit history.

## Metadata Safety

Audit metadata is sanitized before append.

Forbidden metadata key fragments are redacted, including:

- password
- secret
- token
- authorization
- cookie
- credential
- api key
- card

Audit records must never contain raw credentials, token values, authorization headers, cookies or full payment-card data.

## Transaction Strategy

Critical Epic 002 governance and security actions should append audit records in the same transaction where practical.

Mandatory audit failure policy:

```text
audit append fails
-> business transaction fails
```

Lower-severity operational telemetry may be allowed to continue in later phases if an alerting path exists.

Implemented adapters:

- `AuditingSecurityEventRecorder`
- `OrganizationAuditEventRecorder`

These consume existing Identity security events and Organization domain events without making the Identity or Organization domain packages depend on Audit.

## Query Scope

Internal query support is prepared for:

- tenant;
- event name;
- actor identity;
- resource;
- outcome;
- correlation identifier;
- privileged actions;
- date range;
- pagination limit.

No HTTP audit endpoints are implemented in Phase 12.

## Retention Categories

Implemented categories:

- `SECURITY_CRITICAL`
- `GOVERNANCE`
- `FINANCIAL_FUTURE`
- `OPERATIONAL`

No deletion or de-identification workflow is implemented in Phase 12.
