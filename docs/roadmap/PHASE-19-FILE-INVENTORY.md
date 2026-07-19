# Phase 19 File Inventory

This inventory supports repository transfer and selective staging once Git metadata writes are
available.

The current working tree contains local implementation batches that must remain separable:

1. Brand integration;
2. Phase 15 frontend Identity and Organizations;
3. Phase 16 Campaign backend foundation;
4. Phase 17 Candidate backend foundation;
5. Phase 18 Campaign and Candidate frontend;
6. Phase 19 stabilization documentation.

Do not treat this inventory as a commit record. No commits have been created for these local batches
in the restricted environment.

## Verified Base

Expected branch:

```text
feature/identity-organizations
```

Expected base commit:

```text
e867803 docs(api): document organization api and authorization
```

## Brand Integration

Principal files:

```text
apps/web/app/globals.css
apps/web/app/layout.tsx
apps/web/app/page.tsx
apps/web/app/loading.tsx
apps/web/app/manifest.ts
apps/web/app/metadata.test.ts
apps/web/components/seneve-logo.tsx
apps/web/components/seneve-logo.test.ts
apps/web/lib/brand.ts
apps/web/lib/brand.test.ts
apps/web/public/brand/apple-touch-icon.png
apps/web/public/brand/favicon-16x16.png
apps/web/public/brand/favicon-32x32.png
apps/web/public/brand/icon-192x192.png
apps/web/public/brand/icon-512x512.png
apps/web/public/brand/master/seneve-logo-source-transparent.png
apps/web/public/brand/master/seneve-logo-source-white-background.png
apps/web/public/brand/seneve-logo-transparent.png
apps/web/public/brand/seneve-logo-white-background.png
apps/web/public/brand/seneve-mark.png
docs/brand/BRAND_ASSET_GUIDELINES.md
docs/ui/DESIGN_SYSTEM.md
```

Cross-cutting files to inspect before staging:

```text
docs/README.md
docs/roadmap/RELEASE_NOTES.md
```

## Phase 15 Frontend Identity And Organizations

Principal files:

```text
apps/web/app/(app)/dashboard/page.tsx
apps/web/app/(app)/layout.tsx
apps/web/app/(app)/organizations/[organizationId]/invitations/page.tsx
apps/web/app/(app)/organizations/[organizationId]/members/page.tsx
apps/web/app/(app)/organizations/[organizationId]/ownership/page.tsx
apps/web/app/(app)/organizations/[organizationId]/page.tsx
apps/web/app/(app)/organizations/page.tsx
apps/web/app/(app)/sessions/page.tsx
apps/web/app/(auth)/forgot-password/page.tsx
apps/web/app/(auth)/layout.tsx
apps/web/app/(auth)/login/page.tsx
apps/web/app/(auth)/register/page.tsx
apps/web/app/(auth)/reset-password/page.tsx
apps/web/app/(auth)/verify-email/page.tsx
apps/web/app/invitation/accept/page.tsx
apps/web/components/auth/auth-card.tsx
apps/web/components/auth/email-verification-panel.tsx
apps/web/components/auth/login-form.tsx
apps/web/components/auth/password-reset-forms.tsx
apps/web/components/auth/register-form.tsx
apps/web/components/feedback/status-message.tsx
apps/web/components/navigation/can.tsx
apps/web/components/navigation/organization-switcher.tsx
apps/web/components/organizations/create-organization-form.tsx
apps/web/components/organizations/invite-member-form.tsx
apps/web/components/ui/form-field.tsx
apps/web/lib/api/auth-api.ts
apps/web/lib/api/client.ts
apps/web/lib/api/client.test.ts
apps/web/lib/api/organization-api.ts
apps/web/lib/api/session-api.ts
apps/web/lib/auth/use-permission.ts
apps/web/providers/app-providers.tsx
apps/web/providers/auth-provider.tsx
apps/web/providers/organization-provider.tsx
docs/ui/AUTHENTICATION_UX.md
docs/ui/ORGANIZATION_UX.md
docs/ui/FRONTEND_ARCHITECTURE.md
```

Cross-cutting files to inspect before staging:

