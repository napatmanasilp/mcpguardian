-- =========================================================================
-- 015_pending_fixes.sql
-- Run this in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/skkbynenxbikplmednzg/sql/new
-- =========================================================================

-- ─── 1. mcp_cves — add columns missing from live schema ──────────────────

ALTER TABLE public.mcp_cves ALTER COLUMN cvss_score DROP NOT NULL;
ALTER TABLE public.mcp_cves ALTER COLUMN published_at DROP NOT NULL;

ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS fix text;
ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'exact';
ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS version_field text NOT NULL DEFAULT 'semver';
ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mcp_cves ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Switch unique constraint from cve_id → package_name
-- (many CVEs share cve_id = 'N/A', but package_name is always unique per entry)
ALTER TABLE public.mcp_cves DROP CONSTRAINT IF EXISTS mcp_cves_cve_id_key;
ALTER TABLE public.mcp_cves DROP CONSTRAINT IF EXISTS mcp_cves_package_name_key;
ALTER TABLE public.mcp_cves ADD CONSTRAINT mcp_cves_package_name_key UNIQUE (package_name);

-- Allow unauthenticated reads for CVE data
DROP POLICY IF EXISTS "Authenticated users can view CVEs" ON public.mcp_cves;
DROP POLICY IF EXISTS "Anyone can view CVEs" ON public.mcp_cves;
CREATE POLICY "Anyone can view CVEs" ON public.mcp_cves FOR SELECT USING (true);

-- ─── 2. profiles — add columns referenced in code ────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checks_purchased integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS top_up_balance_usd numeric(10,2) NOT NULL DEFAULT 0;

-- Fix stale default (initial migration set max_scans default to 3, should be 100)
UPDATE public.profiles SET max_scans = 100 WHERE max_scans = 3;
ALTER TABLE public.profiles ALTER COLUMN max_scans SET DEFAULT 100;

-- ─── 3. Seed CVE data ─────────────────────────────────────────────────────
-- One row per unique package_name. Where multiple CVEs exist for the same
-- package the most severe / most recent entry is used.

INSERT INTO public.mcp_cves
  (cve_id, package_name, affected_versions, severity, description, fix, match_type, version_field, is_active)
