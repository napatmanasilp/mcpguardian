<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/MCPGuardian-Security%20Scanner-8B5CF6?style=for-the-badge&logo=shield&logoColor=white">
    <img alt="MCPGuardian" src="https://img.shields.io/badge/MCPGuardian-Security%20Scanner-8B5CF6?style=for-the-badge&logo=shield&logoColor=white">
  </picture>
</p>

<p align="center">
  <b>Security scanning, runtime inspection, and proxy protection for MCP (Model Context Protocol) servers.</b><br>
  <img alt="Coverage" src="https://img.shields.io/badge/OWASP_MCP-~72%25-22c55e?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square">
</p>

---

## What It Detects

MCPGuardian scans MCP server configurations and runtime behavior across **36 issue types** organized into 9 categories. Each issue is mapped to the [OWASP MCP Top 10](https://owasp.org/www-project-mcp-top-10/) security framework.

| Category | Issues Detected | Max Severity | OWASP MCP |
|---|---|---|---|
| **Credential & Secret Exposure** | Hardcoded secrets, env var exposure, credential reflection, hardcoded args | CRITICAL | MCP01 |
| **Supply Chain & Provenance** | Vulnerable packages, typosquatting, slopsquatting, unpinned deps, unverified sources, prerelease packages | CRITICAL | MCP04 |
| **Permission & Filesystem** | Broad permissions, root FS access, unrestricted FS, file system resources, internal resource exposure | CRITICAL | MCP02 |
| **Tool Poisoning & Injection** | Tool/prompt/resource poisoning, hidden instruction tags, homoglyph attacks | CRITICAL | MCP03, MCP06 |
| **Execution & Transport** | STDIO transport, unsafe commands, command execution, consent bypass | CRITICAL | MCP05, MCP08 |
| **Authentication & Network** | Missing auth, weak Basic/Digest, no PKCE, no token expiry, insecure URL, legacy SSE | HIGH | MCP07 |
| **Cross-Server & Integrity** | Rug-pull detection, tool shadowing, cross-server manipulation, compound risk | CRITICAL | MCP09 |
| **Documentation** | Undocumented prompts, resource metadata | LOW | MCP10 |
| **Informational** | Probe failed, SBOM unavailable | LOW | — |

---

## Quick Start

### Scan via Web UI

Visit **[https://mcpguardian.dev/scan](https://mcpguardian.dev/scan)** — paste your MCP config JSON and get an instant security report with grade, score, and detailed issue breakdown.

### Scan via REST API

```bash
curl -X POST https://mcpguardian.dev/api/scan \
  -H "Content-Type: application/json" \
  -d '{"config": {"mcpServers": {"my-server": {"url": "https://example.com/mcp"}}}}'
```

Returns a `ScanResult` with grade (A–F), score, per-server issues, cross-server risk analysis, SBOM, and compliance summary.

### Use as MCP Tool (Claude Desktop / Cursor)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "mcpguardian": {
      "url": "https://mcpguardian.dev/api/mcp-server",
      "transport": "http"
    }
  }
}
```

**Available tools:**

| Tool | Description |
|---|---|
| `scan_mcp_config` | Scan an MCP config JSON and return a full security report |
| `check_mcp_server` | Live-probe an MCP server URL for runtime vulnerabilities |
| `lookup_cve` | Look up CVE details for a known MCP package |
| `verify_tool_definition` | Compare current tool definitions against a historical snapshot |
| `get_scan_history` | Retrieve recent scan results for your account |

### Use as Proxy Gateway

Point your MCP client at MCPGuardian's proxy instead of connecting to your MCP server directly:

```
POST https://mcpguardian.dev/api/proxy?upstream=<YOUR_MCP_SERVER_URL>
```

**Optional header:** `X-MCPGuardian-Mode: monitor | block | off`

- **monitor** (default) — logs all findings, never blocks
- **block** — blocks SSRF attempts and injection payloads with HTTP 403, sanitizes poisoned responses
- **off** — bypasses all inspection, zero overhead forwarding

The proxy appends `_mcpguardian` metadata to every response with mode, flags raised, session ID, and latency timing.

---

## Database Schema

MCPGuardian uses PostgreSQL (via Supabase) with the following tables:

### `profiles`

User profiles linked to Supabase Auth.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid PK` | References `auth.users` |
| `email` | `text` | User email |
| `plan` | `text` | Subscription plan (`free` / `pro`) |
| `stripe_customer_id` | `text` | Stripe customer ID for billing |
| `scans_this_month` | `integer` | Scans used in current billing period |
| `max_scans` | `integer` | Monthly scan limit |
| `created_at` | `timestamptz` | Account creation timestamp |

### `scans`

Scan results for a user's MCP config.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid PK` | Auto-generated |
| `user_id` | `uuid FK` | References `profiles.id` |
| `overall_grade` | `char(1)` | A–F grade |
| `overall_score` | `integer` | Numeric score (0–100) |
| `servers_scanned` | `integer` | Number of MCP servers evaluated |
| `critical_issues` | `integer` | Count of critical-severity issues |
| `high_issues` | `integer` | Count of high-severity issues |
| `results` | `jsonb` | Full scan result payload |
| `created_at` | `timestamptz` | Scan timestamp |

### `monitored_configs`

