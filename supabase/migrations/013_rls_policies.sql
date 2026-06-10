-- Migration 013: Row Level Security Policies
-- Enables RLS on all tables and applies org-level isolation policies.
-- Uses a helper function to resolve the current user's organization.

-- Helper: get the current user's active organization
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND invitation_status = 'accepted'
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Auto-provision: create a personal organization and membership when a new user signs up.
-- This runs inside a `security definer` trigger so it bypasses RLS.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  org_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  -- Ensure unique slug
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  INSERT INTO organizations (id, name, slug, plan_id, seats_used)
  VALUES (gen_random_uuid(), new.email, org_slug, 'free', 1)
  RETURNING id INTO new_org_id;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, new.id, 'owner');

  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- Helper: check if user has a role in the organization
CREATE OR REPLACE FUNCTION user_has_role(in_org_id UUID, required_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = in_org_id
      AND user_id = auth.uid()
      AND invitation_status = 'accepted'
      AND role = ANY(required_roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Apply org-level isolation to every table
-- Pattern: users can only see rows belonging to their organization

-- organizations: users can see their own org, admins can manage
DROP POLICY IF EXISTS "org_isolation" ON organizations;
CREATE POLICY "org_isolation" ON organizations
  FOR ALL USING (id = get_user_org_id());

-- organization_members: users in the org can see members
DROP POLICY IF EXISTS "org_isolation" ON organization_members;
CREATE POLICY "org_isolation" ON organization_members
  FOR SELECT USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "org_manage_members" ON organization_members;
CREATE POLICY "org_manage_members" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND user_has_role(organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "org_update_members" ON organization_members;
CREATE POLICY "org_update_members" ON organization_members
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND user_has_role(organization_id, ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "org_delete_members" ON organization_members;
CREATE POLICY "org_delete_members" ON organization_members
  FOR DELETE USING (
    organization_id = get_user_org_id()
    AND user_has_role(organization_id, ARRAY['owner', 'admin'])
  );

-- mcp_servers
DROP POLICY IF EXISTS "org_isolation" ON mcp_servers;
CREATE POLICY "org_isolation" ON mcp_servers
  FOR ALL USING (organization_id = get_user_org_id());

-- scans
DROP POLICY IF EXISTS "org_isolation" ON scans;
CREATE POLICY "org_isolation" ON scans
  FOR ALL USING (organization_id = get_user_org_id());

-- proxy_sessions
DROP POLICY IF EXISTS "org_isolation" ON proxy_sessions;
CREATE POLICY "org_isolation" ON proxy_sessions
  FOR ALL USING (organization_id = get_user_org_id());

-- tool_invocation_logs
DROP POLICY IF EXISTS "org_isolation" ON tool_invocation_logs;
CREATE POLICY "org_isolation" ON tool_invocation_logs
  FOR ALL USING (organization_id = get_user_org_id());

-- alert_rules
DROP POLICY IF EXISTS "org_isolation" ON alert_rules;
CREATE POLICY "org_isolation" ON alert_rules
  FOR ALL USING (organization_id = get_user_org_id());

-- alert_channels
DROP POLICY IF EXISTS "org_isolation" ON alert_channels;
CREATE POLICY "org_isolation" ON alert_channels
  FOR ALL USING (organization_id = get_user_org_id());

-- alert_deliveries
DROP POLICY IF EXISTS "org_isolation" ON alert_deliveries;
CREATE POLICY "org_isolation" ON alert_deliveries
  FOR ALL USING (organization_id = get_user_org_id());

-- nsa_compliance_assessments
DROP POLICY IF EXISTS "org_isolation" ON nsa_compliance_assessments;
CREATE POLICY "org_isolation" ON nsa_compliance_assessments
  FOR ALL USING (organization_id = get_user_org_id());

-- compliance_report_exports
DROP POLICY IF EXISTS "org_isolation" ON compliance_report_exports;
CREATE POLICY "org_isolation" ON compliance_report_exports
  FOR ALL USING (organization_id = get_user_org_id());

-- addon_purchases
DROP POLICY IF EXISTS "org_isolation" ON addon_purchases;
CREATE POLICY "org_isolation" ON addon_purchases
  FOR ALL USING (organization_id = get_user_org_id());

-- usage_billing_records
DROP POLICY IF EXISTS "org_isolation" ON usage_billing_records;
CREATE POLICY "org_isolation" ON usage_billing_records
  FOR ALL USING (organization_id = get_user_org_id());

-- session_telemetry_snapshots
DROP POLICY IF EXISTS "org_isolation" ON session_telemetry_snapshots;
CREATE POLICY "org_isolation" ON session_telemetry_snapshots
  FOR ALL USING (organization_id = get_user_org_id());

-- server_health_metrics
DROP POLICY IF EXISTS "org_isolation" ON server_health_metrics;
CREATE POLICY "org_isolation" ON server_health_metrics
  FOR ALL USING (organization_id = get_user_org_id());

-- overage_rates: reference data — readable by all authenticated users
DROP POLICY IF EXISTS "authenticated_can_read" ON overage_rates;
CREATE POLICY "authenticated_can_read" ON overage_rates
  FOR SELECT TO authenticated USING (true);

-- plans: reference data — readable by all authenticated users
DROP POLICY IF EXISTS "authenticated_can_read" ON plans;
CREATE POLICY "authenticated_can_read" ON plans
  FOR SELECT TO authenticated USING (true);
