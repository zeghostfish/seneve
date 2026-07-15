-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('PASSWORD');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrustedDeviceStatus" AS ENUM ('TRUSTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RefreshTokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OneTimeTokenStatus" AS ENUM ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdentitySecurityEventType" AS ENUM ('IDENTITY_REGISTERED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFICATION_RESENT', 'EMAIL_VERIFIED', 'EMAIL_VERIFICATION_FAILED', 'EMAIL_VERIFICATION_EXPIRED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'SESSION_CREATED', 'SESSION_REVOKED', 'REFRESH_TOKEN_ROTATED', 'REFRESH_TOKEN_REUSE_DETECTED', 'IDENTITY_SUSPENDED', 'SESSION_EXPIRED', 'NEW_DEVICE', 'SUSPICIOUS_LOGIN', 'CONCURRENT_LOGIN_LIMIT_REACHED', 'ADMINISTRATOR_SESSION_REVOKED', 'SECURITY_POLICY_VIOLATION');

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "status" "IdentityStatus" NOT NULL,
    "normalized_login_email" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "suspended_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_emails" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "type" "CredentialType" NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "fingerprint_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "TrustedDeviceStatus" NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "device_id" UUID,
    "status" "SessionStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "RefreshTokenStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "OneTimeTokenStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "OneTimeTokenStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_security_events" (
    "id" UUID NOT NULL,
    "identity_id" UUID,
    "event_type" "IdentitySecurityEventType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "identity_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_identities_status" ON "identities"("status");

-- CreateIndex
CREATE INDEX "idx_identities_normalized_login_email" ON "identities"("normalized_login_email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_identity_id" ON "users"("identity_id");

-- CreateIndex
CREATE INDEX "idx_identity_emails_identity_id" ON "identity_emails"("identity_id");

-- CreateIndex
CREATE INDEX "idx_identity_emails_normalized_email" ON "identity_emails"("normalized_email");

-- CreateIndex
CREATE INDEX "idx_credentials_identity_type_status" ON "credentials"("identity_id", "type", "status");

-- CreateIndex
CREATE INDEX "idx_trusted_devices_identity_status" ON "trusted_devices"("identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_trusted_devices_fingerprint_hash" ON "trusted_devices"("fingerprint_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_identity_status" ON "sessions"("identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_sessions_device_status" ON "sessions"("device_id", "status");

-- CreateIndex
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_session_status" ON "refresh_tokens"("session_id", "status");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_family_status" ON "refresh_tokens"("family_id", "status");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_verification_tokens_token_id" ON "email_verification_tokens"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_verification_tokens_token_hash" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_email_verification_tokens_identity_status" ON "email_verification_tokens"("identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_email_verification_tokens_expires_at" ON "email_verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_password_reset_tokens_token_id" ON "password_reset_tokens"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_identity_status" ON "password_reset_tokens"("identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_identity_security_events_identity_occurred_at" ON "identity_security_events"("identity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_identity_security_events_type_occurred_at" ON "identity_security_events"("event_type", "occurred_at");

-- Domain invariant indexes not expressible in Prisma schema.
CREATE UNIQUE INDEX "uq_identities_active_normalized_login_email"
ON "identities"("normalized_login_email")
WHERE "status" <> 'CLOSED';

CREATE UNIQUE INDEX "uq_identity_emails_primary_identity"
ON "identity_emails"("identity_id")
WHERE "is_primary" = true;

CREATE UNIQUE INDEX "uq_credentials_active_identity_type"
ON "credentials"("identity_id", "type")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "uq_trusted_devices_active_identity_fingerprint"
ON "trusted_devices"("identity_id", "fingerprint_hash")
WHERE "status" = 'TRUSTED';

-- Domain invariant checks.
ALTER TABLE "identities"
ADD CONSTRAINT "chk_identities_normalized_login_email"
CHECK ("normalized_login_email" = lower(btrim("normalized_login_email")));

ALTER TABLE "identities"
ADD CONSTRAINT "chk_identities_closed_at"
CHECK (("status" = 'CLOSED' AND "closed_at" IS NOT NULL) OR ("status" <> 'CLOSED' AND "closed_at" IS NULL));

ALTER TABLE "identity_emails"
ADD CONSTRAINT "chk_identity_emails_normalized_email"
CHECK ("normalized_email" = lower(btrim("normalized_email")));

ALTER TABLE "credentials"
ADD CONSTRAINT "chk_credentials_secret_hash_format"
CHECK ("secret_hash" LIKE '$argon2id$%');

ALTER TABLE "credentials"
ADD CONSTRAINT "chk_credentials_revoked_at"
CHECK (("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL));

ALTER TABLE "trusted_devices"
ADD CONSTRAINT "chk_trusted_devices_hash_format"
CHECK ("fingerprint_hash" ~ '^(sha256|hmac-sha256):[A-Za-z0-9+/=._:-]{32,}$');

ALTER TABLE "trusted_devices"
ADD CONSTRAINT "chk_trusted_devices_revoked_at"
CHECK (("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL));

ALTER TABLE "trusted_devices"
ADD CONSTRAINT "chk_trusted_devices_activity_after_first_seen"
CHECK ("last_activity_at" >= "first_seen_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "chk_sessions_expiry_after_creation"
CHECK ("expires_at" > "created_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "chk_sessions_activity_after_creation"
CHECK ("last_activity_at" >= "created_at");

ALTER TABLE "sessions"
ADD CONSTRAINT "chk_sessions_revoked_at"
CHECK (("status" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR ("status" <> 'REVOKED' AND "revoked_at" IS NULL));

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "chk_refresh_tokens_hash_format"
CHECK ("token_hash" ~ '^(sha256|hmac-sha256|argon2id):[A-Za-z0-9+/=._:-]{32,}$');

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "chk_refresh_tokens_expiry_after_issue"
CHECK ("expires_at" > "issued_at");

ALTER TABLE "refresh_tokens"
ADD CONSTRAINT "chk_refresh_tokens_consumed_at"
CHECK (("status" = 'ROTATED' AND "consumed_at" IS NOT NULL) OR ("status" <> 'ROTATED'));

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "chk_email_verification_tokens_hash_format"
CHECK ("token_hash" ~ '^(sha256|hmac-sha256|argon2id):[A-Za-z0-9+/=._:-]{32,}$');

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "chk_email_verification_tokens_expiry_after_creation"
CHECK ("expires_at" > "created_at");

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "chk_email_verification_tokens_consumed_at"
CHECK (("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL) OR ("status" <> 'CONSUMED'));

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "chk_password_reset_tokens_hash_format"
CHECK ("token_hash" ~ '^(sha256|hmac-sha256|argon2id):[A-Za-z0-9+/=._:-]{32,}$');

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "chk_password_reset_tokens_expiry_after_creation"
CHECK ("expires_at" > "created_at");

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "chk_password_reset_tokens_consumed_at"
CHECK (("status" = 'CONSUMED' AND "consumed_at" IS NOT NULL) OR ("status" <> 'CONSUMED'));

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_emails" ADD CONSTRAINT "identity_emails_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "trusted_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_security_events" ADD CONSTRAINT "identity_security_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
