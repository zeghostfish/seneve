# Campaign Management UX

Phase 18 adds private authenticated Campaign administration to the existing Seneve web shell.

## Routes

- `/campaigns`
- `/campaigns/new`
- `/campaigns/:campaignId`
- `/campaigns/:campaignId/settings`
- `/campaigns/:campaignId/candidates`
- `/campaigns/:campaignId/candidates/new`
- `/campaigns/:campaignId/candidates/:candidateId`

These routes require authentication and an active organization context. They do not expose public campaign pages or voting behavior.

## API Client

The frontend uses `campaignApi` in `apps/web/lib/api/campaign-api.ts`.

Supported operations:

- list;
- get;
- create;
- update;
- update rules;
- schedule;
- lifecycle transitions.

The client always sends organization and campaign identifiers through the documented backend routes.

## Lifecycle Actions

The UI exposes only API-backed actions:

- activate;
- pause;
- complete;
- cancel;
- archive.

Completion, cancellation and archival require confirmation. Backend lifecycle validation remains authoritative, and rejected transitions refresh Campaign data.

## Timezone Behavior

Campaign schedules are transmitted as timestamps and displayed using the configured campaign timezone. Scheduling forms show timezone explicitly and validate start-before-end locally before submission.

## Deferred

The Campaign UI intentionally excludes vote totals, rankings, public pages, payment configuration, fraud indicators and public results.
