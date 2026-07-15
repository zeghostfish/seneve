# SENEVE Database Schema Reference

## Purpose

This document is the reference for future Prisma schema design and database migrations.

No business table should be created without being described here first.

The schema must support:

- multi-tenancy
- PostgreSQL Row-Level Security
- immutable critical records
- auditability
- idempotency
- future module extraction

## Global Rules

Every business table must include:

- `id`: UUID primary key
- `organization_id`: UUID, unless explicitly global/system scoped
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone where mutation is allowed
- `created_by`: UUID nullable where system-created records are possible
- `deleted_at`: timestamp with time zone for soft-deletable records

Critical immutable tables must not use update/delete behavior for business correction:

- `votes`
- `ledger_entries`
- `audit_logs`
- `payment_webhooks`

Corrections require compensating records.

## Tenant Isolation

All tenant-scoped tables must enforce tenant isolation through:

1. Application authorization.
2. PostgreSQL Row-Level Security policies.

Application services must set tenant context before querying RLS-protected tables.

Cross-tenant access tests are mandatory.

## Schema Status

This document is an initial schema reference. Exact Prisma model definitions must be produced during the foundation/database milestone and kept synchronized here.

## Entity Reference

### identities

Purpose: aggregate root for authentication lifecycle, login uniqueness, suspension, closure, and future authentication-provider support.

Fields:

- `id`: UUID, primary key
- `status`: enum `IdentityStatus`
- `normalized_login_email`: text, required
- `version`: integer, required, default `1`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `suspended_at`: timestamp with time zone, nullable
- `closed_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- `idx_identities_status`
- `idx_identities_normalized_login_email`
- partial unique `uq_identities_active_normalized_login_email` on `normalized_login_email` where `status <> CLOSED`
- check `normalized_login_email = lower(btrim(normalized_login_email))`
- check `closed_at` is present only when `status = CLOSED`

Relationships:

- has one `users`
- has many `identity_emails`
- has many `credentials`
- has many `sessions`
- has many `email_verification_tokens`
- has many `password_reset_tokens`
- has many `identity_security_events`

Lifecycle:

- `PENDING_EMAIL_VERIFICATION`
- `ACTIVE`
- `SUSPENDED`
- `CLOSED`

Audit requirements:

- lifecycle changes emit identity domain events
- immutable generic audit persistence is deferred to the Audit phase
- `identity_security_events` may store identity-local security history before the Audit module exists

API exposure:

- never exposed directly as a raw persistence record
- read through application services and DTOs in later API phases

Permissions:

- self and administrator actions are enforced by later application authorization
- platform administrator suspension must remain explicit and audited

Business validations:

- active login email is unique among non-closed identities
- email normalization is enforced in application and database
- identity closure preserves minimum immutable history

### users

Purpose: person/profile record associated with an `Identity`. `User` is not the authentication aggregate root and does not store credentials, login emails, sessions, or tokens.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required, unique
- `display_name`: text, required
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes and constraints:

- primary key `id`
- unique `identity_id`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- follows the owning identity lifecycle
- profile changes do not alter authentication state

Audit requirements:

- profile changes require identity/user audit events in the Audit phase

API exposure:

- private user profile
- organization member views after membership implementation
- administration views after platform administration implementation

Permissions:

- self read/update limited profile fields
- organization administrators manage memberships, not global user identity
- platform administrators may suspend identities through privileged paths

Business validations:

- a user account does not belong directly to one organization
- credentials and tokens are never stored on `users`

### identity_emails

Purpose: email addresses attached to an identity, including the primary login email used in V1.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `email`: text, required
- `normalized_email`: text, required
- `is_primary`: boolean, required, default `false`
- `verified_at`: timestamp with time zone, nullable
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes and constraints:

- primary key `id`
- `idx_identity_emails_identity_id`
- `idx_identity_emails_normalized_email`
- partial unique `uq_identity_emails_primary_identity` on `identity_id` where `is_primary = true`
- check `normalized_email = lower(btrim(normalized_email))`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- created unverified during registration
- verified after a valid email-verification token is consumed
- future non-primary email lifecycle is deferred

Audit requirements:

- verification emits `EmailVerified`
- immutable audit persistence is deferred to the Audit phase

API exposure:

- primary email may be returned only through authenticated profile endpoints in later API phases

Permissions:

- self may manage own email through later application services
- administrator changes require explicit policy

Business validations:

- primary email must match `identities.normalized_login_email` for V1 email/password login
- raw verification tokens are never stored

### credentials

Purpose: non-reversible authentication secret records for an identity.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `type`: enum `CredentialType`
- `secret_hash`: text, required
- `status`: enum `CredentialStatus`
- `version`: integer, required, default `1`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `revoked_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- `idx_credentials_identity_type_status`
- partial unique `uq_credentials_active_identity_type` on `identity_id`, `type` where `status = ACTIVE`
- check `secret_hash LIKE '$argon2id$%'`
- check `revoked_at` is present only when `status = REVOKED`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- `ACTIVE`
- `REVOKED`

