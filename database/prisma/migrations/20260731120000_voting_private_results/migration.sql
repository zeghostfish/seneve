CREATE POLICY "vote_attempts_tenant_results_select_policy"
  ON "vote_attempts"
  FOR SELECT
  USING (
    app.is_platform_admin_context()
    OR (
      app.current_setting_text('app.execution_mode') = 'TENANT'
      AND app.current_tenant_id() = "organization_id"
      AND app.current_setting_text('app.operation') = 'TENANT_ACCESS'
    )
  );
