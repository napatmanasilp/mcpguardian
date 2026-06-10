import { scanMcpConfig } from '@/lib/scanner';
import { loadVulnerabilities } from '@/lib/scanner/cve-loader';
import { KNOWN_SAFE_PACKAGES } from '@/lib/scanner/known-vulnerabilities';
import { scanToolForPoisoning, normalizeText } from '@/lib/scanner/runtime-probe';
import { Issue, ScanResult, ProbedTool } from '@/lib/scanner/types';

interface ToolInput {
  config?: Record<string, unknown>;
  url?: string;
  package_name?: string;
  version?: string;
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  server_url?: string;
  deep?: boolean;
  transport?: 'http' | 'stdio';
}

export async function handleScanMcpConfig(input: ToolInput): Promise<ScanResult> {
  const config = input.config;
  if (!config || typeof config !== 'object') {
    throw new Error('Missing required parameter: "config" must be an MCP server configuration object');
  }

  const vulnerabilities = await loadVulnerabilities();
  const configJson = JSON.stringify(config);
  const result = await scanMcpConfig(configJson, vulnerabilities);
  return result;
}

export async function handleCheckMcpServer(input: ToolInput): Promise<{
  url: string;
  transport: string;
  reachable: boolean;
  requiresAuth: boolean;
  toolCount: number;
  issues: Issue[];
  tools: ProbedTool[];
}> {
  const url = input.url;
  if (!url) {
    throw new Error('Missing required parameter: "url"');
  }

  const transport = input.transport || 'http';

  if (transport === 'http') {
    const { probeHttpMcpServer } = await import('@/lib/scanner/runtime-probe');
    const probeResult = await probeHttpMcpServer(url);
    return {
      url,
      transport,
      reachable: probeResult.reachable && !probeResult.probeError,
      requiresAuth: probeResult.requiresAuth,
      toolCount: probeResult.toolCount,
      issues: probeResult.poisoningIssues,
      tools: probeResult.tools,
    };
  }

  // STDIO not probeable — return informational
  return {
    url,
    transport,
    reachable: false,
    requiresAuth: false,
    toolCount: 0,
    issues: [{
      type: 'STDIO_TRANSPORT',
      severity: 'LOW',
      title: 'STDIO transport servers cannot be probed remotely',
      description: 'MCPGuardian can only probe HTTP/HTTPS MCP servers. STDIO servers require a local configuration scan.',
      fix: 'Use scan_mcp_config with the full config instead, or switch to HTTPS transport.',
      deduction: 0,
    }],
    tools: [],
  };
}

export async function handleLookupCve(input: ToolInput): Promise<{
  cves: Array<{
    cve: string;
    package_name: string;
    affected_versions: string;
    severity: string;
    description: string;
    fix: string;
  }>;
  safe_version: string | null;
  known_safe: boolean;
}> {
  const packageName = input.package_name;
  const version = input.version;

  if (!packageName) {
    throw new Error('Missing required parameter: "package_name"');
  }

  const vulnerabilities = await loadVulnerabilities();
  const matching = vulnerabilities.filter(
    v => v.name.toLowerCase() === packageName.toLowerCase(),
  );

  const cves = matching.map(v => ({
    cve: v.cve,
    package_name: v.name,
    affected_versions: v.versions,
    severity: v.severity,
    description: v.description,
    fix: v.fix,
  }));

  const isSafe = KNOWN_SAFE_PACKAGES.some(
    s => s.toLowerCase() === packageName.toLowerCase(),
  );

  // If a version was provided, check if it's affected
  let safeVersion: string | null = null;
  if (version && matching.length > 0) {
    const semver = await import('semver');
    const affected = matching.some(v => {
      if (v.versionField === 'all') return true;
      if (v.versionField === 'semver' && semver.satisfies(version, v.versions)) return true;
      return false;
    });

    if (!affected) {
      safeVersion = version;
    } else if (matching[0].fix) {
      const fixMatch = matching[0].fix.match(/>=\s*([\d.]+)/);
      if (fixMatch) safeVersion = fixMatch[1];
    }
  }

  return {
    cves,
    safe_version: safeVersion,
    known_safe: isSafe && cves.length === 0,
  };
}

export async function handleVerifyToolDefinition(input: ToolInput): Promise<{
  safe: boolean;
  issues: Array<{ flag: string; weight: number; description: string }>;
  normalized_description: string;
}> {
  const name = input.name || '';
  const description = input.description || '';
  const inputSchema = input.inputSchema || {};

  if (!name && !description) {
    throw new Error('Missing required parameter: "name" or "description"');
  }

  const searchText = `${name} ${description} ${JSON.stringify(inputSchema)}`;
  const normalized = normalizeText(searchText);
  const result = scanToolForPoisoning({ name, description, inputSchema });

  const issues = result.flags.map(flag => ({
    flag,
    weight: result.suspiciousScore,
    description: `Tool "${name}" flagged for: ${flag}`,
  }));

  return {
    safe: result.suspiciousScore === 0 && issues.length === 0,
    issues,
    normalized_description: normalized,
  };
}

export async function handleGetScanHistory(input: ToolInput): Promise<{
  snapshots: Array<{
    config_hash: string;
    server_url: string;
    tools_hash: string;
    change_count: number;
    first_seen_at: string;
    last_seen_at: string;
    tools_snapshot: unknown[];
  }>;
  rug_pulls_detected: number;
}> {
  const serverUrl = input.server_url;
  if (!serverUrl) {
    throw new Error('Missing required parameter: "server_url"');
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('tool_definition_snapshots')
      .select('*')
      .eq('server_url', serverUrl)
      .order('last_seen_at', { ascending: false });

    if (error) {
      return { snapshots: [], rug_pulls_detected: 0 };
    }

    const snapshots = (data || []).map((row: Record<string, unknown>) => ({
      config_hash: row.config_hash as string,
      server_url: row.server_url as string,
      tools_hash: row.tools_hash as string,
      change_count: row.change_count as number,
      first_seen_at: row.first_seen_at as string,
      last_seen_at: row.last_seen_at as string,
      tools_snapshot: row.tools_snapshot as unknown[],
    }));

    const rugPulls = snapshots.filter(s => s.change_count > 1).length;

    return { snapshots, rug_pulls_detected: rugPulls };
  } catch {
    return { snapshots: [], rug_pulls_detected: 0 };
  }
}
