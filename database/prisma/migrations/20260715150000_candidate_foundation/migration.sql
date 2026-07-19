CREATE TYPE "CandidateStatus" AS ENUM (
  'DRAFT',
  'ELIGIBLE',
  'SUSPENDED',
  'WITHDRAWN',
  'DISQUALIFIED',
  'ARCHIVED'
);

CREATE TABLE "candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "slug" text NOT NULL,
  "short_description" text,
  "description" text,
  "status" "CandidateStatus" NOT NULL,
  "position" integer NOT NULL,
  "image_asset_id" text,
  "external_reference" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL,
  "status_reason" text,
  "archived_at" timestamptz(6),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "candidates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "candidates_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "candidates_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "identities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ck_candidates_slug_normalized"
    CHECK ("slug" = lower(btrim("slug")) AND "slug" ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$'),
  CONSTRAINT "ck_candidates_display_name_length"
    CHECK (char_length(btrim("display_name")) BETWEEN 2 AND 160),
  CONSTRAINT "ck_candidates_position"
    CHECK ("position" > 0 AND "position" <= 10000),
  CONSTRAINT "ck_candidates_short_description_length"
    CHECK ("short_description" IS NULL OR char_length("short_description") <= 280),
  CONSTRAINT "ck_candidates_description_length"
    CHECK ("description" IS NULL OR char_length("description") <= 4000),
  CONSTRAINT "ck_candidates_status_reason_length"
    CHECK ("status_reason" IS NULL OR char_length("status_reason") <= 500),
  CONSTRAINT "ck_candidates_metadata_object"
    CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "ck_candidates_archived_at"
    CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL) OR "status" <> 'ARCHIVED')
);

CREATE UNIQUE INDEX "uq_candidates_campaign_slug"
  ON "candidates"("campaign_id", "slug");

ALTER TABLE "candidates"
  ADD CONSTRAINT "uq_candidates_campaign_position"
  UNIQUE ("campaign_id", "position")
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX "idx_candidates_organization_campaign"
  ON "candidates"("organization_id", "campaign_id");

CREATE INDEX "idx_candidates_organization_campaign_status"
  ON "candidates"("organization_id", "campaign_id", "status");

CREATE INDEX "idx_candidates_campaign_position_created_id"
  ON "candidates"("campaign_id", "position", "created_at", "id");

CREATE INDEX "idx_candidates_organization_created_at"
  ON "candidates"("organization_id", "created_at");

ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "candidates_tenant_select_policy"
  ON "candidates"
  FOR SELECT
  USING (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "candidates_tenant_insert_policy"
  ON "candidates"
  FOR INSERT
  WITH CHECK (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "candidates_tenant_update_policy"
  ON "candidates"
  FOR UPDATE
  USING (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  )
  WITH CHECK (
    app.is_platform_admin_context()
    OR app.current_tenant_id() = "organization_id"
  );

CREATE POLICY "candidates_tenant_delete_policy"
  ON "candidates"
  FOR DELETE
  USING (false);
