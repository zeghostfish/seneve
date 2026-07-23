# Phase 19E Runtime Execution

Phase 19E validates the recovered Seneve repository against real runtime dependencies. Execute this
playbook only from the recovered repository:

```bash
cd /Users/johnzidah/Documents/Codex/seneve-phase19c-reconstruction
```

Do not begin Voting, Payment, public Campaign pages, public Candidate pages, ranking, results,
fraud or SMS work during this phase.

## Prerequisites

- The working tree is clean.
- The current branch is `feature/identity-organizations`.
- The current history includes the recovered Phase 19D commits.
- The environment has unrestricted access to `registry.npmjs.org`.
- Local TCP port binding is permitted.
- PostgreSQL and Redis are available through Docker Compose or native services.
- The validation database is disposable and not shared with production or other users.
- No real secrets are used. Local validation secrets must be generated for this run only.
- A local `.env` file exists before running `scripts/run-phase19e.sh`.

Verify the repository before runtime work:

```bash
git status --short
git log --oneline -7
git fsck --full
```

Expected output:

```text
git status --short
-> no output

git log --oneline -7
-> includes:
517d477 chore(recovery): align lockfile with campaign packages
d610d5b docs(stabilization): add phase 19 recovery and validation plans
cc651e9 feat(web): add campaign and candidate management interface
1a9be16 feat(candidate): add candidate backend foundation
3eb7d10 feat(campaign): add campaign backend foundation
7719760 feat(web): add identity and organization frontend flows
db7bb88 chore(brand): add official seneve brand assets

git fsck --full
-> no missing or corrupt objects
```

The known dangling tree `2cc97d7b1039e0a1251fa23d6ab7d3d0192e71b5` is non-blocking.

## Required Software

Install these tools before running validation:

| Tool       | Required version                                | Verification command                               |
| ---------- | ----------------------------------------------- | -------------------------------------------------- |
| Node.js    | `>=22.0.0`                                      | `node --version`                                   |
| pnpm       | `10.14.0` through Corepack                      | `corepack pnpm --version`                          |
| Git        | Any supported modern Git                        | `git --version`                                    |
| Docker     | Docker Engine with Compose v2                   | `docker --version && docker compose version`       |
| PostgreSQL | `17.x` preferred, matching `postgres:17-alpine` | `docker compose exec postgres postgres --version`  |
| Redis      | `7.x` preferred, matching `redis:7-alpine`      | `docker compose exec redis redis-server --version` |
| curl       | Available for API smoke checks                  | `curl --version`                                   |

Confirm registry access:

```bash
npm view typescript version
```

Expected output:

```text
<current TypeScript version>
```

## Required Environment Variables

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Use local-only values:

```dotenv
NODE_ENV=development
LOG_LEVEL=info

API_PORT=3000
WEB_PORT=3001
WORKER_HEALTH_PORT=3002

DATABASE_URL=postgresql://seneve:seneve@localhost:5432/seneve?schema=public
REDIS_URL=redis://localhost:6379

JWT_ACCESS_TOKEN_SECRET=phase19e-local-access-secret-change-me
JWT_REFRESH_TOKEN_SECRET=phase19e-local-refresh-secret-change-me
JWT_ACCESS_TOKEN_ISSUER=seneve-api
JWT_ACCESS_TOKEN_AUDIENCE=seneve-clients
AUTH_COOKIE_SECURE=false
CORS_ORIGINS=http://localhost:3001

OTEL_SERVICE_NAME=seneve
```

Optional variables used by the Phase 19E script and Docker Compose:

```dotenv
RUN_POSTGRES_INTEGRATION=true
RUN_PHASE19E_SMOKE=true
POSTGRES_PORT=5432
REDIS_PORT=6379
API_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:3001
WORKER_HEALTH_URL=http://localhost:3002
```

After creating `.env`, verify it remains untracked:

```bash
git status --short .env
```

Expected output:

```text
no output
```

## Docker Requirements

