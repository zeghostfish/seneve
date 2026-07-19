# Candidate Management UX

Phase 18 adds private Candidate management inside a selected Campaign.

## Routes

- `/campaigns/:campaignId/candidates`
- `/campaigns/:campaignId/candidates/new`
- `/campaigns/:campaignId/candidates/:candidateId`

Candidates are not a top-level navigation module. Candidate management is always scoped by organization and campaign.

## API Client

The frontend uses `candidateApi` in `apps/web/lib/api/candidate-api.ts`.

Supported operations:

- list;
- get;
- create;
- update;
- mark eligible;
- suspend;
- reactivate;
- withdraw;
- disqualify;
- archive;
- reorder.

## Reordering

Candidate ordering uses accessible move-up and move-down controls. The UI submits the complete candidate ordering to the backend atomic reorder endpoint.

On conflict or backend rejection, the UI refetches the authoritative order.

## Lifecycle Actions

Suspension, withdrawal and disqualification require a bounded reason. Withdrawal, disqualification and archival require confirmation.

The UI does not infer validity solely from Candidate status. Campaign state can also block Candidate operations, and backend validation is authoritative.

## Deferred

The Candidate UI intentionally excludes public candidate pages, vote buttons, vote counters, rankings, payment prompts, social metrics and public results.