MCP configurations under continuous monitoring.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid PK` | Auto-generated |
| `user_id` | `uuid FK` | References `profiles.id` |
| `name` | `text` | Human-readable label |
| `config_json` | `jsonb` | MCP server configuration |
| `last_scan_id` | `uuid FK` | References most recent `scans.id` |
| `last_score` | `integer` | Score from most recent scan |
| `scan_frequency` | `text` | Cron-like schedule (`daily`, `hourly`) |
| `is_active` | `boolean` | Whether monitoring is enabled |
| `created_at` | `timestamptz` | Creation timestamp |

### `alerts`

Security alerts generated from scans or monitoring.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid PK` | Auto-generated |
| `user_id` | `uuid FK` | References `profiles.id` |
| `monitored_config_id` | `uuid FK` | References `monitored_configs.id` |
| `alert_type` | `text` | Issue type (e.g. `VULNERABLE_PACKAGE`) |
| `severity` | `text` | CRITICAL / HIGH / MEDIUM / LOW |
| `title` | `text` | Alert headline |
| `message` | `text` | Detailed description |
| `issue_key` | `text` | Dedup key (unique per active alert) |
| `recurrence_count` | `integer` | Times this alert has recurred |
| `read` | `boolean` | User read status |
| `resolved_at` | `timestamptz` | When the issue was resolved |
| `created_at` | `timestamptz` | Alert creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

### `mcp_cves`

Known CVE database for MCP ecosystem packages.

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid PK` | Auto-generated |
| `cve_id` | `text` | CVE identifier or `N/A` |
| `package_name` | `text UNIQUE` | Package name |
| `affected_versions` | `text` | Semver range or description |
| `fixed_version` | `text` | Patched version |
| `severity` | `text` | CRITICAL / HIGH / MEDIUM |
| `description` | `text` | Vulnerability description |
| `fix` | `text` | Remediation instructions |
| `match_type` | `text` | `exact` or `substring` |
| `version_field` | `text` | `semver`, `all`, or `flag-check` |
| `is_active` | `boolean` | Whether this entry is active |
| `published_at` | `timestamptz` | Original publish date |
| `created_at` | `timestamptz` | Created timestamp |
| `updated_at` | `timestamptz` | Updated timestamp |

### `tool_definition_snapshots`

Historical snapshots of server tool definitions for rug-pull detection.

| Column | Type | Purpose |
|---|---|---|
| `id` | `bigint PK` | Auto-generated identity |
| `config_hash` | `text` | Hash of MCP config |
| `server_url` | `text` | MCP server URL |
| `tools_hash` | `text` | SHA-256 hash of tool definitions |
| `tools_snapshot` | `jsonb` | Full tool definitions |
| `first_seen_at` | `timestamptz` | First observation |
| `last_seen_at` | `timestamptz` | Most recent observation |
| `change_count` | `integer` | Number of tool changes detected |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (admin) |
| `CRON_SECRET` | Yes | Shared secret for cron job authentication |
| `NVD_API_KEY` | No | NVD API key for CVE sync (optional, rate-limited without) |
| `RESEND_API_KEY` | No | Resend API key for transactional email |
| `POLAR_WEBHOOK_SECRET` | No | Polar webhook signing secret |
| `NEXT_PUBLIC_SITE_URL` | No | Public site URL (defaults to localhost:3000) |

---

## Compliance

MCPGuardian maps every detected issue to the OWASP MCP Top 10, OWASP Agentic Security, and NSA CSI frameworks. The compliance summary returned with each scan includes all framework categories that were triggered.

### OWASP MCP Top 10 Coverage

| ID | Category | Coverage | Detection Examples |
|---|---|---|---|
| MCP01 | Credential & Secret Exposure | ✅ Full | Hardcoded secrets, env exposure, credential reflection |
| MCP02 | Permission & Filesystem | ✅ Full | Broad FS perms, root access, internal resource exposure |
| MCP03 | Tool Poisoning & Injection | ✅ Full | Hidden instruction tags, homoglyph attacks, prompt/resource poisoning |
| MCP04 | Software Supply Chain Attacks | ✅ Full | Vulnerable packages, typosquatting, slopsquatting, unpinned deps |
| MCP05 | Execution & Transport | ✅ Full | STDIO transport, unsafe commands, command injection |
| MCP06 | Tool Poisoning (Extended) | ✅ Full | Tool/prompt/resource poisoning detection |
| MCP07 | Authentication & Network | ✅ Full | Missing auth, weak auth schemes, insecure URLs, legacy SSE |
| MCP08 | User Consent & Awareness | ✅ Full | Consent bypass detection |
| MCP09 | Cross-Server Integrity | ✅ Full | Rug-pull detection, tool shadowing, cross-server manipulation |
| MCP10 | Documentation & Transparency | ✅ Full | Undocumented prompts, probe metadata |

---

## Performance

Latency benchmarks (measured via `tests/proxy-latency.bench.ts`, 100 iterations each):

| Scenario | p50 | p95 | p99 | Max |
|---|---|---|---|---|
| Proxy overhead (inspection only) | < 1ms | < 2ms | < 5ms | < 10ms |
| Full round trip (mock upstream) | < 10ms | < 50ms | < 100ms | < 200ms |
| Block mode with SSRF rejection | < 1ms | < 2ms | < 5ms | < 10ms |

---

<p align="center">
  Built with Next.js, Supabase, and the MCP SDK.<br>
  <a href="https://mcpguardian.dev">mcpguardian.dev</a>
</p>
