# Phase 19 - Runtime Stabilization and Repository Recovery

Phase 19 is not a feature-development phase.

It exists to validate and stabilize the implemented Brand, Identity, Organization, Campaign and
Candidate work before the Voting bounded context begins.

## Current Status

Phase 19 is open.

Completed in the current restricted environment:

- verified branch: `feature/identity-organizations`;
- verified latest existing commit: `e867803 docs(api): document organization api and authorization`;
- created preservation archive for Brand through Phase 18 local changes;
- recorded local environment versions for transfer diagnostics;
- added a categorized file inventory for selective staging in a writable Git environment;
- reran static validation;
- reran focused non-runtime tests.

Blocked in the current restricted environment:

- Git metadata writes;
- selective commit creation;
- full test suite with runtime services;
- production build;
- PostgreSQL validation;
- RLS validation;
- Redis validation;
- API and web runtime smoke tests;
- GitHub publication;
- remote CI.

## Preservation Archive

Archive:

```text
/tmp/seneve-preservation/seneve-brand-phase15-phase16-phase17-phase18.tar.gz
```

SHA-256:

```text
4cfd272396e9aefcdb45c41c2e1e2bb7e3552ded0baee415cda4247ffe1a8ba8
```

Archived file-list entries:

```text
167
```

Generated directories and runtime files were excluded.

## Static Validation

The following checks passed in the current restricted environment:

```bash
corepack pnpm db:generate
corepack pnpm db:validate
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
```

Focused non-runtime tests passed:

```text
14 files
37 tests
```

## Local Environment Diagnostics

The restricted environment used for the interim Phase 19 work reported:

```text
Operating system: Darwin arm64, kernel 25.5.0
Node.js: v24.14.0
pnpm: 10.14.0
Git: 2.50.1 (Apple Git-155)
```

The repository declares:

```text
Node.js: >=22.0.0
Package manager: pnpm@10.14.0
```

The installed Node.js 24 runtime satisfies the declared project requirement. Authoritative final
validation should still use a project-supported Node.js version rather than changing the supported
runtime to match one local machine.

These diagnostics do not replace validation in the eventual runtime environment.

## Git Write Probe

Phase 19B tested Git metadata writability with a non-destructive probe file under `.git`.

Result:

```text
blocked
```

Failing command:

```text
printf 'phase-19b-write-probe\n' > .git/seneve-write-probe
```

Observed error:

```text
operation not permitted: .git/seneve-write-probe
```

Repository path:

```text
/Users/johnzidah/Documents/Codex/2026-07-14/you-are-the-lead-software-architect
```

Verified state:

```text
Branch: feature/identity-organizations
Base commit: e867803 docs(api): document organization api and authorization
Git dir: .git
index.lock: absent
```

Permission diagnostics:

```text
.git owner/group/mode: johnzidah staff drwxr-xr-x
.git/index owner/group/mode: johnzidah staff -rw-r--r--
Extended attribute: com.apple.provenance
Filesystem: APFS mounted at /System/Volumes/Data
```

No destructive repair was attempted. Git recovery remains blocked in this environment.

## File Inventory

The categorized transfer inventory is maintained in:

```text
docs/roadmap/PHASE-19-FILE-INVENTORY.md
```

## Completion Criteria

Phase 19 can close only when:

- Git write access is restored;
- Brand, Phase 15, Phase 16, Phase 17 and Phase 18 batches are committed in order;
- the working tree is clean;
- the full test suite executes;
- the production build executes;
- PostgreSQL migrations are validated;
- RLS behavior is validated;
- Redis behavior is validated;
- runtime smoke tests are completed;
- the security review is documented;
- GitHub remote and CI status are reported.

## Voting Gate

Voting, Ballot, Payment, Fraud, public Campaign pages, public Candidate pages, rankings and results
remain prohibited until Phase 19 is reviewed and closed.
