# Organization UX

## Status

Phase 15 adds the first organization frontend integration for the approved Organization API.

## Onboarding

After authentication:

- users with no organizations see organization creation onboarding;
- users with one or more organizations can select an organization;
- the selected organization is remembered as a convenience value only.

The backend validates every organization operation.

## Organization Switcher

The switcher lists organizations returned by the backend for the authenticated identity.

Switching organizations:

- changes the current frontend context;
- causes organization-scoped screens to use the selected target;
- does not grant authorization by itself.

## Organization Overview

The overview screen displays safe organization information:

- name;
- slug;
- status;
- locale;
- timezone;
- version where returned by the API.

Lifecycle actions remain backend-enforced and may be expanded as product decisions require.

## Members

The members screen lists:

- identity identifier;
- role;
- membership status.

Available actions include:

- role update;
- suspension;
- removal.

The backend still enforces permission, tenant scope and last-owner invariants.

## Invitations

The invitations screen supports:

- pending invitation listing;
- invite member form;
- invitation revocation.

Raw invitation tokens are not displayed in production UI or persisted by the frontend.

## Invitation Acceptance

Invitation acceptance has a dedicated route. The token may be read from the URL and submitted to the
backend, then removed from browser history where practical.

The token alone does not establish general tenant access.

## Ownership Transfer

The ownership-transfer screen requires an explicit confirmation word before submitting the request.

The backend validates the actor, permission, target membership, organization state and last-owner
rules. A future security increment may require recent authentication for this operation.
