import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import semver from 'semver';
import { Issue, VulnerablePackage, Severity, SbomEntry } from './types';

export const KNOWN_VULNERABLE_PACKAGES: VulnerablePackage[] = [
  {
    name: 'mcp-remote',
    versions: '<0.1.9',
    cve: 'CVE-2025-6514',
    severity: 'CRITICAL',
    description: 'SSRF and credential theft vulnerability',
    fix: 'Upgrade to mcp-remote >= 0.1.9',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@anthropic-ai/mcp-server-git',
    versions: '<0.6.2',
    cve: 'CVE-2025-49596',
    severity: 'HIGH',
    description: 'Command injection vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-git >= 0.6.2',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-filesystem',
    versions: 'without --directory flag',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Path traversal vulnerability when --directory flag is not used',
    fix: 'Always use --directory flag to restrict filesystem access',
    matchType: 'exact',
    versionField: 'flag-check',
  },
  {
    name: '@anthropic-ai/mcp-server-fetch',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'SSRF vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-fetch >= 0.6.0',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'playwright-mcp',
    versions: '<0.0.15',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Arbitrary code execution vulnerability',
    fix: 'Upgrade to playwright-mcp >= 0.0.15',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@anthropic-ai/mcp-server-memory',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'Knowledge graph injection vulnerability',
    fix: 'Upgrade to @anthropic-ai/mcp-server-memory >= 0.6.1',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-postgres',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'SQL injection vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-postgres >= 0.6.1',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-sqlite',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'SQL injection vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-sqlite >= 0.6.1',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-github',
    versions: '<0.6.2',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'Token exposure vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-github >= 0.6.2',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-slack',
    versions: '<0.6.1',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'Scope validation vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-slack >= 0.6.1',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'mcp-server-kubernetes',
    versions: '<0.3.0',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Cluster-admin escalation vulnerability',
    fix: 'Upgrade to mcp-server-kubernetes >= 0.3.0',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-brave-search',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'MEDIUM',
    description: 'API key leakage vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-brave-search >= 0.6.0',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'mcp-server-docker',
    versions: '<0.2.0',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Container escape vulnerability',
    fix: 'Upgrade to mcp-server-docker >= 0.2.0',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-puppeteer',
    versions: '<0.6.0',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'JavaScript execution vulnerability',
    fix: 'Upgrade to @modelcontextprotocol/server-puppeteer >= 0.6.0',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'mcp-server-shell',
    versions: 'all versions',
    cve: 'N/A',
    severity: 'CRITICAL',
    description: 'Unrestricted shell execution vulnerability',
    fix: 'Remove mcp-server-shell and use restricted alternatives',
    matchType: 'exact',
    versionField: 'all',
  },
  // ── 15 new 2026 CVEs (Jan–Apr disclosures) ──────────────────────
  {
    name: '@akoskm/create-mcp-server-stdio',
    versions: 'all versions',
    cve: 'CVE-2025-54994',
    severity: 'CRITICAL',
    description: 'STDIO server creation allows arbitrary OS command execution',
    fix: 'Do not use this package. Use official MCP SDK scaffolding.',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: '@anthropic-ai/claude-code',
    versions: 'all versions',
    cve: 'CVE-2025-59536',
    severity: 'HIGH',
    description: 'Configuration injection via .claude/settings.json Hooks enables RCE on project open. MCP consent bypass via .mcp.json autoApprove.',
    fix: 'Update to latest version, audit .claude/settings.json for malicious hooks',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: 'librechat',
    versions: '<0.7.6',
    cve: 'CVE-2026-22252',
    severity: 'CRITICAL',
    description: 'STDIO command injection in LibreChat MCP integration',
    fix: 'Upgrade to LibreChat 0.7.6+',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'flowise',
    versions: '<2.1.4',
    cve: 'GHSA-c9gw-hvqq-f33r',
    severity: 'CRITICAL',
    description: 'Command injection bypass via STDIO configuration — hardening bypass allows arbitrary execution despite allowlist',
    fix: 'Upgrade Flowise to 2.1.4+',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'upsonic',
    versions: '<0.36.0',
    cve: 'CVE-2026-30625',
    severity: 'CRITICAL',
    description: 'Authenticated command injection via STDIO with hardening bypass',
    fix: 'Upgrade upsonic to 0.36.0+',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'gpt-researcher',
    versions: 'all versions',
    cve: 'CVE-2025-65720',
    severity: 'HIGH',
    description: 'STDIO transport command injection — no patch available',
    fix: 'Do not expose gpt-researcher MCP server to untrusted input',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: 'mcp-server-apache-doris',
    versions: 'all versions',
    cve: 'N/A (Akamai June 2026)',
    severity: 'CRITICAL',
    description: 'SQL injection in Apache Doris MCP server — vendor declined to patch',
    fix: 'Do not use this server with untrusted input. No patch available.',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: '@modelcontextprotocol/server-github',
    versions: '<0.7.0',
    cve: 'CVE-2025-68143',
    severity: 'HIGH',
    description: 'Private repository access via prompt injection through MCP GitHub server',
    fix: 'Upgrade to 0.7.0+, restrict to read-only token scopes',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@anthropic-ai/mcp-server-git',
    versions: '<0.7.0',
    cve: 'CVE-2025-68144',
    severity: 'CRITICAL',
    description: 'Exploit chain enabling RCE via git command injection — 3-step chain',
    fix: 'Upgrade to 0.7.0+, never use with untrusted repository paths',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'langflow',
    versions: 'all versions',
    cve: 'N/A (disclosed Jan 2026)',
    severity: 'CRITICAL',
    description: 'STDIO command injection in LangFlow MCP integration — unpatched',
    fix: 'Block public IP access to LangFlow instances, apply network isolation',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: 'mcp-remote',
    versions: '<0.3.0',
    cve: 'CVE-2025-54136',
    severity: 'HIGH',
    description: 'SSRF and credential theft — expanded scope beyond original CVE-2025-6514',
    fix: 'Upgrade to mcp-remote 0.3.0+',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: '@modelcontextprotocol/server-filesystem',
    versions: 'all versions',
    cve: 'N/A (VIPER-MCP 2026)',
    severity: 'HIGH',
    description: 'Path traversal via symbolic link following bypasses --directory restriction',
    fix: 'Add --follow-symlinks=false flag, upgrade to latest version',
    matchType: 'exact',
    versionField: 'flag-check',
  },
  {
    name: 'whatsapp-mcp',
    versions: 'all versions',
    cve: 'N/A (Invariant Labs 2025)',
    severity: 'CRITICAL',
    description: 'Full WhatsApp message history exfiltration via prompt injection through MCP',
    fix: 'Do not connect WhatsApp MCP to untrusted agents or tools',
    matchType: 'exact',
    versionField: 'all',
  },
  {
    name: 'mcp-server-langchain',
    versions: '<0.2.0',
    cve: 'N/A',
    severity: 'HIGH',
    description: 'STDIO injection via LangChain MCP server — same architectural root cause',
    fix: 'Upgrade to 0.2.0+, apply input sanitization',
    matchType: 'exact',
    versionField: 'semver',
  },
  {
    name: 'markitdown-mcp',
    versions: 'all versions',
    cve: 'N/A (2026 research)',
    severity: 'HIGH',
    description: 'AWS credential theft demonstrated via MarkItDown MCP server',
    fix: 'Do not expose AWS credentials in environment of MarkItDown MCP server',
    matchType: 'exact',
    versionField: 'all',
  },
];

