CREATE TYPE "VoteAttemptStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "vote_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "candidate_id" uuid NOT NULL,
  "voter_identity_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "status" "VoteAttemptStatus" NOT NULL,
  "rejection_code" text,
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "confirmed_at" timestamptz(6),
  "rejected_at" timestamptz(6),
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "vote_attempts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vote_attempts_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vote_attempts_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vote_attempts_voter_identity_id_fkey"
    FOREIGN KEY ("voter_identity_id") REFERENCES "identities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ck_vote_attempts_status_timestamps"
    CHECK (
      ("status" = 'PENDING' AND "confirmed_at" IS NULL AND "rejected_at" IS NULL AND "rejection_code" IS NULL)
      OR ("status" = 'CONFIRMED' AND "confirmed_at" IS NOT NULL AND "rejected_at" IS NULL AND "rejection_code" IS NULL)
      OR ("status" = 'REJECTED' AND "confirmed_at" IS NULL AND "rejected_at" IS NOT NULL AND NULLIF(btrim("rejection_code"), '') IS NOT NULL)
    ),
  CONSTRAINT "ck_vote_attempts_rejection_code_length"
    CHECK ("rejection_code" IS NULL OR char_length("rejection_code") <= 120),
  CONSTRAINT "ck_vote_attempts_version" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "uq_vote_attempts_request"
  ON "vote_attempts"("organization_id", "campaign_id", "voter_identity_id", "request_id");

CREATE INDEX "idx_vote_attempts_voter_status"
  ON "vote_attempts"("organization_id", "campaign_id", "voter_identity_id", "status");

CREATE INDEX "idx_vote_attempts_candidate_status"
  ON "vote_attempts"("organization_id", "campaign_id", "candidate_id", "status");

CREATE INDEX "idx_vote_attempts_organization_created"
  ON "vote_attempts"("organization_id", "created_at", "id");

CREATE OR REPLACE FUNCTION app.prevent_finalized_vote_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" IN ('CONFIRMED', 'REJECTED') THEN
    RAISE EXCEPTION 'finalized vote attempts are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.prevent_vote_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'vote attempts cannot be deleted';
END;
$$;

CREATE TRIGGER "trg_vote_attempts_no_finalized_update"
BEFORE UPDATE ON "vote_attempts"
FOR EACH ROW EXECUTE FUNCTION app.prevent_finalized_vote_mutation();

CREATE TRIGGER "trg_vote_attempts_no_delete"
BEFORE DELETE ON "vote_attempts"
FOR EACH ROW EXECUTE FUNCTION app.prevent_vote_deletion();

ALTER TABLE "vote_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vote_attempts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "vote_attempts_owner_select_policy"
  ON "vote_attempts"
  FOR SELECT
  USING (
    app.is_platform_admin_context()
    OR (
      app.current_setting_text('app.execution_mode') = 'AUTHENTICATED'
      AND app.current_tenant_id() = "organization_id"
      AND app.current_setting_text('app.identity_id')::uuid = "voter_identity_id"
      AND app.current_setting_text('app.operation') = 'VOTE_SUBMISSION'
    )
  );

CREATE POLICY "vote_attempts_owner_insert_policy"
  ON "vote_attempts"
  FOR INSERT
  WITH CHECK (
    app.is_platform_admin_context()
    OR (
      app.current_setting_text('app.execution_mode') = 'AUTHENTICATED'
      AND app.current_tenant_id() = "organization_id"
      AND app.current_setting_text('app.identity_id')::uuid = "voter_identity_id"
      AND app.current_setting_text('app.operation') = 'VOTE_SUBMISSION'
    )
  );

CREATE POLICY "audit_records_voting_insert_policy"
  ON "audit_records"
  FOR INSERT
  WITH CHECK (
    app.current_setting_text('app.execution_mode') = 'AUTHENTICATED'
    AND app.current_tenant_id() = "tenant_id"
    AND app.current_setting_text('app.identity_id')::uuid = "actor_identity_id"
    AND app.current_setting_text('app.operation') = 'VOTE_SUBMISSION'
  );

CREATE POLICY "audit_records_voting_select_policy"
  ON "audit_records"
  FOR SELECT
  USING (
    app.current_setting_text('app.execution_mode') = 'AUTHENTICATED'
    AND app.current_tenant_id() = "tenant_id"
    AND app.current_setting_text('app.operation') = 'VOTE_SUBMISSION'
  );
