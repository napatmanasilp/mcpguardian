import { VulnerablePackage } from './types';

export const KNOWN_VULNERABLE_PACKAGES: VulnerablePackage[] = [
  {
    name: 'mcp-remote',
    versions: '<0.1.9',
    cve: 'CVE-2025-6514',
    severity: 'CRITICAL',
    description: 'SSRF and credential theft vulnerability',
    fix: 'Upgrade to mcp-remote >= 0.1.9',
  },
  {
    name: '@anthropic-ai/mcp-server-git',
    versions: '<0.6.2',
    cve: 'CVE-2025-49596',
    severity: 'HIGH',
    description: 'Command injection vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-git >= 0.6.2',
  },
  {
    name: '@modelcontextprotocol/server-filesystem',
    versions: 'without --directory flag',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Path traversal vulnerability when --directory flag is not used',
    fix: 'Always use --directory flag to restrict filesystem access',
  },
  {
    name: '@anthropic-ai/mcp-server-fetch',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'SSRF vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-fetch >= 0.6.0',
  },
  {
    name: 'playwright-mcp',
    versions: '<0.0.15',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Arbitrary code execution vulnerability',
    fix: 'Upgrade to playwright-mcp >= 0.0.15',
  },
  {
    name: '@anthropic-ai/mcp-server-memory',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'Knowledge graph injection vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-memory >= 0.6.1',
  },
  {
    name: '@modelcontextprotocol/server-postgres',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'SQL injection vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-postgres >= 0.6.1',
  },
  {
    name: '@modelcontextprotocol/server-sqlite',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'SQL injection vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-sqlite >= 0.6.1',
  },
  {
    name: '@modelcontextprotocol/server-github',
    versions: '<0.6.2',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Token exposure vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-github >= 0.6.2',
  },
  {
    name: '@modelcontextprotocol/server-slack',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'Scope validation vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-slack >= 0.6.1',
  },
  {
    name: 'mcp-server-kubernetes',
    versions: '<0.3.0',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Cluster-admin escalation vulnerability',
    fix: 'Upgrade to mcp-server-kubernetes >= 0.3.0',
  },
  {
    name: '@modelcontextprotocol/server-brave-search',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'API key leakage vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-brave-search >= 0.6.0',
  },
  {
    name: 'mcp-server-docker',
    versions: '<0.2.0',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Container escape vulnerability',
    fix: 'Upgrade to mcp-server-docker >= 0.2.0',
  },
  {
    name: '@modelcontextprotocol/server-puppeteer',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'JavaScript execution vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-puppeteer >= 0.6.0',
  },
  {
    name: 'mcp-server-shell',
    versions: 'all versions',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Unrestricted shell execution vulnerability',
    fix: 'Remove mcp-server-shell and use restricted alternatives',
  },
];

export function checkForVulnerablePackages(serverConfig: string): VulnerablePackage[] {
  const found: VulnerablePackage[] = [];
  const configLower = serverConfig.toLowerCase();

  for (const pkg of KNOWN_VULNERABLE_PACKAGES) {
    if (configLower.includes(pkg.name.toLowerCase())) {
      found.push(pkg);
    }
  }

  return found;
}