Use the project Compose file for PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
docker compose ps
```

Expected output:

```text
postgres   healthy
redis      healthy
```

Confirm service health:

```bash
docker compose exec postgres pg_isready -U seneve -d seneve
docker compose exec redis redis-cli ping
```

Expected output:

```text
/var/run/postgresql:5432 - accepting connections
PONG
```

## Commands To Execute

Run the complete prepared sequence:

```bash
scripts/run-phase19e.sh
```

The script verifies `git`, `node`, `corepack`, `docker`, `docker compose` and `curl`, loads `.env`,
requires the authentication and runtime variables, verifies a clean working tree and stops at the
first failing command.

Manual equivalent:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
corepack pnpm db:validate
corepack pnpm exec prisma migrate deploy --schema database/prisma/schema.prisma
RUN_POSTGRES_INTEGRATION=true corepack pnpm test
corepack pnpm test
corepack pnpm build
```

Use the exact script for the authoritative run so command ordering remains reproducible.

## Database Validation Procedure

Install dependencies:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
```

Expected output:

```text
Lockfile is up to date, resolution step is skipped
Done
```

Generate Prisma client:

```bash
corepack pnpm db:generate
```

Expected output:

```text
Generated Prisma Client
```

Validate schema:

```bash
corepack pnpm db:validate
```

Expected output:

```text
The schema at database/prisma/schema.prisma is valid
```

Run migrations:

```bash
corepack pnpm exec prisma migrate deploy --schema database/prisma/schema.prisma
```

Expected output:

```text
Applying migration ...
All migrations have been successfully applied.
```

Verify migration status:

```bash
corepack pnpm exec prisma migrate status --schema database/prisma/schema.prisma
```

Expected output:

```text
Database schema is up to date
```

Seed test data:

```bash
# No general-purpose seed command exists yet.
# Integration tests create their own isolated data.
```

Pass criteria:

- Dependency install does not modify `package.json` or `pnpm-lock.yaml`.
- Prisma generation succeeds.
- Schema validation succeeds.
- Every migration applies to a clean database.
- Migration status reports the database is up to date.

Failure interpretation:

- Dependency install failure: registry, lockfile, package metadata or package-manager issue.
- Prisma validation failure: schema defect.
- Migration failure: migration SQL, role, extension, constraint or existing-data issue.
- Dirty lockfile after frozen install: stop and inspect before committing anything.

## PostgreSQL Test Procedure

All PostgreSQL-backed tests are gated by `RUN_POSTGRES_INTEGRATION=true` and require `DATABASE_URL`.

Integration tests:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run packages/identity-persistence packages/organization-persistence packages/audit-persistence packages/campaign-persistence packages/candidate-persistence
```

Expected output:

```text
Test Files ... passed
Tests ... passed
```

Pass criteria:

- Identity persistence tests pass.
- Organization persistence tests pass.
- Audit persistence tests pass.
- Campaign persistence tests pass.
- Candidate persistence tests pass.
- No PostgreSQL integration test is skipped when the environment variables are set.

Transaction and rollback tests:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run packages/organization-persistence/src/tenant-rls-transaction.integration.test.ts packages/audit-persistence/src/prisma-audit-repository.integration.test.ts
```

Pass criteria:

- Tenant context is transaction-local.
- Rollback removes business mutations and mandatory audit records together.
- Pooled connections do not retain prior tenant context.

Uniqueness tests:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run packages/campaign-persistence/src/prisma-campaign-repository.integration.test.ts packages/candidate-persistence/src/prisma-candidate-repository.integration.test.ts
```

Pass criteria:

- Campaign slugs are unique within an organization.
- Candidate slugs are unique within a campaign.
- Candidate positions are unique within a campaign.
- Deferrable Candidate position constraints support atomic reordering.

Concurrency tests:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run -t "concurrent|concurrency|reorder|optimistic"
```

Pass criteria:

- Duplicate sequence, stale version or reorder conflicts fail predictably.
- No partial reorder persists after a failed concurrent operation.

Tenant isolation tests:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run packages/organization-persistence/src/tenant-rls-transaction.integration.test.ts packages/campaign-persistence/src/prisma-campaign-repository.integration.test.ts packages/candidate-persistence/src/prisma-candidate-repository.integration.test.ts
```

Pass criteria:

