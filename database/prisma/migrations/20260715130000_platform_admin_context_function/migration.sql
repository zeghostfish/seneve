-- Compatibility helper for Campaign and Candidate RLS policies.
-- The canonical platform-administrator semantics were introduced by
-- app.is_privileged_platform_context() in the organization RLS migration.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.is_platform_admin_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.is_privileged_platform_context()
$$;
