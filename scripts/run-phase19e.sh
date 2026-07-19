#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PID=""
WEB_PID=""
WORKER_PID=""

cleanup() {
  for pid in "$API_PID" "$WEB_PID" "$WORKER_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    return 1
  fi
}

require_env() {
  local variable_name="$1"

  if [[ -z "${!variable_name:-}" ]]; then
    printf 'Missing required environment variable: %s\n' "$variable_name" >&2
    return 1
  fi
}

run() {
  printf '\n==> %s\n' "$*"
  "$@"
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"

  printf '\n==> Waiting for %s at %s\n' "$name" "$url"
  for _ in $(seq 1 "$attempts"); do
    if curl --fail --silent --show-error "$url" >/dev/null; then
      printf '%s is ready\n' "$name"
      return 0
    fi
    sleep 2
  done

  printf '%s did not become ready at %s\n' "$name" "$url" >&2
  return 1
}

require_command git
require_command node
require_command corepack
require_command docker
require_command curl

run docker compose version

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
else
  printf 'Missing .env. Create one from .env.example or export the required variables before running Phase 19E.\n' >&2
  exit 1
fi

export RUN_POSTGRES_INTEGRATION="${RUN_POSTGRES_INTEGRATION:-true}"
export NODE_ENV="${NODE_ENV:-test}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export API_PORT="${API_PORT:-3000}"
export WEB_PORT="${WEB_PORT:-3001}"
export WORKER_HEALTH_PORT="${WORKER_HEALTH_PORT:-3002}"
export AUTH_COOKIE_SECURE="${AUTH_COOKIE_SECURE:-false}"
export OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-seneve-phase19e}"

require_env DATABASE_URL
require_env REDIS_URL
require_env JWT_ACCESS_TOKEN_SECRET
require_env JWT_REFRESH_TOKEN_SECRET
require_env JWT_ACCESS_TOKEN_ISSUER
require_env JWT_ACCESS_TOKEN_AUDIENCE
require_env CORS_ORIGINS

API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:${WEB_PORT}}"
WORKER_HEALTH_URL="${WORKER_HEALTH_URL:-http://localhost:${WORKER_HEALTH_PORT}}"

if [[ -n "$(git status --short)" ]]; then
  printf 'Working tree must be clean before Phase 19E runtime validation.\n' >&2
  git status --short >&2
  exit 1
fi

run corepack enable
run corepack pnpm install --frozen-lockfile
run corepack pnpm db:generate
run corepack pnpm db:validate

run docker compose up -d postgres redis
run docker compose exec -T postgres pg_isready -U seneve -d seneve
run docker compose exec -T redis redis-cli ping

run corepack pnpm exec prisma migrate deploy --schema database/prisma/schema.prisma
run corepack pnpm exec prisma migrate status --schema database/prisma/schema.prisma

run corepack pnpm exec vitest run packages/identity-persistence packages/organization-persistence packages/audit-persistence packages/campaign-persistence packages/candidate-persistence
run corepack pnpm exec vitest run packages/organization-persistence/src/tenant-rls-transaction.integration.test.ts

run docker compose exec -T redis redis-cli set phase19e:connection ok
run docker compose exec -T redis redis-cli get phase19e:connection
run docker compose exec -T redis redis-cli del phase19e:connection
run corepack pnpm exec vitest run apps/api/src/modules/auth/auth.controller.test.ts -t rate

run corepack pnpm test
run corepack pnpm build

printf '\n==> Starting runtime smoke services\n'
corepack pnpm --filter @seneve/api dev > /tmp/seneve-phase19e-api.log 2>&1 &
API_PID="$!"
corepack pnpm --filter @seneve/worker dev > /tmp/seneve-phase19e-worker.log 2>&1 &
WORKER_PID="$!"
corepack pnpm --filter @seneve/web dev > /tmp/seneve-phase19e-web.log 2>&1 &
WEB_PID="$!"

wait_for_url "$API_BASE_URL/api/v1/health" "API health"
wait_for_url "$API_BASE_URL/api/v1/ready" "API readiness"
wait_for_url "$WORKER_HEALTH_URL" "Worker health"
wait_for_url "$WEB_BASE_URL" "Web app"

printf '\n==> Phase 19E automated checks completed\n'
printf 'Run the manual business-flow smoke checklist in docs/engineering/PHASE-19E-EXECUTION.md before closing Phase 19.\n'