- Wrong tenant reads return no data or a stable not-found result.
- Wrong tenant updates fail.
- Missing tenant context fails closed.
- Cross-campaign and cross-organization Candidate reorder is rejected.

Failure interpretation:

- SQL state `42501`: permission or RLS policy failure. Confirm expected vs unexpected denial.
- SQL state `23505`: unique constraint failure. Confirm the application maps it to a stable error.
- SQL state `23503`: foreign key failure. Confirm test data setup and tenant scoping.
- Prisma known request error: verify repository error translation.
- Skipped tests: environment variables or test runner selection are wrong.

## Redis Validation Procedure

Startup:

```bash
docker compose up -d redis
docker compose ps redis
```

Expected output:

```text
redis   healthy
```

Health check:

```bash
docker compose exec redis redis-cli ping
```

Expected output:

```text
PONG
```

Connection test:

```bash
docker compose exec redis redis-cli set phase19e:connection ok
docker compose exec redis redis-cli get phase19e:connection
docker compose exec redis redis-cli del phase19e:connection
```

Expected output:

```text
OK
ok
1
```

Rate limiter validation:

```bash
RUN_POSTGRES_INTEGRATION=true corepack pnpm exec vitest run apps/api/src/modules/auth/auth.controller.test.ts -t "rate"
```

Pass criteria:

- Authentication rate-limit behavior returns stable throttling responses.
- Redis-backed storage is used in runtime module wiring.
- Production mode does not silently fall back to in-memory rate limiting.

Queue validation:

```bash
corepack pnpm --filter @seneve/worker build
corepack pnpm --filter @seneve/worker dev
```

Pass criteria:

- Worker starts with `REDIS_URL`.
- Worker health endpoint responds.
- No queue startup error appears in logs.

Shutdown:

```bash
docker compose stop redis
docker compose up -d redis
docker compose exec redis redis-cli ping
```

Expected output:

```text
PONG
```

## Smoke-Test Checklist

Record each smoke test with the endpoint or route, result, correlation ID where available, and
server/browser errors.

### API

| Step                              | Expected result                                                | Failure condition                                                |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Health check `GET /api/v1/health` | `200` with status `ok`                                         | Non-2xx response or missing health body                          |
| Register                          | Identity is created; response contains safe public fields only | Password/token/hash is returned; registration fails unexpectedly |
| Login                             | Access token returned; refresh cookie set                      | Refresh token appears in JSON; cookie missing                    |
| Refresh                           | Access token rotates through cookie-backed refresh             | Reused or invalid token succeeds; cookie not replaced            |
| Create organization               | Organization and owner membership created atomically           | Missing owner membership; tenant context error                   |
| Create campaign                   | Campaign belongs to selected organization                      | Cross-tenant creation or wrong organization ID                   |
| Create candidate                  | Candidate belongs to campaign and organization                 | Candidate can attach to another campaign or tenant               |
| Reorder candidate                 | Full order persists atomically                                 | Lost candidate, duplicate position or partial reorder            |
| Logout                            | Session revoked; refresh cookie cleared                        | Session remains valid; cookie not cleared                        |

### Frontend

| Step                   | Expected result                                                              | Failure condition                                        |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Onboarding             | Authenticated user without organization sees creation flow                   | Blank screen or protected content flash                  |
| Campaign creation      | Form submits through API and navigates to created Campaign                   | Raw API error, duplicate local state or missing feedback |
| Campaign settings      | Editable fields match backend lifecycle rules                                | UI allows unsupported field mutation without clear error |
| Candidate management   | List, create, edit and lifecycle actions use API responses                   | Vote/rank/result fields appear                           |
| Permissions            | Restricted controls are hidden or disabled but backend remains authoritative | Role-name checks replace permission checks               |
| Organization switching | Campaign and Candidate data refetches for active organization                | Prior organization data remains visible                  |

## Security Validation Checklist

Use `docs/engineering/SECURITY_REVIEW.md` for the evidence log. Classify each item as
`CONFIRMED`, `REQUIRES CORRECTION` or `DEFERRED`.

### Authentication

