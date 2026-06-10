-- ShieldMCP: Seed mcp_cves table with known MCP CVEs
-- Adds missing columns, seeds data, updates RLS for public read

-- Make original unused columns nullable (they predate the current schema)
alter table public.mcp_cves alter column cvss_score drop not null;
alter table public.mcp_cves alter column published_at drop not null;

-- Add missing columns
alter table public.mcp_cves add column if not exists fix text;
alter table public.mcp_cves add column if not exists match_type text not null default 'exact';
alter table public.mcp_cves add column if not exists version_field text not null default 'semver';
alter table public.mcp_cves add column if not exists is_active boolean not null default true;
alter table public.mcp_cves add column if not exists created_at timestamptz not null default now();
alter table public.mcp_cves add column if not exists updated_at timestamptz not null default now();

-- Drop the cve_id unique constraint (too many entries share 'N/A') and re-add on package_name
alter table public.mcp_cves drop constraint if exists mcp_cves_cve_id_key;
alter table public.mcp_cves add constraint mcp_cves_package_name_key unique (package_name);

-- Update RLS: allow public read (not just authenticated)
drop policy if exists "Authenticated users can view CVEs" on public.mcp_cves;
create policy "Anyone can view CVEs"
  on public.mcp_cves
  for select
  using (true);