function parsePackageRef(ref: string): { name: string; version: string | null } {
  if (ref.startsWith('@')) {
    const slashIdx = ref.indexOf('/');
    if (slashIdx === -1) return { name: ref, version: null };
    const afterSlash = ref.slice(slashIdx + 1);
    const atIdx = afterSlash.indexOf('@');
    if (atIdx === -1) return { name: ref, version: null };
    return {
      name: ref.slice(0, slashIdx + 1 + atIdx),
      version: afterSlash.slice(atIdx + 1),
    };
  }
  const atIdx = ref.indexOf('@');
  if (atIdx === -1) return { name: ref, version: null };
  return {
    name: ref.slice(0, atIdx),
    version: ref.slice(atIdx + 1),
  };
}

function extractPackageRef(command?: string, args?: string[]): { name: string; version: string | null } | null {
  const allArgs = args ?? [];
  const runners = new Set(['npx', 'uvx', 'npm', 'yarn', 'pnpm', 'bun']);

  let packageRef: string | undefined;

  if (command && !runners.has(command)) {
    packageRef = command;
  } else if (command && runners.has(command)) {
    if (allArgs.length === 0) return null;
    if (allArgs[0] === '-y' && allArgs.length > 1) {
      packageRef = allArgs[1];
    } else {
      packageRef = allArgs[0];
    }
  } else {
    return null;
  }

  return parsePackageRef(packageRef);
}

