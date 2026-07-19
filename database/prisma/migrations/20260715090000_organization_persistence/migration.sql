-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMINISTRATOR', 'EVENT_MANAGER', 'FINANCE_MANAGER', 'CONTENT_MANAGER', 'VIEWER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "public_id" TEXT,
    "display_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "default_locale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "normalized_recipient_email" TEXT NOT NULL,
    "intended_role" "OrganizationRole" NOT NULL,
    "status" "OrganizationInvitationStatus" NOT NULL,
    "token_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "status" "OrganizationMembershipStatus" NOT NULL,
    "invitation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "activated_at" TIMESTAMPTZ(6) NOT NULL,
    "suspended_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),
    "last_changed_by" UUID NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_organizations_public_id" ON "organizations"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_organizations_slug" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "idx_organizations_status" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "idx_org_invitations_organization_status" ON "organization_invitations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_org_invitations_email_status" ON "organization_invitations"("normalized_recipient_email", "status");

-- CreateIndex
CREATE INDEX "idx_org_invitations_expires_at" ON "organization_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_invitations_token_id" ON "organization_invitations"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_invitations_token_hash" ON "organization_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_invitations_pending_email"
ON "organization_invitations"("organization_id", "normalized_recipient_email")
WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "idx_org_memberships_organization_status" ON "organization_memberships"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_org_memberships_identity_status" ON "organization_memberships"("identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_org_memberships_organization_role_status" ON "organization_memberships"("organization_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_org_memberships_active_identity"
ON "organization_memberships"("organization_id", "identity_id")
WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "organization_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariant checks.
ALTER TABLE "organizations" ADD CONSTRAINT "chk_organizations_slug_format"
CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$');

ALTER TABLE "organizations" ADD CONSTRAINT "chk_organizations_display_name_not_blank"
CHECK (length(btrim("display_name")) >= 2);

ALTER TABLE "organizations" ADD CONSTRAINT "chk_organizations_status_timestamps"
CHECK (
  ("status" = 'DRAFT' AND "activated_at" IS NULL AND "suspended_at" IS NULL AND "closed_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'ACTIVE' AND "closed_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'SUSPENDED' AND "suspended_at" IS NOT NULL AND "closed_at" IS NULL AND "archived_at" IS NULL)
  OR ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "archived_at" IS NULL)
  OR ("status" = 'ARCHIVED' AND "closed_at" IS NOT NULL AND "archived_at" IS NOT NULL)
);

ALTER TABLE "organizations" ADD CONSTRAINT "chk_organizations_timestamp_order"
CHECK (
  ("activated_at" IS NULL OR "activated_at" >= "created_at")
  AND ("suspended_at" IS NULL OR "suspended_at" >= "created_at")
  AND ("closed_at" IS NULL OR "closed_at" >= "created_at")
  AND ("archived_at" IS NULL OR "archived_at" >= "created_at")
);

ALTER TABLE "organization_memberships" ADD CONSTRAINT "chk_org_memberships_status_timestamps"
CHECK (
  ("status" = 'ACTIVE' AND "removed_at" IS NULL)
  OR ("status" = 'SUSPENDED' AND "suspended_at" IS NOT NULL AND "removed_at" IS NULL)
  OR ("status" = 'REMOVED' AND "removed_at" IS NOT NULL)
);

ALTER TABLE "organization_memberships" ADD CONSTRAINT "chk_org_memberships_activation_order"
CHECK (
  "activated_at" >= "created_at"
  AND ("suspended_at" IS NULL OR "suspended_at" >= "activated_at")
  AND ("removed_at" IS NULL OR "removed_at" >= "activated_at")
);

ALTER TABLE "organization_invitations" ADD CONSTRAINT "chk_org_invitations_email_format"
CHECK ("normalized_recipient_email" = lower(btrim("normalized_recipient_email")) AND "normalized_recipient_email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

ALTER TABLE "organization_invitations" ADD CONSTRAINT "chk_org_invitations_hash_format"
CHECK ("token_hash" LIKE 'hmac-sha256:%' OR "token_hash" LIKE 'sha256:%');

ALTER TABLE "organization_invitations" ADD CONSTRAINT "chk_org_invitations_expiry_after_creation"
CHECK ("expires_at" > "created_at");

ALTER TABLE "organization_invitations" ADD CONSTRAINT "chk_org_invitations_status_timestamps"
CHECK (
  ("status" = 'PENDING' AND "revoked_at" IS NULL AND "accepted_at" IS NULL)
  OR ("status" = 'ACCEPTED' AND "accepted_at" IS NOT NULL AND "revoked_at" IS NULL)
  OR ("status" = 'REVOKED' AND "revoked_at" IS NOT NULL AND "accepted_at" IS NULL)
  OR ("status" = 'EXPIRED' AND "accepted_at" IS NULL)
);