-- Seed data (upsert on package_name to make it idempotent)
insert into public.mcp_cves (cve_id, package_name, affected_versions, severity, description, fix, match_type, version_field, is_active)
values
  ('CVE-2025-6514', 'mcp-remote', '<0.1.9', 'CRITICAL', 'SSRF and credential theft vulnerability', 'Upgrade to mcp-remote >= 0.1.9', 'exact', 'semver', true),
  ('CVE-2025-49596', '@anthropic-ai/mcp-server-git', '<0.6.2', 'HIGH', 'Command injection vulnerability', 'Upgrade to @anthropic-ai/mcp-server-git >= 0.6.2', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-filesystem', 'without --directory flag', 'HIGH', 'Path traversal vulnerability when --directory flag is not used', 'Always use --directory flag to restrict filesystem access', 'exact', 'flag-check', true),
  ('N/A', '@anthropic-ai/mcp-server-fetch', '<0.6.0', 'HIGH', 'SSRF vulnerability', 'Upgrade to @anthropic-ai/mcp-server-fetch >= 0.6.0', 'exact', 'semver', true),
  ('N/A', 'playwright-mcp', '<0.0.15', 'HIGH', 'Arbitrary code execution vulnerability', 'Upgrade to playwright-mcp >= 0.0.15', 'exact', 'semver', true),
  ('N/A', '@anthropic-ai/mcp-server-memory', '<0.6.1', 'MEDIUM', 'Knowledge graph injection vulnerability', 'Upgrade to @anthropic-ai/mcp-server-memory >= 0.6.1', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-postgres', '<0.6.1', 'CRITICAL', 'SQL injection vulnerability', 'Upgrade to @modelcontextprotocol/server-postgres >= 0.6.1', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-sqlite', '<0.6.1', 'HIGH', 'SQL injection vulnerability', 'Upgrade to @modelcontextprotocol/server-sqlite >= 0.6.1', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-github', '<0.6.2', 'HIGH', 'Token exposure vulnerability', 'Upgrade to @modelcontextprotocol/server-github >= 0.6.2', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-slack', '<0.6.1', 'MEDIUM', 'Scope validation vulnerability', 'Upgrade to @modelcontextprotocol/server-slack >= 0.6.1', 'exact', 'semver', true),
  ('N/A', 'mcp-server-kubernetes', '<0.3.0', 'CRITICAL', 'Cluster-admin escalation vulnerability', 'Upgrade to mcp-server-kubernetes >= 0.3.0', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-brave-search', '<0.6.0', 'MEDIUM', 'API key leakage vulnerability', 'Upgrade to @modelcontextprotocol/server-brave-search >= 0.6.0', 'exact', 'semver', true),
  ('N/A', 'mcp-server-docker', '<0.2.0', 'CRITICAL', 'Container escape vulnerability', 'Upgrade to mcp-server-docker >= 0.2.0', 'exact', 'semver', true),
  ('N/A', '@modelcontextprotocol/server-puppeteer', '<0.6.0', 'HIGH', 'JavaScript execution vulnerability', 'Upgrade to @modelcontextprotocol/server-puppeteer >= 0.6.0', 'exact', 'semver', true),
   ('N/A', 'mcp-server-shell', 'all versions', 'CRITICAL', 'Unrestricted shell execution vulnerability', 'Remove mcp-server-shell and use restricted alternatives', 'exact', 'all', true),
   -- 15 new 2026 CVEs
   ('CVE-2025-54994', '@akoskm/create-mcp-server-stdio', 'all versions', 'CRITICAL', 'STDIO server creation allows arbitrary OS command execution', 'Do not use this package. Use official MCP SDK scaffolding.', 'exact', 'all', true),
   ('CVE-2025-59536', '@anthropic-ai/claude-code', 'all versions', 'HIGH', 'Configuration injection via .claude/settings.json Hooks enables RCE on project open. MCP consent bypass via .mcp.json autoApprove.', 'Update to latest version, audit .claude/settings.json for malicious hooks', 'exact', 'all', true),
   ('CVE-2026-22252', 'librechat', '<0.7.6', 'CRITICAL', 'STDIO command injection in LibreChat MCP integration', 'Upgrade to LibreChat 0.7.6+', 'exact', 'semver', true),
   ('GHSA-c9gw-hvqq-f33r', 'flowise', '<2.1.4', 'CRITICAL', 'Command injection bypass via STDIO configuration — hardening bypass allows arbitrary execution despite allowlist', 'Upgrade Flowise to 2.1.4+', 'exact', 'semver', true),
   ('CVE-2026-30625', 'upsonic', '<0.36.0', 'CRITICAL', 'Authenticated command injection via STDIO with hardening bypass', 'Upgrade upsonic to 0.36.0+', 'exact', 'semver', true),
   ('CVE-2025-65720', 'gpt-researcher', 'all versions', 'HIGH', 'STDIO transport command injection — no patch available', 'Do not expose gpt-researcher MCP server to untrusted input', 'exact', 'all', true),
   ('N/A (Akamai June 2026)', 'mcp-server-apache-doris', 'all versions', 'CRITICAL', 'SQL injection in Apache Doris MCP server — vendor declined to patch', 'Do not use this server with untrusted input. No patch available.', 'exact', 'all', true),
   ('CVE-2025-68143', '@modelcontextprotocol/server-github', '<0.7.0', 'HIGH', 'Private repository access via prompt injection through MCP GitHub server', 'Upgrade to 0.7.0+, restrict to read-only token scopes', 'exact', 'semver', true),
   ('CVE-2025-68144', '@anthropic-ai/mcp-server-git', '<0.7.0', 'CRITICAL', 'Exploit chain enabling RCE via git command injection — 3-step chain', 'Upgrade to 0.7.0+, never use with untrusted repository paths', 'exact', 'semver', true),
   ('N/A (disclosed Jan 2026)', 'langflow', 'all versions', 'CRITICAL', 'STDIO command injection in LangFlow MCP integration — unpatched', 'Block public IP access to LangFlow instances, apply network isolation', 'exact', 'all', true),
   ('CVE-2025-54136', 'mcp-remote', '<0.3.0', 'HIGH', 'SSRF and credential theft — expanded scope beyond original CVE-2025-6514', 'Upgrade to mcp-remote 0.3.0+', 'exact', 'semver', true),
   ('N/A (VIPER-MCP 2026)', '@modelcontextprotocol/server-filesystem', 'all versions', 'HIGH', 'Path traversal via symbolic link following bypasses --directory restriction', 'Add --follow-symlinks=false flag, upgrade to latest version', 'exact', 'flag-check', true),
   ('N/A (Invariant Labs 2025)', 'whatsapp-mcp', 'all versions', 'CRITICAL', 'Full WhatsApp message history exfiltration via prompt injection through MCP', 'Do not connect WhatsApp MCP to untrusted agents or tools', 'exact', 'all', true),
   ('N/A', 'mcp-server-langchain', '<0.2.0', 'HIGH', 'STDIO injection via LangChain MCP server — same architectural root cause', 'Upgrade to 0.2.0+, apply input sanitization', 'exact', 'semver', true),
   ('N/A (2026 research)', 'markitdown-mcp', 'all versions', 'HIGH', 'AWS credential theft demonstrated via MarkItDown MCP server', 'Do not expose AWS credentials in environment of MarkItDown MCP server', 'exact', 'all', true)
on conflict (package_name) do update set
  package_name = excluded.package_name,
  affected_versions = excluded.affected_versions,
  severity = excluded.severity,
  description = excluded.description,
  fix = excluded.fix,
  match_type = excluded.match_type,
  version_field = excluded.version_field,
  is_active = excluded.is_active,
  updated_at = now();
