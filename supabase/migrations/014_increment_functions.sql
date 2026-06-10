-- Migration 014: Increment Functions for Organization Usage Counters
-- Replaces the missing svc.rpc() functions used by lib/api-helpers.ts and app/api/scans/route.ts
-- These functions atomically increment usage counters on the organizations table.

CREATE OR REPLACE FUNCTION increment_org_scans(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE organizations
  SET scans_used_this_period = COALESCE(scans_used_this_period, 0) + 1,
      updated_at = NOW()
  WHERE id = org_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_org_tool_calls(org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE organizations
  SET tool_calls_used_this_period = COALESCE(tool_calls_used_this_period, 0) + 1,
      updated_at = NOW()
  WHERE id = org_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_proxy_session_tool_calls(session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE proxy_sessions
  SET tool_call_count = tool_call_count + 1
  WHERE id = session_id
    AND status = 'active';
END;
$$;