```text
apps/web/components/navigation/app-shell.tsx
apps/web/lib/api/types.ts
apps/web/lib/auth/permissions.ts
apps/web/lib/auth/permissions.test.ts
apps/web/lib/validation/forms.ts
apps/web/lib/validation/forms.test.ts
docs/engineering/TESTING.md
docs/README.md
docs/roadmap/RELEASE_NOTES.md
```

## Phase 16 Campaign Backend Foundation

Principal files:

```text
database/migrations/20260715140000_campaign_foundation/migration.sql
docs/api/CAMPAIGN_API.md
docs/architecture/CAMPAIGN_ARCHITECTURE.md
docs/domain/CAMPAIGN_DOMAIN.md
docs/roadmap/EPIC-003-CAMPAIGNS-PLAN.md
packages/campaign-application/package.json
packages/campaign-application/src/application-error.ts
packages/campaign-application/src/campaign-application-service.test.ts
packages/campaign-application/src/campaign-application-service.ts
packages/campaign-application/src/contracts.ts
packages/campaign-application/src/index.ts
packages/campaign-application/tsconfig.json
packages/campaign-persistence/package.json
packages/campaign-persistence/src/index.ts
packages/campaign-persistence/src/prisma-campaign-repository.ts
packages/campaign-persistence/tsconfig.json
packages/domain/campaign/package.json
packages/domain/campaign/src/campaign.test.ts
packages/domain/campaign/src/campaign.ts
packages/domain/campaign/src/domain-error.ts
packages/domain/campaign/src/domain-event.ts
packages/domain/campaign/src/index.ts
packages/domain/campaign/src/repository.ts
packages/domain/campaign/src/value-objects.ts
packages/domain/campaign/tsconfig.json
apps/api/src/modules/campaigns/campaign.controller.test.ts
apps/api/src/modules/campaigns/campaign.controller.ts
apps/api/src/modules/campaigns/campaign.module.ts
apps/api/src/modules/campaigns/campaign.tokens.ts
apps/api/src/modules/campaigns/dto/campaign.dto.ts
apps/api/src/modules/campaigns/mappers/campaign-error.mapper.ts
apps/api/src/modules/campaigns/mappers/campaign-response.mapper.ts
```

Cross-cutting files to inspect before staging:

```text
apps/api/package.json
apps/api/src/app.module.ts
database/prisma/schema.prisma
docs/database/DATABASE_SCHEMA.md
packages/audit-application/package.json
packages/audit-application/src/audit-integrations.ts
packages/audit-application/src/event-mappers.ts
packages/authorization-application/src/permission-catalogue.ts
packages/domain/audit/src/audit-taxonomy.ts
tsconfig.base.json
vitest.config.ts
docs/roadmap/RELEASE_NOTES.md
```

## Phase 17 Candidate Backend Foundation

Principal files:

```text
database/migrations/20260715150000_candidate_foundation/migration.sql
docs/api/CANDIDATE_API.md
docs/architecture/CANDIDATE_ARCHITECTURE.md
docs/domain/CANDIDATE_DOMAIN.md
packages/candidate-application/package.json
packages/candidate-application/src/application-error.ts
packages/candidate-application/src/candidate-application-service.test.ts
packages/candidate-application/src/candidate-application-service.ts
packages/candidate-application/src/contracts.ts
packages/candidate-application/src/index.ts
packages/candidate-application/tsconfig.json
packages/candidate-persistence/package.json
packages/candidate-persistence/src/index.ts
packages/candidate-persistence/src/prisma-candidate-repository.integration.test.ts
packages/candidate-persistence/src/prisma-candidate-repository.ts
packages/candidate-persistence/tsconfig.json
packages/domain/candidate/package.json
packages/domain/candidate/src/candidate.test.ts
packages/domain/candidate/src/candidate.ts
packages/domain/candidate/src/domain-error.ts
packages/domain/candidate/src/domain-event.ts
packages/domain/candidate/src/index.ts
packages/domain/candidate/src/repository.ts
packages/domain/candidate/src/value-objects.ts
packages/domain/candidate/tsconfig.json
apps/api/src/modules/candidates/candidate.controller.test.ts
apps/api/src/modules/candidates/candidate.controller.ts
apps/api/src/modules/candidates/candidate.module.ts
apps/api/src/modules/candidates/candidate.tokens.ts
apps/api/src/modules/candidates/dto/candidate.dto.ts
apps/api/src/modules/candidates/mappers/candidate-error.mapper.ts
apps/api/src/modules/candidates/mappers/candidate-response.mapper.ts
```

