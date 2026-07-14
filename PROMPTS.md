# SENEVE - AI Prompt Library

This file provides standard prompts for AI-assisted development.

Every prompt assumes the agent has read:

- `AGENTS.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/MODULE_BOUNDARIES.md`
- `docs/adr/ADR-INDEX.md`
- relevant module documentation

## Understand the Project

```text
Read the project documentation.

Summarize:
- Product Vision
- Business Objectives
- Architecture
- Main Modules
- Domain Model
- Development Workflow

Identify ambiguities before implementing code.
```

## Plan a Feature

```text
Analyze the requested feature.

Identify:
- impacted modules
- business rules
- database changes
- API changes
- UI changes
- tests required
- documentation updates

Produce a detailed implementation plan.

Do not write code yet if business rules are unclear.
```

## Implement a Feature

```text
Implement the approved feature.

Requirements:
- preserve architecture
- avoid duplicated logic
- respect documented business rules
- write tests
- update documentation

Return:
- implementation summary
- impacted files
- migration requirements
- risks
- tests executed
```

## Create Database Migration

```text
Generate a migration.

Requirements:
- constraints
- indexes
- tenant isolation
- RLS policies where applicable
- rollback guidance where practical
- documentation updates

Explain every change.
```

## Code Review

```text
Review the implementation.

Verify:
- architecture
- readability
- security
- performance
- maintainability
- duplicated code
- naming consistency
- documentation
- tests

Lead with findings and risks.
```

## End of Milestone

```text
The milestone is complete.

Verify:
- implementation
- tests
- documentation
- release notes
- migration readiness
- deployment readiness
- GitHub branch and Pull Request state

Return a deployment checklist and recommended next milestone.
```

