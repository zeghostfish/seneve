# Frontend Architecture

## Status

Phase 15 introduces the first authenticated Next.js frontend for Epic 002 under the local
development waiver. The implementation is uncommitted while Git metadata writes remain blocked.

## Boundaries

The frontend consumes the existing Authentication and Organization APIs. It does not duplicate
backend business rules, tenant isolation, permission policies, audit requirements or PostgreSQL RLS.

The backend remains authoritative for:

- credential validation;
- session state;
- refresh-token rotation;
- email-verification and password-reset token validity;
- organization permissions;
- organization domain invariants;
- tenant isolation;
- mandatory audit.

## Application Structure

The web application uses the existing Next.js app router.

Phase 15 adds:

- public entry routes for login and registration;
- authentication routes for email verification and password reset;
- protected application routes under `(app)`;
- invitation acceptance route;
- shared frontend providers;
- centralized API clients;
- focused authentication, navigation, organization and feedback components.

Phase 18 adds:

- private Campaign management routes;
- private Candidate management routes scoped by Campaign;
- centralized Campaign and Candidate API clients;
- Campaign and Candidate status presentation helpers.

## API Client

The centralized API boundary lives under `apps/web/lib/api`.

Responsibilities:

- base URL resolution through `NEXT_PUBLIC_API_BASE_URL`;
- JSON request and response handling;
- credentialed requests for refresh-cookie flows;
- in-memory access-token attachment;
- correlation identifier header generation;
- normalized public API errors;
- no blind retry of non-idempotent operations.

Raw `fetch()` calls should not be scattered through page components.

Campaign and Candidate workflows must use `campaignApi` and `candidateApi`. Page components should
not bypass those clients.

## Authentication State

The frontend session boundary tracks:

- `loading`;
- `authenticated`;
- `unauthenticated`;
- `refreshing`;
- `expired`;
- `error`.

Refresh tokens remain in the backend-managed `HttpOnly` cookie. The web app does not store refresh
tokens in local storage, session storage, IndexedDB, React state or JavaScript-readable cookies.

The access token is held in memory by the authentication provider and refreshed through the backend.
The existence of a local token is not treated as proof of an active session.

## Route Protection

Protected routes render inside the authenticated application shell. The shell attempts session
refresh and redirects unauthenticated or expired users to `/login`.

This is a user-experience boundary, not a security boundary. Backend APIs still enforce
authentication, authorization, RLS and audit.

## Organization Context

The organization provider lists organizations accessible to the authenticated identity and stores a
selected organization identifier for convenience only.

The selected identifier is not authorization. Every organization-scoped request is still validated by
the backend using the authenticated actor, tenant context, permission evaluation and RLS.

## Permission-Aware UI

The frontend provides a lightweight permission-aware UI helper for hiding or disabling actions.

This helper is intentionally shallow. It does not reproduce policy conditions such as last-owner
protection, invitation replay rules, ownership-transfer invariants or tenant isolation. Domain
errors from the backend must still be displayed clearly.

## Campaign And Candidate Management

Campaign and Candidate screens reuse the authenticated shell, organization provider, permission
helper, feedback components, Seneve branding and design tokens.

The backend remains authoritative for lifecycle rules, permissions, tenant isolation and audit. The
frontend refetches authoritative data after mutations and does not store complete Campaign or
Candidate records in local storage.

## Runtime Validation

Full runtime validation remains pending until the environment supports:

- PostgreSQL with the migrated schema;
- runtime database role subject to RLS;
- Redis;
- API and web runtime execution without the current sandbox port-binding restriction.
