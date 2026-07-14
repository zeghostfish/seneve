# ADR-027: Interface-Independent Business Logic

## Status

Accepted

## Context

REST is the initial API delivery mechanism, but future interfaces may include GraphQL, SDKs, public APIs, mobile applications, and embedded widgets.

## Decision

Business logic must remain independent of REST.

All interfaces consume the same application services and domain modules.

## Consequences

- Controllers must be thin transport adapters.
- Business rules must not live in controllers, UI components, REST DTOs, or provider adapters.
- Application services expose use cases.
- Domain modules expose business concepts, rules, events, and invariants.
- API contracts can evolve without duplicating business behavior.
