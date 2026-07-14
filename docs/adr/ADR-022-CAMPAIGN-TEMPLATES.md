# ADR-022: Campaign Templates

## Status

Accepted

## Context

Organizers should be able to launch common campaign types without custom development. Reusable templates reduce configuration errors and support consistent product behavior.

## Decision

Introduce `CampaignTemplate` as a first-class business entity.

Campaigns should be instantiated from templates whenever possible.

Initial template examples include:

- Beauty Contest
- Music Competition
- Startup Awards
- Internal Election
- People's Choice
- Public Consultation

Templates may configure:

- categories
- voting rules
- payment packages
- workflow
- notifications
- dashboards
- reports
- branding defaults

## Consequences

- Templates are reusable assets, not code branches.
- Template configuration must remain data-driven.
- A campaign may override allowed template defaults according to documented rules.
- Template changes must not silently mutate already published campaigns unless an explicit migration or versioning policy allows it.

