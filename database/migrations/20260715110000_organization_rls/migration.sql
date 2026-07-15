-- Row-Level Security for organization-scoped data.
-- Rollback guidance:
--   ALTER TABLE "organization_invitations" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "organization_memberships" DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS ... for each policy below;
--   DROP FUNCTION IF EXISTS app.can_access_organization(uuid);
--   DROP FUNCTION IF EXISTS app.has_correlation();
--   DROP FUNCTION IF EXISTS app.current_setting_text(text);
--   DROP FUNCTION IF EXISTS app.current_tenant_id();
-- Keep runtime roles separate from migration roles before enabling in shared environments.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_setting_text(setting_name text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting(setting_name, true), '')
$$;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_setting_text('app.tenant_id')::uuid
$$;

CREATE OR REPLACE FUNCTION app.has_correlation()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_setting_text('app.correlation_id') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION app.is_privileged_platform_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    app.current_setting_text('app.platform_admin') = 'true'
    AND app.has_correlation()
    AND app.current_setting_text('app.execution_mode') = 'PLATFORM_ADMIN'
$$;

CREATE OR REPLACE FUNCTION app.is_authorized_cross_tenant_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    app.current_setting_text('app.platform_admin') = 'true'
    AND app.current_setting_text('app.cross_tenant') = 'true'
    AND app.current_setting_text('app.execution_mode') = 'CROSS_TENANT'
    AND app.current_tenant_id() IS NOT NULL
    AND app.has_correlation()
    AND app.current_setting_text('app.privileged_reason') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION app.is_controlled_authenticated_tenant_operation()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    app.current_setting_text('app.execution_mode') = 'AUTHENTICATED'
    AND app.current_tenant_id() IS NOT NULL
    AND app.current_setting_text('app.identity_id') IS NOT NULL
    AND app.has_correlation()
    AND app.current_setting_text('app.operation') IN (
      'ORGANIZATION_BOOTSTRAP',
      'INVITATION_ACCEPTANCE'
    )
$$;

CREATE OR REPLACE FUNCTION app.can_access_organization(row_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN app.is_privileged_platform_context() THEN true
      WHEN app.is_authorized_cross_tenant_context() THEN row_organization_id = app.current_tenant_id()
      WHEN app.current_setting_text('app.execution_mode') = 'TENANT'
        THEN row_organization_id = app.current_tenant_id()
      WHEN app.is_controlled_authenticated_tenant_operation()
        THEN row_organization_id = app.current_tenant_id()
      ELSE false
    END
$$;

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_memberships" FORCE ROW LEVEL SECURITY;

ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organizations_tenant_select_policy"
ON "organizations"
FOR SELECT
USING (app.can_access_organization("id"));

CREATE POLICY "organizations_tenant_insert_policy"
ON "organizations"
FOR INSERT
WITH CHECK (app.can_access_organization("id"));

CREATE POLICY "organizations_tenant_update_policy"
ON "organizations"
FOR UPDATE
USING (app.can_access_organization("id"))
WITH CHECK (app.can_access_organization("id"));

CREATE POLICY "organizations_tenant_delete_policy"
ON "organizations"
FOR DELETE
USING (app.can_access_organization("id"));

CREATE POLICY "organization_memberships_tenant_select_policy"
ON "organization_memberships"
FOR SELECT
USING (app.can_access_organization("organization_id"));

CREATE POLICY "organization_memberships_tenant_insert_policy"
ON "organization_memberships"
FOR INSERT
WITH CHECK (app.can_access_organization("organization_id"));

CREATE POLICY "organization_memberships_tenant_update_policy"
ON "organization_memberships"
FOR UPDATE
USING (app.can_access_organization("organization_id"))
WITH CHECK (app.can_access_organization("organization_id"));

CREATE POLICY "organization_memberships_tenant_delete_policy"
ON "organization_memberships"
FOR DELETE
USING (app.can_access_organization("organization_id"));

CREATE POLICY "organization_invitations_tenant_select_policy"
ON "organization_invitations"
FOR SELECT
USING (app.can_access_organization("organization_id"));

CREATE POLICY "organization_invitations_tenant_insert_policy"
ON "organization_invitations"
FOR INSERT
WITH CHECK (app.can_access_organization("organization_id"));

CREATE POLICY "organization_invitations_tenant_update_policy"
ON "organization_invitations"
FOR UPDATE
USING (app.can_access_organization("organization_id"))
WITH CHECK (app.can_access_organization("organization_id"));

CREATE POLICY "organization_invitations_tenant_delete_policy"
ON "organization_invitations"
FOR DELETE
USING (app.can_access_organization("organization_id"));