Audit requirements:

- password changes emit `PasswordChanged`
- password reset completion emits `PasswordResetCompleted`

API exposure:

- never exposed

Permissions:

- self password change/reset through later application services
- administrator credential reset requires privileged policy

Business validations:

- plaintext passwords are never stored
- only one active password credential may exist for an identity

### sessions

Purpose: authenticated refresh-token-backed session records with optional trusted-device association.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `device_id`: UUID, nullable
- `status`: enum `SessionStatus`
- `version`: integer, required, default `1`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `last_activity_at`: timestamp with time zone
- `expires_at`: timestamp with time zone
- `revoked_at`: timestamp with time zone, nullable
- `revoked_reason`: text, nullable

Indexes and constraints:

- primary key `id`
- `idx_sessions_identity_status`
- `idx_sessions_device_status`
- `idx_sessions_expires_at`
- check `expires_at > created_at`
- check `last_activity_at >= created_at`
- check `revoked_at` is present only when `status = REVOKED`
- foreign key `identity_id` references `identities(id)` with restricted deletion
- foreign key `device_id` references `trusted_devices(id)` with restricted deletion when present

Lifecycle:

- `ACTIVE`
- `REVOKED`
- `EXPIRED`

Audit requirements:

- creation emits `SessionCreated`
- revocation emits `SessionRevoked`
- expiration emits `SessionExpired`

API exposure:

- session metadata may be exposed through authenticated session-management endpoints in later API phases

Permissions:

- self may revoke own sessions
- administrators may revoke sessions only through approved policies

Business validations:

- no orphan sessions
- suspension and password reset completion revoke active sessions transactionally
- maximum concurrent session limits are enforced by the Security Decision Service before session creation
- expired sessions are marked through session-management application services

### trusted_devices

Purpose: trusted client-device records associated with an identity. This prepares the security model for device-aware sessions without implementing browser fingerprinting.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `fingerprint_hash`: text, required
- `display_name`: text, required
- `status`: enum `TrustedDeviceStatus`
- `first_seen_at`: timestamp with time zone
- `last_activity_at`: timestamp with time zone
- `revoked_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- `idx_trusted_devices_identity_status`
- `idx_trusted_devices_fingerprint_hash`
- partial unique `uq_trusted_devices_active_identity_fingerprint` on `identity_id`, `fingerprint_hash` where `status = TRUSTED`
- check `fingerprint_hash` uses an approved non-reversible hash prefix
- check `last_activity_at >= first_seen_at`
- check `revoked_at` is present only when `status = REVOKED`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- `TRUSTED`
- `REVOKED`

Audit requirements:

- new device emits `NewDevice`
- revoked device emits a session/security event
- device metadata must not contain raw fingerprinting material

API exposure:

- device metadata may be exposed through authenticated session/device-management endpoints in later API phases

Permissions:

- self may revoke own devices in later API phases
- administrator device revocation requires privileged policy

Business validations:

- browser fingerprint collection is not implemented in Phase 4
- only a hashed device fingerprint is persisted
- revoked devices cannot create new sessions

### refresh_tokens

Purpose: stored refresh-token hashes and token-family state used for rotation and replay detection.

Fields:

- `id`: UUID, primary key
- `session_id`: UUID, required
- `family_id`: UUID, required
- `token_hash`: text, required
- `status`: enum `RefreshTokenStatus`
- `version`: integer, required, default `1`
- `issued_at`: timestamp with time zone
- `expires_at`: timestamp with time zone
- `consumed_at`: timestamp with time zone, nullable
- `revoked_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- unique `token_hash`
- `idx_refresh_tokens_session_status`
- `idx_refresh_tokens_family_status`
- `idx_refresh_tokens_expires_at`
- check `token_hash` uses an approved non-reversible hash prefix
- check `expires_at > issued_at`
- check `consumed_at` is present when `status = ROTATED`
- foreign key `session_id` references `sessions(id)` with restricted deletion

