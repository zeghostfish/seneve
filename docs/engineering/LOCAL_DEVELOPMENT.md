# Local Development

## Requirements

- Node.js 24 or newer
- Corepack
- Docker and Docker Compose for local PostgreSQL and Redis

## Setup

Install dependencies:

```bash
corepack pnpm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Validate the Prisma schema:

```bash
corepack pnpm db:validate
```

## Run Local Infrastructure

Start PostgreSQL and Redis:

```bash
docker compose up postgres redis
```

The local defaults are:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Run Applications

Start API, web, and worker:

```bash
corepack pnpm dev
```

Default ports:

- API: `http://localhost:3000/api/v1/health`
- API docs: `http://localhost:3000/api/docs`
- Web: `http://localhost:3001`
- Worker health: `http://localhost:3002`

## Quality Checks

Run all local checks:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Epic 001 Constraint

Do not add business functionality during Epic 001.

Foundation code may include application shells, health checks, configuration, logging, and infrastructure only.
