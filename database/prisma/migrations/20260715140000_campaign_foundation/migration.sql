CREATE TYPE "CampaignStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED'
);

CREATE TYPE "CampaignVisibility" AS ENUM (
  'PRIVATE',
  'UNLISTED',
  'PUBLIC'
);

CREATE TYPE "CampaignVotingMode" AS ENUM (
  'FREE',
  'PAID',
  'HYBRID'
);

CREATE TYPE "CampaignResultsVisibility" AS ENUM (
  'HIDDEN',
  'LIVE',
  'AFTER_CAMPAIGN',
  'SCHEDULED'
);

CREATE TABLE "campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "status" "CampaignStatus" NOT NULL,
  "visibility" "CampaignVisibility" NOT NULL,
  "timezone" text NOT NULL,
  "locale" text NOT NULL,
  "starts_at" timestamptz(6) NOT NULL,
  "ends_at" timestamptz(6) NOT NULL,
  "voting_mode" "CampaignVotingMode" NOT NULL,
  "votes_per_voter" integer NOT NULL,
  "allow_multiple_candidates" boolean NOT NULL,
  "requires_email_verification" boolean NOT NULL,
  "results_visibility" "CampaignResultsVisibility" NOT NULL,
  "result_reveal_at" timestamptz(6),
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  "archived_at" timestamptz(6),
  "cancelled_at" timestamptz(6),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "campaigns_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "campaigns_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "identities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ck_campaigns_slug_normalized"
    CHECK ("slug" = lower(btrim("slug")) AND "slug" ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'),
  CONSTRAINT "ck_campaigns_name_length"
    CHECK (char_length(btrim("name")) BETWEEN 2 AND 160),
  CONSTRAINT "ck_campaigns_schedule"
    CHECK ("starts_at" < "ends_at"),
  CONSTRAINT "ck_campaigns_votes_per_voter"
    CHECK ("votes_per_voter" BETWEEN 1 AND 100),
  CONSTRAINT "ck_campaigns_results_visibility"
    CHECK (
      ("results_visibility" = 'SCHEDULED' AND "result_reveal_at" IS NOT NULL)
      OR ("results_visibility" <> 'SCHEDULED' AND "result_reveal_at" IS NULL)
    ),
  CONSTRAINT "ck_campaigns_archived_at"
    CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL) OR "status" <> 'ARCHIVED'),
  CONSTRAINT "ck_campaigns_cancelled_at"
    CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL) OR "status" <> 'CANCELLED')
);

CREATE UNIQUE INDEX "uq_campaigns_organization_slug"
  ON "campaigns"("organization_id", "slug");

CREATE INDEX "idx_campaigns_organization_id"
  ON "campaigns"("organization_id");

CREATE INDEX "idx_campaigns_organization_status"
  ON "campaigns"("organization_id", "status");

CREATE INDEX "idx_campaigns_organization_visibility"
  ON "campaigns"("organization_id", "visibility");

CREATE INDEX "idx_campaigns_organization_created_id"
  ON "campaigns"("organization_id", "created_at", "id");

CREATE INDEX "idx_campaigns_organization_starts_at"
  ON "campaigns"("organization_id", "starts_at");

ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_tenant_select_policy"
  ON "campaigns"
  FOR SELECT
  USING (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "campaigns_tenant_insert_policy"
  ON "campaigns"
  FOR INSERT
  WITH CHECK (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "campaigns_tenant_update_policy"
  ON "campaigns"
  FOR UPDATE
  USING (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  )
  WITH CHECK (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "campaigns_tenant_delete_policy"
  ON "campaigns"
  FOR DELETE
  USING (false);