Lifecycle:

- `ACTIVE`
- `ROTATED`
- `REVOKED`
- `EXPIRED`

Audit requirements:

- successful rotation emits `RefreshTokenRotated`
- replay emits `RefreshTokenReuseDetected`

API exposure:

- never exposed

Permissions:

- session owner only through later authentication services

Business validations:

- raw refresh tokens are never stored
- repeated consumption revokes the token family and affected sessions

### email_verification_tokens

Purpose: single-use hashed token records for verifying primary email addresses.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `token_id`: UUID, required
- `token_hash`: text, required
- `status`: enum `OneTimeTokenStatus`
- `created_at`: timestamp with time zone
- `expires_at`: timestamp with time zone
- `consumed_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- unique `token_id`
- unique `token_hash`
- `idx_email_verification_tokens_identity_status`
- `idx_email_verification_tokens_expires_at`
- check `token_hash` uses an approved non-reversible hash prefix
- check `expires_at > created_at`
- check `consumed_at` is present when `status = CONSUMED`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- `PENDING`
- `CONSUMED`
- `REVOKED`
- `EXPIRED`

Audit requirements:

- successful consumption emits `EmailVerified`

API exposure:

- never exposed as a raw persistence record

Permissions:

- token holder only through later email-verification service

Business validations:

- raw verification tokens are never stored
- consumed, revoked, or expired tokens cannot be reused

### password_reset_tokens

Purpose: single-use hashed token records for password reset completion.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, required
- `token_id`: UUID, required
- `token_hash`: text, required
- `status`: enum `OneTimeTokenStatus`
- `created_at`: timestamp with time zone
- `expires_at`: timestamp with time zone
- `consumed_at`: timestamp with time zone, nullable

Indexes and constraints:

- primary key `id`
- unique `token_id`
- unique `token_hash`
- `idx_password_reset_tokens_identity_status`
- `idx_password_reset_tokens_expires_at`
- check `token_hash` uses an approved non-reversible hash prefix
- check `expires_at > created_at`
- check `consumed_at` is present when `status = CONSUMED`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- `PENDING`
- `CONSUMED`
- `REVOKED`
- `EXPIRED`

Audit requirements:

- request emits `PasswordResetRequested`
- completion emits `PasswordResetCompleted`

API exposure:

- never exposed as a raw persistence record

Permissions:

- token holder only through later password-reset service

Business validations:

- raw reset tokens are never stored
- consumed, revoked, or expired tokens cannot be reused
- password reset completion revokes active sessions transactionally

### identity_security_events

Purpose: append-only identity-local security history until the generic Audit module is implemented.

Fields:

- `id`: UUID, primary key
- `identity_id`: UUID, nullable for redacted account-enumeration-safe events
- `event_type`: enum `IdentitySecurityEventType`
- `occurred_at`: timestamp with time zone
- `correlation_id`: text, required
- `metadata`: jsonb, nullable

Indexes and constraints:

- primary key `id`
- `idx_identity_security_events_identity_occurred_at`
- `idx_identity_security_events_type_occurred_at`
- foreign key `identity_id` references `identities(id)` with restricted deletion

Lifecycle:

- append-only
- no update/delete for business correction

Audit requirements:

- does not replace the future immutable Audit module
- must not contain raw credentials, tokens, hashes, or unnecessary personal data

API exposure:

- platform or self-security views only after explicit API authorization is implemented

Permissions:

- self read may be introduced for security history
- platform access requires privileged audited path

Business validations:

- events are security history, not authorization source of truth
- Phase 4 event types include `SESSION_EXPIRED`, `NEW_DEVICE`, `SUSPICIOUS_LOGIN`, `CONCURRENT_LOGIN_LIMIT_REACHED`, `ADMINISTRATOR_SESSION_REVOKED`, and `SECURITY_POLICY_VIOLATION`

### organizations

Purpose: tenant root for customer data.

Fields:

- `id`: UUID, primary key
- `name`: text
- `slug`: text, unique
- `status`: enum `OrganizationStatus`
- `billing_status`: enum `BillingStatus`
- `default_locale`: text
- `default_timezone`: text
- `settings`: jsonb
- `branding`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `deleted_at`: timestamp with time zone, nullable

Indexes:

- unique `slug`
- `status`
- `billing_status`

Lifecycle:

- draft
- active
- suspended
- archived

Audit:

- creation
- settings changes
- billing status changes
- suspension

API exposure:

- organization dashboard
- platform administration

Permissions:

- organization admins manage organization settings according to policy
- platform admins may supervise all organizations

Business validations:

- slug must be unique and stable
- billing policy may restrict campaign creation

### memberships

Purpose: association between users and organizations.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `user_id`: UUID, required
- `status`: enum `MembershipStatus`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `invited_by`: UUID, nullable

Indexes:

- unique `organization_id`, `user_id`
- `organization_id`, `status`
- `user_id`, `status`

Relationships:

- belongs to `organizations`
- belongs to `users`
- has assigned roles through membership-role join table

Lifecycle:

- invited
- active
- suspended
- removed

Audit:

- invitation
- acceptance
- role changes
- removal

Permissions:

- team managers invite members if policy permits
- organization admins manage memberships

Business validations:

- user cannot act in organization without active membership unless platform admin policy applies

### roles

Purpose: named permission grouping.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable for system roles
- `key`: text
- `name`: text
- `description`: text, nullable
- `is_system`: boolean
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- unique `organization_id`, `key`
- `is_system`

Permissions:

- platform admins manage system roles
- organization admins manage custom roles where policy allows

Business validations:

- system roles cannot be deleted
- role alone never grants access without policy and condition evaluation

### permissions

Purpose: explicit action grants.

Fields:

- `id`: UUID, primary key
- `key`: text, unique
- `description`: text
- `created_at`: timestamp with time zone

Examples:

- `campaign.create`
- `campaign.publish`
- `vote.review`
- `payment.refund`
- `audit.read`

Business validations:

- permission keys are stable API-like identifiers

### policies

Purpose: authorization policy attached to permissions.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable for system policies
- `permission_id`: UUID, required
- `name`: text
- `effect`: enum `PolicyEffect`
- `conditions`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `permission_id`
- `organization_id`

Business validations:

- policy conditions must be evaluated server-side before business logic
- deny policies take precedence where conflicts are defined

### events

Purpose: grouping entity for one or more campaigns.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `name`: text
- `description`: text, nullable
- `status`: enum `EventStatus`
- `starts_at`: timestamp with time zone, nullable
- `ends_at`: timestamp with time zone, nullable
- `timezone`: text
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `deleted_at`: timestamp with time zone, nullable

Indexes:

- `organization_id`, `status`
- `organization_id`, `starts_at`

Lifecycle:

- draft
- scheduled
- published
- active
- paused
- closed
- archived

Business validations:

- event lifecycle transitions must be controlled
- event does not own voting behavior; campaign does

### campaign_templates

Purpose: reusable campaign configuration asset.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable for platform templates
- `name`: text
- `key`: text
- `version`: integer
- `status`: enum `TemplateStatus`
- `template_type`: text
- `configuration`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `published_at`: timestamp with time zone, nullable

Indexes:

- unique `organization_id`, `key`, `version`
- `status`
- `template_type`

Lifecycle:

- draft
- published
- archived

Audit:

- creation
- publication
- archival

API exposure:

- organizer campaign creation
- administration template library

Permissions:

- platform admins manage global templates
- organization admins may manage organization templates if enabled

Business validations:

- published template versions are immutable unless replaced by a new version
- existing campaigns must reference the template version used at creation

### campaigns

Purpose: central business aggregate for voting operations.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `event_id`: UUID, nullable
- `campaign_template_id`: UUID, nullable
- `campaign_template_version`: integer, nullable
- `name`: text
- `slug`: text
- `description`: text, nullable
- `status`: enum `CampaignStatus`
- `visibility`: enum `CampaignVisibility`
- `starts_at`: timestamp with time zone, nullable
- `ends_at`: timestamp with time zone, nullable
- `timezone`: text
- `configuration`: jsonb
- `result_visibility`: enum `ResultVisibility`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `published_at`: timestamp with time zone, nullable
- `closed_at`: timestamp with time zone, nullable
- `deleted_at`: timestamp with time zone, nullable

Indexes:

- unique `organization_id`, `slug`
- `organization_id`, `status`
- `event_id`
- `starts_at`
- `ends_at`

Relationships:

- belongs to `organizations`
- optionally belongs to `events`
- optionally instantiated from `campaign_templates`
- has categories, candidates, rules, workflows, reports, payments, fraud cases

Lifecycle:

- draft
- scheduled
- published
- active
- suspended
- closed
- archived

Audit:

- creation
- rule changes
- publication
- suspension
- closure
- archival

API exposure:

- organizer dashboard
- public front office when published
- administration

Permissions:

- campaign create/update/publish/close permissions with policy and conditions

Business validations:

- campaign status controls voting availability
- published campaigns cannot mutate critical voting behavior without documented versioning or controlled change workflow

### categories

Purpose: campaign subdivisions for candidates and rankings.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `name`: text
- `description`: text, nullable
- `sort_order`: integer
- `status`: enum `CategoryStatus`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `deleted_at`: timestamp with time zone, nullable

Indexes:

- `campaign_id`, `status`
- `campaign_id`, `sort_order`

Business validations:

- category must belong to same organization as campaign

### candidates

Purpose: campaign participants.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `category_id`: UUID, nullable
- `display_name`: text
- `bio`: text, nullable
- `public_code`: text
- `status`: enum `CandidateStatus`
- `metadata`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `deleted_at`: timestamp with time zone, nullable

Indexes:

- unique `campaign_id`, `public_code`
- `campaign_id`, `status`
- `category_id`, `status`

Business validations:

- active candidates must be eligible under campaign and category rules

### candidate_media

Purpose: media attached to candidates.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `candidate_id`: UUID, required
- `type`: enum `MediaType`
- `storage_key`: text
- `url`: text, nullable
- `alt_text`: text, nullable
- `sort_order`: integer
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `candidate_id`, `sort_order`

Business validations:

- media storage must use approved object storage adapters

### business_rules

Purpose: generic rules consumed by engines.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `rule_set_id`: UUID, nullable
- `name`: text
- `scope`: enum `RuleScope`
- `priority`: integer
- `status`: enum `RuleStatus`
- `conditions`: jsonb
- `actions`: jsonb
- `version`: integer
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `campaign_id`, `scope`, `status`
- `rule_set_id`, `priority`

Business validations:

- conditions and actions must use supported operators
- rule changes on published campaigns require audit
- rule evaluation order must be deterministic

### vote_sessions

Purpose: voting interaction context.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `voter_id`: UUID, nullable
- `status`: enum `VoteSessionStatus`
- `ip_address_hash`: text, nullable
- `device_fingerprint_hash`: text, nullable
- `user_agent_hash`: text, nullable
- `metadata`: jsonb
- `created_at`: timestamp with time zone
- `expires_at`: timestamp with time zone, nullable

Indexes:

- `campaign_id`, `status`
- `voter_id`
- `created_at`

Audit:

- session started
- session expired

Business validations:

- sensitive device data must be minimized and hashed where possible

### vote_attempts

Purpose: intention to vote before confirmation.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `vote_session_id`: UUID, required
- `candidate_id`: UUID, required
- `category_id`: UUID, nullable
- `status`: enum `VoteAttemptStatus`
- `idempotency_key`: text, nullable
- `rule_evaluation`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `expires_at`: timestamp with time zone, nullable

Indexes:

- unique `organization_id`, `idempotency_key` where not null
- `campaign_id`, `status`
- `candidate_id`, `status`
- `created_at`

Lifecycle:

- created
- waiting_verification
- waiting_payment
- fraud_review
- confirmed
- rejected
- expired
- cancelled

Audit:

- creation
- state transition
- rejection reason

Business validations:

- attempt is not a vote
- all state transitions must be explicit and auditable

### votes

Purpose: immutable confirmed vote record.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `vote_attempt_id`: UUID, required
- `candidate_id`: UUID, required
- `category_id`: UUID, nullable
- `vote_value`: integer
- `confirmation_source`: enum `VoteConfirmationSource`
- `confirmed_at`: timestamp with time zone
- `created_at`: timestamp with time zone

Indexes:

- unique `vote_attempt_id`
- `campaign_id`, `candidate_id`
- `campaign_id`, `category_id`
- `confirmed_at`

Lifecycle:

- immutable after creation

Audit:

- vote confirmation
- compensating cancellation entry if applicable

Business validations:

- no update/delete business path
- paid vote requires definitive payment success
- correction creates a compensating record or event, never mutation

### verifications

Purpose: verification history.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `vote_attempt_id`: UUID, nullable
- `user_id`: UUID, nullable
- `type`: enum `VerificationType`
- `status`: enum `VerificationStatus`
- `verified_at`: timestamp with time zone, nullable
- `metadata`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `vote_attempt_id`
- `user_id`
- `type`, `status`

Business validations:

- OTP secrets are never stored in plaintext
- verification alone does not create a vote

### payment_providers

Purpose: configured payment provider adapters.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable
- `provider_key`: text
- `display_name`: text
- `status`: enum `ProviderStatus`
- `configuration`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- unique `organization_id`, `provider_key`
- `status`

Business validations:

- secrets are stored in a secrets manager or encrypted configuration, never plaintext in code

### payments

Purpose: payment transaction record.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `vote_attempt_id`: UUID, nullable
- `payment_provider_id`: UUID, required
- `status`: enum `PaymentStatus`
- `amount`: numeric
- `currency`: text
- `provider_reference`: text, nullable
- `idempotency_key`: text, nullable
- `metadata`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone
- `paid_at`: timestamp with time zone, nullable

Indexes:

- unique `organization_id`, `idempotency_key` where not null
- unique `payment_provider_id`, `provider_reference` where not null
- `campaign_id`, `status`
- `vote_attempt_id`

Business validations:

- initiated or authorized payment is not a vote
- only definitive success can trigger paid vote confirmation
- duplicate webhook processing must be idempotent

### payment_webhooks

Purpose: immutable history of provider webhook deliveries.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable
- `payment_provider_id`: UUID, required
- `payment_id`: UUID, nullable
- `event_type`: text
- `provider_event_id`: text, nullable
- `signature_valid`: boolean
- `payload`: jsonb
- `received_at`: timestamp with time zone
- `processed_at`: timestamp with time zone, nullable
- `processing_status`: enum `WebhookProcessingStatus`

Indexes:

- unique `payment_provider_id`, `provider_event_id` where not null
- `payment_id`
- `received_at`
- `processing_status`

Business validations:

- record is immutable
- invalid signatures are stored and rejected
- replay must not duplicate financial or voting effects

### ledger_entries

Purpose: immutable financial ledger.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `payment_id`: UUID, nullable
- `payout_id`: UUID, nullable
- `entry_type`: enum `LedgerEntryType`
- `direction`: enum `LedgerDirection`
- `amount`: numeric
- `currency`: text
- `description`: text
- `metadata`: jsonb
- `created_at`: timestamp with time zone

Indexes:

- `organization_id`, `created_at`
- `campaign_id`
- `payment_id`
- `payout_id`

Business validations:

- immutable after creation
- corrections use compensating entries
- ledger must balance according to Financial Platform rules

### invoices

Purpose: invoice records.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `invoice_number`: text
- `status`: enum `InvoiceStatus`
- `amount`: numeric
- `currency`: text
- `issued_at`: timestamp with time zone, nullable
- `due_at`: timestamp with time zone, nullable
- `paid_at`: timestamp with time zone, nullable
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- unique `organization_id`, `invoice_number`
- `status`

Business validations:

- invoice numbering must be deterministic and auditable

### payouts

Purpose: settlement and reversement tracking.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `status`: enum `PayoutStatus`
- `amount`: numeric
- `currency`: text
- `requested_at`: timestamp with time zone
- `approved_at`: timestamp with time zone, nullable
- `completed_at`: timestamp with time zone, nullable
- `metadata`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `organization_id`, `status`
- `campaign_id`

Business validations:

- payout creation requires Financial Platform settlement rules
- ledger entries must be created atomically with payout state changes where required

### fraud_rules

Purpose: fraud detection configuration.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `name`: text
- `status`: enum `FraudRuleStatus`
- `threshold`: integer, nullable
- `configuration`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Business validations:

- automatic rejection must not depend on a single signal
- thresholds are configurable

### fraud_cases

Purpose: fraud review case.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, required
- `vote_attempt_id`: UUID, nullable
- `risk_score`: integer
- `status`: enum `FraudCaseStatus`
- `evidence`: jsonb
- `decision`: enum `FraudDecision`, nullable
- `reviewed_by`: UUID, nullable
- `reviewed_at`: timestamp with time zone, nullable
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `campaign_id`, `status`
- `risk_score`

Business validations:

- evidence retention must follow platform retention policy
- review actions are audited

### workflow_definitions

Purpose: configurable workflow definitions.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `name`: text
- `status`: enum `WorkflowDefinitionStatus`
- `trigger`: jsonb
- `conditions`: jsonb
- `actions`: jsonb
- `error_strategy`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Business validations:

- workflow may orchestrate but must not contain domain business rules
- actions must be idempotent

### workflow_executions

Purpose: workflow run history.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `workflow_definition_id`: UUID, required
- `trigger_event_id`: UUID, nullable
- `status`: enum `WorkflowExecutionStatus`
- `started_at`: timestamp with time zone
- `completed_at`: timestamp with time zone, nullable
- `result`: jsonb
- `error`: jsonb, nullable

Indexes:

- `workflow_definition_id`, `started_at`
- `status`

Business validations:

- execution records are audit-relevant
- retries must be traceable

### notifications

Purpose: notification delivery records.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `recipient`: text
- `channel`: enum `NotificationChannel`
- `status`: enum `NotificationStatus`
- `template_id`: UUID, nullable
- `payload`: jsonb
- `sent_at`: timestamp with time zone, nullable
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- `organization_id`, `status`
- `campaign_id`

Business validations:

- notification module must not modify campaign state

### notification_templates

Purpose: reusable notification template.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable
- `key`: text
- `locale`: text
- `channel`: enum `NotificationChannel`
- `content`: jsonb
- `status`: enum `TemplateStatus`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Indexes:

- unique `organization_id`, `key`, `locale`, `channel`

### reports

Purpose: generated report metadata.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `campaign_id`: UUID, nullable
- `type`: enum `ReportType`
- `status`: enum `ReportStatus`
- `storage_key`: text, nullable
- `parameters`: jsonb
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

Business validations:

- reports must respect tenant isolation and permissions

### audit_logs

Purpose: immutable critical action log.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, nullable
- `actor_id`: UUID, nullable
- `action`: text
- `resource_type`: text
- `resource_id`: UUID, nullable
- `old_value`: jsonb, nullable
- `new_value`: jsonb, nullable
- `reason`: text, nullable
- `ip_address_hash`: text, nullable
- `correlation_id`: UUID, nullable
- `created_at`: timestamp with time zone

Indexes:

- `organization_id`, `created_at`
- `actor_id`
- `resource_type`, `resource_id`
- `action`
- `correlation_id`

Business validations:

- immutable after creation
- never physically deleted
- sensitive data must be redacted

### api_keys

Purpose: future API key credentials.

Status:

- deferred beyond V1 public API scope, but schema reserved for future planning.

### webhook_endpoints

Purpose: future outbound webhook configuration.

Status:

- deferred beyond V1 public API scope, except inbound payment webhooks.

### attachments

Purpose: generic uploaded files and generated artifacts.

Fields:

- `id`: UUID, primary key
- `organization_id`: UUID, required
- `owner_type`: text
- `owner_id`: UUID
- `storage_key`: text
- `mime_type`: text
- `size_bytes`: integer
- `created_at`: timestamp with time zone
- `created_by`: UUID, nullable

Indexes:

- `organization_id`, `owner_type`, `owner_id`

Business validations:

- files must be scanned or validated according to security policy before public use

## Required Initial Enums

The exact enum values must be finalized with migrations. Initial required enums include:

- `UserStatus`
- `OrganizationStatus`
- `BillingStatus`
- `MembershipStatus`
- `EventStatus`
- `TemplateStatus`
- `CampaignStatus`
- `CampaignVisibility`
- `ResultVisibility`
- `CategoryStatus`
- `CandidateStatus`
- `RuleScope`
- `RuleStatus`
- `VoteSessionStatus`
- `VoteAttemptStatus`
- `VoteConfirmationSource`
- `VerificationType`
- `VerificationStatus`
- `ProviderStatus`
- `PaymentStatus`
- `WebhookProcessingStatus`
- `LedgerEntryType`
- `LedgerDirection`
- `InvoiceStatus`
- `PayoutStatus`
- `FraudRuleStatus`
- `FraudCaseStatus`
- `FraudDecision`
- `WorkflowDefinitionStatus`
- `WorkflowExecutionStatus`
- `NotificationChannel`
- `NotificationStatus`
- `ReportType`
- `ReportStatus`

## Migration Requirements

Every migration must:

- be versioned
- define constraints
- define indexes
- include RLS policy changes where tenant-scoped data is involved
- avoid cascade deletes on critical records
- preserve existing data
- include rollback guidance where practical
- update this document
- be tested automatically before merge