function severityDeduction(severity: Severity): number {
  if (severity === 'CRITICAL') return 25;
  if (severity === 'HIGH') return 15;
  if (severity === 'MEDIUM') return 10;
  return 5;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export const HALLUCINATED_PACKAGES: string[] = [
  // ── AI-hallucinated packages documented in slopsquatting research ──
  // Sources: USENIX Security '25, Aikido Intel, Socket.dev, CSA Lab Space,
  // Lyrie Research, ToxSec slopcheck, arXiv 2605.17062 (May 2026 replication)
  // Conflations (two real packages mashed together by LLMs):
  'express-mongoose',
  'react-codeshift',
  'react-router-query',
  'express-router-middleware',
  'typescript-eslint',
  'python-requests',
  'python-dateutil-helper',
  // Pure fabrications with real-like names:
  'huggingface-cli',
  'unused-imports',
  'eslint-plugin-unused-imports',
  'npm-package-utils',
  'cli-helper',
  'api-wrapper-utils',
  'config-loader',
  'dotenv-manager',
  'logger-middleware',
  'auth-helper',
  'database-connector-utils',
  // Cross-ecosystem hallucinated names (8.7% of hallucinated Python names = real npm packages):
  'server-utils',
  'data-validator',
  'cache-manager-helper',
  'file-upload-middleware',
  'rate-limiter-utils',
];

export const KNOWN_SAFE_PACKAGES: string[] = [
  '@modelcontextprotocol/server-filesystem',
  '@modelcontextprotocol/server-postgres',
  '@modelcontextprotocol/server-sqlite',
  '@modelcontextprotocol/server-github',
  '@modelcontextprotocol/server-slack',
  '@modelcontextprotocol/server-brave-search',
  '@modelcontextprotocol/server-puppeteer',
  '@anthropic-ai/mcp-server-fetch',
  '@anthropic-ai/mcp-server-git',
  '@anthropic-ai/mcp-server-memory',
  'mcp-remote',
  'playwright-mcp',
  'mcp-server-kubernetes',
  'mcp-server-docker',
  'mcp-server-shell',
  '@akoskm/create-mcp-server-stdio',
  '@anthropic-ai/claude-code',
  'librechat',
  'flowise',
  'upsonic',
  'gpt-researcher',
  'mcp-server-apache-doris',
  'langflow',
  'whatsapp-mcp',
  'mcp-server-langchain',
  'markitdown-mcp',
];

export function checkSupplyChain(
  serverName: string,
  command?: string,
  args?: string[],
): Issue[] {
  const ref = extractPackageRef(command, args);
  if (!ref) return [];

  const issues: Issue[] = [];
  const allArgs = args ?? [];
  const argsJoined = allArgs.join(' ').toLowerCase();
  const isNpx = command?.toLowerCase() === 'npx';

  // 1. Typosquat detection
  const closestMatch = KNOWN_SAFE_PACKAGES.find(pkg => {
    const dist = levenshtein(ref.name.toLowerCase(), pkg.toLowerCase());
    return dist > 0 && dist <= 2;
  });

  if (closestMatch) {
    issues.push({
      type: 'TYPOSQUAT_RISK',
      severity: 'HIGH',
      title: `Possible typosquatted package: '${ref.name}' resembles '${closestMatch}'`,
      description: `Package "${ref.name}" has Levenshtein distance ≤ 2 from known safe package "${closestMatch}"`,
      fix: `Verify this is the intended package. Possible typosquat of ${closestMatch}`,
      deduction: 20,
    });
  }

  // 2. Slopsquatting detection — known AI-hallucinated package names
  const isHallucinated = HALLUCINATED_PACKAGES.some(
    h => ref.name.toLowerCase() === h.toLowerCase(),
  );
  if (isHallucinated) {
    issues.push({
      type: 'SLOPSQUATTING_RISK',
      severity: 'CRITICAL',
      title: `AI-hallucinated package detected: ${ref.name}`,
      description: `This package name matches a known AI-hallucinated package commonly used in slopsquatting attacks. "${ref.name}" does not exist as a legitimate package and was invented by an LLM. Attackers pre-register these names to distribute malware. (Ref: USENIX Security '25, arXiv 2605.17062)`,
      fix: `Remove "${ref.name}" and replace with the correct real package name. Verify all AI-recommended packages against the registry before installing.`,
      deduction: 30,
    });
  }

  // 3. Unpinned version / @latest / range specifier
  const hasNoVersion = ref.version === null || ref.version === '';
  const isLatest = ref.version?.toLowerCase() === 'latest';
  const rangeSpecifier = ref.version ? /^[~^]|\.x\b|\*/.test(ref.version) : false;

  if (isNpx && (hasNoVersion || isLatest)) {
    issues.push({
      type: 'UNPINNED_DEPENDENCY',
      severity: 'MEDIUM',
      title: 'Unpinned package version — supply chain risk',
      description: `Package "${ref.name}"${ref.version ? '@' + ref.version : ''} has no pinned version. npm registry packages can be compromised and updated without your knowledge.`,
      fix: `Pin to a specific version: npx -y ${ref.name}@1.2.3`,
      deduction: 10,
    });
  }

  // 3b. Unpinned dependency escalation — range specifier + known CVE
  if (isNpx && rangeSpecifier && !hasNoVersion && !isLatest) {
    const matchedVulns = KNOWN_VULNERABLE_PACKAGES.filter(
      pkg => ref.name.toLowerCase() === pkg.name.toLowerCase(),
    );
    for (const vuln of matchedVulns) {
      const verStr = ref.version!;

      if (vuln.versionField !== 'semver') {
        issues.push({
          type: 'UNPINNED_DEPENDENCY',
          severity: 'HIGH',
          title: `Unpinned version range with known CVE: ${ref.name}@${verStr}`,
          description: `Package "${ref.name}" uses range specifier "${verStr}" and has a known CVE (${vuln.cve}: ${vuln.description}). Unpinned version range may auto-install vulnerable version on next install.`,
          fix: `Pin to a specific safe version: npx -y ${ref.name}@<safe-version>`,
          deduction: 15,
        });
        continue;
      }

      const cveRange = vuln.versions;
      try {
        const overlaps = semver.intersects(verStr, cveRange);
        if (overlaps) {
          issues.push({
            type: 'UNPINNED_DEPENDENCY',
            severity: 'HIGH',
            title: `Unpinned version range with known CVE: ${ref.name}@${verStr}`,
            description: `Range "${verStr}" overlaps CVE-affected range "${cveRange}" (${vuln.cve}: ${vuln.description}). Upgrade to a safe version.`,
            fix: `Pin to a specific safe version: npx -y ${ref.name}@<safe-version>`,
            deduction: 15,
          });
        } else {
          issues.push({
            type: 'UNPINNED_DEPENDENCY',
            severity: 'LOW',
            title: `Unpinned version range (no CVE overlap): ${ref.name}@${verStr}`,
            description: `Unpinned range "${verStr}" does not overlap current CVE range "${cveRange}" (${vuln.cve}). Pin anyway to prevent future exposure.`,
            fix: `Pin to a specific safe version: npx -y ${ref.name}@<safe-version>`,
            deduction: 5,
          });
        }
      } catch {
        issues.push({
          type: 'UNPINNED_DEPENDENCY',
          severity: 'HIGH',
          title: `Unpinned version range with known CVE: ${ref.name}@${verStr}`,
          description: `Package "${ref.name}" uses range specifier "${verStr}" and has a known CVE (${vuln.cve}: ${vuln.description}). Version range could not be parsed — treat as vulnerable.`,
          fix: `Pin to a specific safe version: npx -y ${ref.name}@<safe-version>`,
          deduction: 15,
        });
      }
    }
  }

  // 4. Unverified source (git URL, file path, http://)
  const hasUnverifiedSource = allArgs.some(a => {
    const lower = a.toLowerCase();
    return (
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('git+') ||
      lower.startsWith('git@') ||
      lower.startsWith('/') ||
      lower.startsWith('./') ||
      lower.startsWith('../') ||
      lower.startsWith('~/')
    );
  });

  if (hasUnverifiedSource) {
    issues.push({
      type: 'UNVERIFIED_SOURCE',
      severity: 'HIGH',
      title: 'Package loaded from unverified source (not npm registry)',
      description: `Server "${serverName}" uses a package from a non-registry source: ${allArgs.filter(a => /^https?:\/\/|^git\+|^git@|^\//.test(a)).join(', ') || 'local path'}`,
      fix: 'Use only packages from the npm registry. Avoid loading packages from URLs, git repos, or local file paths.',
      deduction: 15,
    });
  }

  // 4. Pre-release tags
  if (ref.version) {
    const versionLower = ref.version.toLowerCase();
    const prereleaseTags = ['alpha', 'beta', 'next', 'canary', 'rc'];
    const isPrerelease = prereleaseTags.some(tag => versionLower.includes(tag));
    if (isPrerelease) {
      issues.push({
        type: 'PRERELEASE_PACKAGE',
        severity: 'MEDIUM',
        title: `Package using pre-release version: ${ref.name}@${ref.version}`,
        description: `Package "${ref.name}" is pinned to a pre-release version tag "${ref.version}". Pre-release versions may have undiscovered security vulnerabilities.`,
        fix: 'Pin to a stable release version instead of a pre-release tag.',
        deduction: 10,
      });
    }
  }

  return issues;
}

export function checkForVulnerablePackages(
  serverName: string,
  command?: string,
  args?: string[],
  vulnerabilities: VulnerablePackage[] = KNOWN_VULNERABLE_PACKAGES,
): Issue[] {
  const ref = extractPackageRef(command, args);
  if (!ref) return [];

  const issues: Issue[] = [];

  for (const pkg of vulnerabilities) {
    let nameMatches = false;
    if (pkg.matchType === 'exact') {
      nameMatches = ref.name.toLowerCase() === pkg.name.toLowerCase();
    } else {
      nameMatches = ref.name.toLowerCase().includes(pkg.name.toLowerCase());
    }
    if (!nameMatches) continue;

    // Part C: STDIO severity upgrade — if server uses STDIO (command present)
    // and the matched CVE is HIGH, upgrade to CRITICAL (STDIO + known CVE = RCE)
    const effectiveSeverity: Severity =
      !!command && pkg.severity === 'HIGH' ? 'CRITICAL' : pkg.severity;

    if (pkg.versionField === 'all') {
      issues.push({
        type: 'VULNERABLE_PACKAGE',
        severity: effectiveSeverity,
        title: `Vulnerable package detected: ${pkg.name}`,
        description: `${pkg.name} (${pkg.versions}) - ${pkg.description} (${pkg.cve})`,
        fix: pkg.fix,
        deduction: severityDeduction(effectiveSeverity),
      });
    } else if (pkg.versionField === 'semver') {
      if (ref.version === null) {
        issues.push({
          type: 'VULNERABLE_PACKAGE',
          severity: effectiveSeverity,
          title: `Vulnerable package detected: ${pkg.name}`,
          description: `${pkg.name} version unknown — assume vulnerable, pin to latest safe version (${pkg.fix})`,
          fix: pkg.fix,
          deduction: severityDeduction(effectiveSeverity),
        });
      } else if (semver.satisfies(ref.version, pkg.versions)) {
        issues.push({
          type: 'VULNERABLE_PACKAGE',
          severity: effectiveSeverity,
          title: `Vulnerable package detected: ${pkg.name}`,
          description: `${pkg.name}@${ref.version} (${pkg.versions}) - ${pkg.description} (${pkg.cve})`,
          fix: pkg.fix,
          deduction: severityDeduction(effectiveSeverity),
        });
      }
    } else if (pkg.versionField === 'flag-check') {
      const allArgs = args ?? [];
      const hasFlag = allArgs.some(a => a === '--directory' || a === '--root-dir');
      if (!hasFlag) {
        issues.push({
          type: 'VULNERABLE_PACKAGE',
          severity: effectiveSeverity,
          title: `Vulnerable package detected: ${pkg.name}`,
          description: `${pkg.name} (${pkg.versions}) - ${pkg.description} (${pkg.cve})`,
          fix: pkg.fix,
          deduction: severityDeduction(effectiveSeverity),
        });
      }
    }
  }

  return issues;
}

const RUNNER_COMMANDS = new Set(['npx', 'uvx', 'npm', 'yarn', 'pnpm', 'bun', 'node', 'python', 'python3', 'deno']);

function tryReadPackageJson(dir: string): Record<string, unknown> | null {
  try {
    const p = join(dir, 'package.json');
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // not accessible
  }
  return null;
}

function extractPnpmOverrides(pkgJson: Record<string, unknown>): Record<string, string> {
  const pnpm = pkgJson['pnpm'] as Record<string, unknown> | undefined;
  if (pnpm && typeof pnpm === 'object' && 'overrides' in pnpm) {
    return pnpm['overrides'] as Record<string, string>;
  }
  return {};
}

function extractDepsFromPackageJson(pkgJson: Record<string, unknown>): Record<string, string> {
  return {
    ...(pkgJson['dependencies'] as Record<string, string> || {}),
    ...(pkgJson['devDependencies'] as Record<string, string> || {}),
  };
}

function matchDepsAgainstVulnerabilities(
  deps: Record<string, string>,
  vulnerabilities: VulnerablePackage[],
): SbomEntry[] {
  const entries: SbomEntry[] = [];
  const overrides = extractPnpmOverrides(deps as unknown as Record<string, unknown>);

  const allDeps = { ...deps };
  for (const [k, v] of Object.entries(overrides)) {
    allDeps[k] = v;
  }

  for (const [pkgName, ver] of Object.entries(allDeps)) {
    const cveMatches: string[] = [];
    for (const vuln of vulnerabilities) {
      if (vuln.name.toLowerCase() !== pkgName.toLowerCase()) continue;
      const verStr = typeof ver === 'string' ? ver : String(ver);
      if (vuln.versionField === 'all') {
        cveMatches.push(`${vuln.cve} — ${vuln.description}`);
      } else if (vuln.versionField === 'semver') {
        const minV = semver.minVersion(verStr);
        if (minV && semver.satisfies(minV.version, vuln.versions)) {
          cveMatches.push(`${vuln.cve} — ${vuln.description}`);
        }
      } else if (vuln.versionField === 'flag-check') {
        cveMatches.push(`${vuln.cve} — ${vuln.description}`);
      }
    }
    entries.push({ package: pkgName, version: ver, cve_matches: cveMatches });
  }
  return entries;
}

// ── Simple TOML parser for dependency sections ──────────────────────────
function parseTomlSimple(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection = '';
  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }
    const kvMatch = line.match(/^"([^"]+)"\s*=\s*(.+)$/);
    const kvMatch2 = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*(.+)$/);
    const match = kvMatch || kvMatch2;
    if (match && currentSection) {
      let key = match[1];
      let value: unknown = match[2];
      if (typeof value === 'string') {
        const strVal = value.trim();
        if (strVal.startsWith('"') && strVal.endsWith('"')) {
          value = strVal.slice(1, -1);
        } else if (strVal.startsWith('[') && strVal.endsWith(']')) {
          value = strVal.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
        } else if (strVal === 'true' || strVal === 'false') {
          value = strVal === 'true';
        } else if (/^\d+\.?\d*$/.test(strVal)) {
          value = parseFloat(strVal);
        } else {
          value = strVal;
        }
      }
      if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
      }
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      (result[currentSection] as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

function tryReadPyprojectToml(dir: string): Record<string, string> | null {
  try {
    const p = join(dir, 'pyproject.toml');
    if (existsSync(p)) {
      const raw = readFileSync(p, 'utf-8');
      const parsed = parseTomlSimple(raw);
      const deps: Record<string, string> = {};

      const projectDeps = (parsed['project'] as Record<string, unknown> | undefined)?.['dependencies'];
      if (Array.isArray(projectDeps)) {
        for (const entry of projectDeps) {
          const match = typeof entry === 'string' ? entry.match(/^([a-zA-Z0-9_.-]+)\s*(.+)?$/) : null;
          if (match) {
            deps[match[1]] = (match[2] || '*').trim();
          }
        }
      }

      const poetryDeps = (parsed['tool.poetry.dependencies'] as Record<string, unknown>) ?? (parsed['tool.poetry'] as Record<string, unknown> | undefined)?.['dependencies'];
      if (poetryDeps && typeof poetryDeps === 'object') {
        for (const [k, v] of Object.entries(poetryDeps)) {
          if (k === 'python') continue;
          if (typeof v === 'string') {
            deps[k] = v;
          } else if (typeof v === 'object' && v !== null) {
            const ver = (v as Record<string, unknown>)['version'];
            deps[k] = typeof ver === 'string' ? ver : '*';
          }
        }
      }

      return Object.keys(deps).length > 0 ? deps : null;
    }
  } catch {
    // not accessible
  }
  return null;
}

// ── Strategy 1: Extract package info from STDIO command args ────────────
interface StdioPackageInfo {
  dir?: string;
  packageName?: string;
}

function extractStdioPackageRef(command: string, args: string[]): StdioPackageInfo | null {
  const lowerCmd = command.toLowerCase();
  const isRunner = RUNNER_COMMANDS.has(lowerCmd);

  if (!isRunner) {
    const pathSep = command.includes('\\') ? '\\' : '/';
    if (command.includes(pathSep)) {
      return { dir: command.substring(0, command.lastIndexOf(pathSep)) || undefined };
    }
    return { packageName: command };
  }

  if (lowerCmd === 'node' || lowerCmd === 'python' || lowerCmd === 'python3' || lowerCmd === 'deno') {
    const script = args.find(a => a.includes('/') || a.includes('\\') || a.endsWith('.js') || a.endsWith('.py') || a.endsWith('.ts'));
    if (script) {
      const pathSep = script.includes('\\') ? '\\' : '/';
      const lastSep = script.lastIndexOf(pathSep);
      if (lastSep !== -1) {
        return { dir: script.substring(0, lastSep) };
      }
    }
    return null;
  }

  if (lowerCmd === 'npx') {
    const pkgArg = args[0] === '-y' && args.length > 1 ? args[1] : args[0];
    if (pkgArg) {
      const atIdx = pkgArg.indexOf('@');
      return { packageName: atIdx > 0 ? pkgArg.substring(0, atIdx) : pkgArg };
    }
  }

  return null;
}

// ── Strategy 2: Match HTTP URL to known package by domain patterns ──────
const URL_TO_PACKAGE: [RegExp, string][] = [
  [/github/, '@modelcontextprotocol/server-github'],
  [/slack/, '@modelcontextprotocol/server-slack'],
  [/brave/, '@modelcontextprotocol/server-brave-search'],
  [/puppeteer/, '@modelcontextprotocol/server-puppeteer'],
  [/filesystem/, '@modelcontextprotocol/server-filesystem'],
  [/postgres/i, '@modelcontextprotocol/server-postgres'],
  [/sqlite/i, '@modelcontextprotocol/server-sqlite'],
  [/kubernetes/i, 'mcp-server-kubernetes'],
  [/docker/i, 'mcp-server-docker'],
  [/git/i, '@anthropic-ai/mcp-server-git'],
  [/fetch/i, '@anthropic-ai/mcp-server-fetch'],
  [/memory/i, '@anthropic-ai/mcp-server-memory'],
];

function matchHttpServerToPackage(url: string): string | null {
  const lower = url.toLowerCase();
  for (const [re, pkg] of URL_TO_PACKAGE) {
    if (re.test(lower)) return pkg;
  }
  return null;
}

// ── Strategy 3: Read from sbomPath ──────────────────────────────────────
function readSbomFromPath(sbomPath: string): SbomEntry[] | null {
  try {
    if (!existsSync(sbomPath)) return null;
    const stat = sbomPath.toLowerCase();
    if (stat.endsWith('package.json')) {
      const raw = readFileSync(sbomPath, 'utf-8');
      const pkgJson = JSON.parse(raw);
      const deps = extractDepsFromPackageJson(pkgJson);
      return matchDepsAgainstVulnerabilities(deps, []);
    }
    if (stat.endsWith('pyproject.toml')) {
      const deps = tryReadPyprojectToml(join(sbomPath, '..'));
      if (deps) {
        return Object.entries(deps).map(([p, v]) => ({ package: p, version: v, cve_matches: [] }));
      }
    }
  } catch {
    // not accessible
  }
  return null;
}

export function generateSbom(
  servers: Record<string, { command?: string; args?: string[]; url?: string; sbomPath?: string }>,
  vulnerabilities: VulnerablePackage[] = KNOWN_VULNERABLE_PACKAGES,
): { entries: SbomEntry[]; issues: Issue[] } {
  const allEntries: SbomEntry[] = [];
  const issues: Issue[] = [];
  let anyManifestFound = false;

  for (const [serverName, server] of Object.entries(servers)) {
    let serverEntries: SbomEntry[] = [];

    // ── Strategy 3: sbomPath takes priority if provided ──────────────
    if (server.sbomPath) {
      const pathEntries = readSbomFromPath(server.sbomPath);
      if (pathEntries) {
        serverEntries = pathEntries;
        anyManifestFound = true;
      }
    }

    // ── Strategy 1: STDIO servers ────────────────────────────────────
    if (serverEntries.length === 0 && server.command) {
      const info = extractStdioPackageRef(server.command, server.args ?? []);
      if (info?.dir) {
        const pkgJson = tryReadPackageJson(info.dir);
        if (pkgJson) {
          const deps = extractDepsFromPackageJson(pkgJson);
          serverEntries = matchDepsAgainstVulnerabilities(deps, vulnerabilities);
          anyManifestFound = true;
        }
        if (serverEntries.length === 0) {
          const pyDeps = tryReadPyprojectToml(info.dir);
          if (pyDeps) {
            serverEntries = Object.entries(pyDeps).map(([p, v]) => {
              const cveMatches: string[] = [];
              for (const vuln of vulnerabilities) {
                if (vuln.name.toLowerCase() === p.toLowerCase()) {
                  cveMatches.push(`${vuln.cve} — ${vuln.description}`);
                }
              }
              return { package: p, version: v, cve_matches: cveMatches };
            });
            anyManifestFound = true;
          }
        }
      } else if (info?.packageName) {
        const cveMatches: string[] = [];
        for (const vuln of vulnerabilities) {
          if (vuln.name.toLowerCase() === info.packageName.toLowerCase()) {
            cveMatches.push(`${vuln.cve} — ${vuln.description}`);
          }
        }
        serverEntries.push({
          package: info.packageName,
          version: 'installed',
          cve_matches: cveMatches,
        });
        anyManifestFound = true;
      }
    }

    // ── Strategy 2: HTTP servers ──────────────────────────────────────
    if (serverEntries.length === 0 && server.url) {
      const matchedPkg = matchHttpServerToPackage(server.url);
      if (matchedPkg) {
        const cveMatches: string[] = [];
        for (const vuln of vulnerabilities) {
          if (vuln.name.toLowerCase() === matchedPkg.toLowerCase()) {
            cveMatches.push(`${vuln.cve} — ${vuln.description}`);
          }
        }
        serverEntries.push({
          package: matchedPkg,
          version: 'remote',
          cve_matches: cveMatches,
        });
        anyManifestFound = true;
      }
    }

    // ── Fallback: try process.cwd() as last resort ────────────────────
    if (serverEntries.length === 0) {
      const pkgJson = tryReadPackageJson(process.cwd());
      if (pkgJson) {
        const deps = extractDepsFromPackageJson(pkgJson);
        serverEntries = matchDepsAgainstVulnerabilities(deps, vulnerabilities);
        if (serverEntries.length > 0) anyManifestFound = true;
      }
    }

    // ── Warning if no manifest found ──────────────────────────────────
    if (serverEntries.length === 0) {
      issues.push({
        type: 'SBOM_UNAVAILABLE',
        severity: 'LOW',
        title: 'SBOM unavailable for server',
        description: `Could not locate a manifest (package.json, pyproject.toml) for server "${serverName}" at ${server.url || server.command || 'unknown'}. Verify the server is deployed from a directory with a manifest file, or set sbomPath in the config.`,
        fix: 'Ensure the server directory contains package.json or pyproject.toml, or provide an explicit sbomPath in the config.',
        deduction: 0,
      });
    }

    allEntries.push(...serverEntries);
  }

  return { entries: allEntries, issues };
}