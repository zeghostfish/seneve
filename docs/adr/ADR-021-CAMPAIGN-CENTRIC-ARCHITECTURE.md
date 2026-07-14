# ADR-021: Campaign-Centric Architecture

## Status

Accepted

## Context

Seneve is not primarily an event management platform with voting attached. The core business value is the ability to configure, operate, supervise, and audit voting campaigns.

## Decision

Seneve is a Campaign Operating Platform.

The `Campaign` aggregate is the central business aggregate of the platform.

Every campaign owns or coordinates:

- configuration
- workflow
- voting rules
- candidates
- verification methods
- payment configuration
- fraud protection
- communications
- reports
- analytics
- settlement

Events remain useful grouping entities, but campaign behavior must not be subordinated to event-management assumptions.

## Consequences

- The domain model must place `Campaign` at the center of voting operations.
- Application services must prevent bypassing campaign configuration.
- Reports, analytics, payment setup, fraud protection, and workflows must be campaign-aware.
- Future modules should depend on campaign contracts or domain events rather than event-specific shortcuts.