- Access tokens are not persisted in local storage or session storage.
- Refresh tokens are stored only in HttpOnly cookies.
- Login validates credentials without leaking account-existence details.
- Suspended identities cannot authenticate or remain authenticated.

### Authorization

- Organization context is resolved server-side.
- Campaign permissions are enforced server-side.
- Candidate permissions are enforced server-side.
- Frontend permission helpers are usability hints only.
- Lifecycle endpoints cannot be invoked without the required permission.

### Cookies

- Refresh cookie is `HttpOnly`.
- Refresh cookie uses `Secure=true` in production.
- Refresh cookie uses the documented `SameSite` value.
- Cookie deletion uses compatible path and attributes.

### Sessions

- Session revocation invalidates access.
- Logout all revokes all active sessions for the identity.
- Session listing returns only safe metadata.

### Refresh Tokens

- Refresh rotation is atomic.
- Token replay triggers the approved revocation behavior.
- Failed refresh clears or invalidates the client cookie where appropriate.

### RLS

- RLS is enabled and forced on organization-scoped tables.
- Campaign and Candidate reads require tenant context.
- Missing tenant context fails closed.
- Platform override requires explicit privileged context.

### Tenant Isolation

- Repository predicates include organization scope.
- Campaign IDs alone cannot bypass tenant isolation.
- Candidate IDs alone cannot bypass tenant or campaign isolation.
- Organization switching clears tenant-scoped frontend data.

### Audit Logs

- Critical identity, organization, campaign and candidate transitions append audit records.
- Audit records contain correlation IDs.
- Reasons are bounded and sanitized.
- No cookies, tokens, headers or raw payloads are written to audit metadata.

### CSRF

- Cookie-authenticated state-changing requests enforce the documented Origin policy.
- Unapproved origins are rejected.
- Development origins are explicitly bounded.

### CORS

- Credentialed requests do not use wildcard origins.
- Configured origins match the frontend runtime origin.
- Rejected origins receive stable public errors.

## Expected Outputs

Successful Phase 19E output must include:

- Clean dependency installation.
- Prisma generation success.
- Prisma schema validation success.
- Migration deployment success.
- PostgreSQL integration tests with no PostgreSQL-gated skips.
- RLS validation evidence.
- Redis health and runtime validation evidence.
- Complete test suite with zero failures.
- Root production build success.
- API smoke-test evidence.
- Frontend smoke-test evidence.
- Runtime security review updated with evidence.
- Clean working tree or dedicated commits for any corrections.

## CI Workflow

The prepared GitHub Actions workflow is:

```text
.github/workflows/ci.yml
```

Required GitHub Actions secrets:

```text
JWT_ACCESS_TOKEN_SECRET
JWT_REFRESH_TOKEN_SECRET
```

The workflow uses non-production PostgreSQL and Redis service credentials for CI. Application token
secrets are read from GitHub Actions secrets and are not hard-coded in the workflow.

## Success Criteria

Phase 19E succeeds only when:

- `corepack pnpm install --frozen-lockfile` passes without tracked changes.
- `corepack pnpm db:generate` passes.
- `corepack pnpm db:validate` passes.
- Migrations apply to a clean PostgreSQL database.
- PostgreSQL integration tests pass without runtime skips.
- RLS tests pass with real database sessions.
- Redis validation passes.
- `corepack pnpm test` passes.
- `corepack pnpm build` passes.
- API smoke tests pass.
- Frontend/browser smoke tests pass.
- Security review findings are documented and high-risk issues are corrected.

## Rollback Procedure

Phase 19E uses disposable local infrastructure. To roll back a failed run:

1. Stop runtime services:

   ```bash
   docker compose down
   ```

2. Remove disposable database and Redis data only when the data belongs to this validation run:

   ```bash
   docker compose down -v
   ```

3. Remove local environment files if they should be regenerated:

   ```bash
   rm .env
   ```

4. Restore the repository to the last committed state:

   ```bash
   git status --short
   ```

   If tracked files changed during a correction, inspect and commit a minimal fix. Do not reset
   away useful diagnostic changes unless they are confirmed generated output.

5. Restart from dependency installation after correcting the root cause.

Do not run rollback commands against shared or production databases.
