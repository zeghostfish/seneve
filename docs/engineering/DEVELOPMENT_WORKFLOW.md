# Development Workflow

## Standard Epic Lifecycle

Every Epic follows the same lifecycle:

1. Analyze requirements.
2. Produce an implementation plan.
3. Identify architectural impacts.
4. Implement incrementally.
5. Write automated tests.
6. Execute all tests.
7. Update documentation.
8. Commit using Conventional Commits.
9. Push to GitHub immediately.
10. Update milestone progress and release notes.

## Branching

Never work directly on the main branch.

Branch names:

- `feature/...`
- `bugfix/...`
- `hotfix/...`
- `refactor/...`
- `docs/...`
- `test/...`

Epic 001 branch:

```text
feature/foundation
```

## Commits

Use Conventional Commits.

Examples:

```text
feat(foundation): initialize monorepo structure
ci(foundation): add GitHub Actions quality checks
docs(architecture): document campaign-centric architecture
```

Commits must be small, atomic, and descriptive.

## Pull Requests

Every PR must include:

- summary
- impacted modules
- architecture notes
- migrations, if any
- tests performed
- documentation updated
- known limitations
- deployment notes

## Definition of Done

A task is complete only when:

- implementation is finished
- tests pass
- documentation is updated
- audit and security impacts are considered
- code is committed
- branch is pushed to GitHub
- PR is ready or updated

## Documentation Rule

Documentation is part of implementation.

If behavior changes, the relevant documentation must change in the same Epic.