VALUES
  ('CVE-2025-54136',
   'mcp-remote',
   '<0.3.0', 'CRITICAL',
   'SSRF and credential theft (covers CVE-2025-6514 and expanded CVE-2025-54136)',
   'Upgrade to mcp-remote >= 0.3.0',
   'exact', 'semver', true),

  ('CVE-2025-68144',
   '@anthropic-ai/mcp-server-git',
   '<0.7.0', 'CRITICAL',
   'RCE exploit chain via git command injection (supersedes CVE-2025-49596)',
   'Upgrade to @anthropic-ai/mcp-server-git >= 0.7.0',
   'exact', 'semver', true),

  ('CVE-2025-68143',
   '@modelcontextprotocol/server-github',
   '<0.7.0', 'HIGH',
   'Private repository access via prompt injection (supersedes earlier token exposure)',
   'Upgrade to @modelcontextprotocol/server-github >= 0.7.0, use read-only token scopes',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-filesystem',
   'without --directory flag', 'HIGH',
   'Path traversal when --directory flag is omitted',
   'Always pass --directory flag to restrict filesystem access',
   'exact', 'flag-check', true),

  ('N/A',
   '@anthropic-ai/mcp-server-fetch',
   '<0.6.0', 'HIGH',
   'SSRF vulnerability',
   'Upgrade to @anthropic-ai/mcp-server-fetch >= 0.6.0',
   'exact', 'semver', true),

  ('N/A',
   'playwright-mcp',
   '<0.0.15', 'HIGH',
   'Arbitrary code execution vulnerability',
   'Upgrade to playwright-mcp >= 0.0.15',
   'exact', 'semver', true),

  ('N/A',
   '@anthropic-ai/mcp-server-memory',
   '<0.6.1', 'MEDIUM',
   'Knowledge graph injection vulnerability',
   'Upgrade to @anthropic-ai/mcp-server-memory >= 0.6.1',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-postgres',
   '<0.6.1', 'CRITICAL',
   'SQL injection vulnerability',
   'Upgrade to @modelcontextprotocol/server-postgres >= 0.6.1',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-sqlite',
   '<0.6.1', 'HIGH',
   'SQL injection vulnerability',
   'Upgrade to @modelcontextprotocol/server-sqlite >= 0.6.1',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-slack',
   '<0.6.1', 'MEDIUM',
   'Scope validation vulnerability',
   'Upgrade to @modelcontextprotocol/server-slack >= 0.6.1',
   'exact', 'semver', true),

  ('N/A',
   'mcp-server-kubernetes',
   '<0.3.0', 'CRITICAL',
   'Cluster-admin escalation vulnerability',
   'Upgrade to mcp-server-kubernetes >= 0.3.0',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-brave-search',
   '<0.6.0', 'MEDIUM',
   'API key leakage vulnerability',
   'Upgrade to @modelcontextprotocol/server-brave-search >= 0.6.0',
   'exact', 'semver', true),

  ('N/A',
   'mcp-server-docker',
   '<0.2.0', 'CRITICAL',
   'Container escape vulnerability',
   'Upgrade to mcp-server-docker >= 0.2.0',
   'exact', 'semver', true),

  ('N/A',
   '@modelcontextprotocol/server-puppeteer',
   '<0.6.0', 'HIGH',
   'JavaScript execution vulnerability',
   'Upgrade to @modelcontextprotocol/server-puppeteer >= 0.6.0',
   'exact', 'semver', true),

  ('N/A',
   'mcp-server-shell',
   'all versions', 'CRITICAL',
   'Unrestricted shell execution vulnerability',
   'Remove mcp-server-shell and use restricted alternatives',
   'exact', 'all', true),

  ('CVE-2025-54994',
   '@akoskm/create-mcp-server-stdio',
   'all versions', 'CRITICAL',
   'STDIO server creation allows arbitrary OS command execution',
   'Do not use this package. Use official MCP SDK scaffolding.',
   'exact', 'all', true),

  ('CVE-2025-59536',
   '@anthropic-ai/claude-code',
   'all versions', 'HIGH',
   'Config injection via .claude/settings.json Hooks enables RCE; MCP consent bypass via .mcp.json autoApprove',
   'Update to latest version, audit .claude/settings.json for malicious hooks',
   'exact', 'all', true),

  ('CVE-2026-22252',
   'librechat',
   '<0.7.6', 'CRITICAL',
   'STDIO command injection in LibreChat MCP integration',
   'Upgrade to LibreChat >= 0.7.6',
   'exact', 'semver', true),

  ('GHSA-c9gw-hvqq-f33r',
   'flowise',
   '<2.1.4', 'CRITICAL',
   'Command injection bypass via STDIO configuration — hardening bypass allows arbitrary execution',
   'Upgrade Flowise to >= 2.1.4',
   'exact', 'semver', true),

  ('CVE-2026-30625',
   'upsonic',
   '<0.36.0', 'CRITICAL',
   'Authenticated command injection via STDIO with hardening bypass',
   'Upgrade upsonic to >= 0.36.0',
   'exact', 'semver', true),

  ('CVE-2025-65720',
   'gpt-researcher',
   'all versions', 'HIGH',
   'STDIO transport command injection — no patch available',
   'Do not expose gpt-researcher MCP server to untrusted input',
   'exact', 'all', true),

  ('N/A',
   'mcp-server-apache-doris',
   'all versions', 'CRITICAL',
   'SQL injection — vendor declined to patch',
   'Do not use this server with untrusted input. No patch available.',
   'exact', 'all', true),

  ('N/A',
   'langflow',
   'all versions', 'CRITICAL',
   'STDIO command injection in LangFlow MCP integration — unpatched',
   'Block public IP access to LangFlow instances, apply network isolation',
   'exact', 'all', true),

  ('N/A',
   'whatsapp-mcp',
   'all versions', 'CRITICAL',
   'Full WhatsApp message history exfiltration via prompt injection',
   'Do not connect WhatsApp MCP to untrusted agents or tools',
   'exact', 'all', true),

  ('N/A',
   'mcp-server-langchain',
   '<0.2.0', 'HIGH',
   'STDIO injection via LangChain MCP server',
   'Upgrade to mcp-server-langchain >= 0.2.0, apply input sanitization',
   'exact', 'semver', true),

  ('N/A',
   'markitdown-mcp',
   'all versions', 'HIGH',
   'AWS credential theft demonstrated via MarkItDown MCP server',
   'Do not expose AWS credentials in the environment of MarkItDown MCP server',
   'exact', 'all', true)

ON CONFLICT (package_name) DO UPDATE SET
  cve_id            = EXCLUDED.cve_id,
  affected_versions = EXCLUDED.affected_versions,
  severity          = EXCLUDED.severity,
  description       = EXCLUDED.description,
  fix               = EXCLUDED.fix,
  match_type        = EXCLUDED.match_type,
  version_field     = EXCLUDED.version_field,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();
