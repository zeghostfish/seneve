-- Generic immutable audit persistence.
-- Rollback guidance:
--   DROP TABLE IF EXISTS "audit_records";
--   DROP FUNCTION IF EXISTS app.prevent_audit_record_mutation();
-- Audit records are historical facts. Production recovery must preserve exported evidence before destructive rollback.

CREATE TABLE "audit_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "stream_type" TEXT NOT NULL,
    "stream_id" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_identity_id" UUID,
    "actor_membership_id" UUID,
    "execution_mode" TEXT NOT NULL,
    "execution_source" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason_code" TEXT,
    "correlation_id" TEXT NOT NULL,
    "request_id" TEXT,
    "job_id" TEXT,
    "privileged" BOOLEAN NOT NULL DEFAULT false,
    "privileged_reason" TEXT,
    "retention_category" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "previous_record_hash" TEXT,
    "record_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_audit_records_stream_sequence"
ON "audit_records"("stream_type", "stream_id", "sequence_number");

CREATE UNIQUE INDEX "uq_audit_records_record_hash"
ON "audit_records"("record_hash");

CREATE INDEX "idx_audit_records_tenant_occurred_at"
ON "audit_records"("tenant_id", "occurred_at");

CREATE INDEX "idx_audit_records_event_occurred_at"
ON "audit_records"("event_name", "occurred_at");

CREATE INDEX "idx_audit_records_actor_occurred_at"
ON "audit_records"("actor_identity_id", "occurred_at");

CREATE INDEX "idx_audit_records_resource_occurred_at"
ON "audit_records"("resource_type", "resource_id", "occurred_at");

CREATE INDEX "idx_audit_records_correlation_id"
ON "audit_records"("correlation_id");

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_stream_type"
CHECK ("stream_type" IN ('TENANT', 'PLATFORM'));

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_actor_type"
CHECK ("actor_type" IN ('IDENTITY', 'PLATFORM_ADMIN', 'SYSTEM', 'ANONYMOUS', 'API_CLIENT'));

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_outcome"
CHECK ("outcome" IN ('SUCCEEDED', 'DENIED', 'FAILED'));

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_retention_category"
CHECK ("retention_category" IN ('SECURITY_CRITICAL', 'GOVERNANCE', 'FINANCIAL_FUTURE', 'OPERATIONAL'));

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_sequence_positive"
CHECK ("sequence_number" > 0);

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_hash_format"
CHECK (
  "record_hash" LIKE 'sha256:%'
  AND ("previous_record_hash" IS NULL OR "previous_record_hash" LIKE 'sha256:%')
);

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_platform_stream"
CHECK (
  ("stream_type" = 'TENANT' AND "tenant_id" IS NOT NULL AND "stream_id" = "tenant_id"::text)
  OR ("stream_type" = 'PLATFORM' AND "tenant_id" IS NULL)
);

ALTER TABLE "audit_records" ADD CONSTRAINT "chk_audit_records_privileged_reason"
CHECK ("privileged" = false OR NULLIF(btrim("privileged_reason"), '') IS NOT NULL);

CREATE OR REPLACE FUNCTION app.prevent_audit_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_records are immutable';
END;
$$;

CREATE TRIGGER "trg_audit_records_no_update"
BEFORE UPDATE ON "audit_records"
FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_record_mutation();

CREATE TRIGGER "trg_audit_records_no_delete"
BEFORE DELETE ON "audit_records"
FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_record_mutation();

ALTER TABLE "audit_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_records_tenant_select_policy"
ON "audit_records"
FOR SELECT
USING (
  ("tenant_id" IS NOT NULL AND app.can_access_organization("tenant_id"))
  OR ("tenant_id" IS NULL AND app.is_privileged_platform_context())
);

CREATE POLICY "audit_records_tenant_insert_policy"
ON "audit_records"
FOR INSERT
WITH CHECK (
  ("tenant_id" IS NOT NULL AND app.can_access_organization("tenant_id"))
  OR ("tenant_id" IS NULL AND app.is_privileged_platform_context())
);