Cross-cutting files to inspect before staging:

```text
apps/api/package.json
apps/api/src/app.module.ts
database/prisma/schema.prisma
docs/database/DATABASE_SCHEMA.md
docs/roadmap/EPIC-003-CAMPAIGNS-PLAN.md
packages/audit-application/src/event-mappers.ts
packages/authorization-application/src/permission-catalogue.ts
packages/domain/audit/src/audit-taxonomy.ts
tsconfig.base.json
vitest.config.ts
docs/roadmap/RELEASE_NOTES.md
```

## Phase 18 Campaign And Candidate Frontend

Principal files:

```text
apps/web/app/(app)/campaigns/[campaignId]/candidates/[candidateId]/page.tsx
apps/web/app/(app)/campaigns/[campaignId]/candidates/new/page.tsx
apps/web/app/(app)/campaigns/[campaignId]/candidates/page.tsx
apps/web/app/(app)/campaigns/[campaignId]/page.tsx
apps/web/app/(app)/campaigns/[campaignId]/settings/page.tsx
apps/web/app/(app)/campaigns/new/page.tsx
apps/web/app/(app)/campaigns/page.tsx
apps/web/components/campaigns/campaign-badge.tsx
apps/web/components/campaigns/campaign-form.tsx
apps/web/components/campaigns/campaign-lifecycle-actions.tsx
apps/web/components/campaigns/campaign-rules-form.tsx
apps/web/components/candidates/candidate-form.tsx
apps/web/components/candidates/candidate-lifecycle-actions.tsx
apps/web/components/candidates/candidate-reorder-list.tsx
apps/web/lib/api/campaign-api.ts
apps/web/lib/api/campaign-candidate-api.test.ts
apps/web/lib/api/candidate-api.ts
apps/web/lib/campaigns/status.test.ts
apps/web/lib/campaigns/status.ts
docs/ui/CAMPAIGN_MANAGEMENT_UX.md
docs/ui/CANDIDATE_MANAGEMENT_UX.md
```

Cross-cutting files to inspect before staging:

```text
apps/web/components/navigation/app-shell.tsx
apps/web/lib/api/types.ts
apps/web/lib/auth/permissions.ts
apps/web/lib/auth/permissions.test.ts
apps/web/lib/validation/forms.ts
apps/web/lib/validation/forms.test.ts
docs/ui/FRONTEND_ARCHITECTURE.md
docs/ui/DESIGN_SYSTEM.md
docs/engineering/TESTING.md
docs/roadmap/EPIC-003-CAMPAIGNS-PLAN.md
docs/roadmap/RELEASE_NOTES.md
docs/README.md
```

## Phase 19 Stabilization Documentation

Principal files:

```text
docs/engineering/CI.md
docs/engineering/POSTGRESQL_RLS_VALIDATION.md
docs/engineering/REDIS_VALIDATION.md
docs/engineering/RUNTIME_VALIDATION.md
docs/engineering/SECURITY_REVIEW.md
docs/roadmap/PHASE-19-FILE-INVENTORY.md
docs/roadmap/PHASE-19-STABILIZATION.md
```

Cross-cutting files to inspect before staging:

```text
docs/README.md
docs/roadmap/RELEASE_NOTES.md
```

## Commit Guidance

Commit the batches in this order:

1. Brand integration;
2. Phase 15 frontend Identity and Organizations;
3. Phase 16 Campaign backend;
4. Phase 17 Candidate backend;
5. Phase 18 Campaign and Candidate frontend;
6. Phase 19 stabilization documentation.

After every commit, run:

```bash
git status --short
git show --stat --oneline HEAD
```

The final state before runtime validation should be a clean working tree.
