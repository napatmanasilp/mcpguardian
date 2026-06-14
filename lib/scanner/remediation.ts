/**
 * Remediation Engine
 *
 * Given a scanned MCP config and its issues, generates:
 * 1. The exact corrected config JSON the agent can apply directly
 * 2. A predicted score and verdict after fixes are applied
 * 3. Per-issue remediation steps with before/after diffs
 *
 * This is the "tell me exactly what to change and what happens if I do" module.
 */

import type { Issue, McpServerInput, ExtendedScanResult } from './types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface RemediationStep {
  issue_type: string;
  severity: string;
  title: string;
  /** Points recovered by applying this fix */
  points_recovered: number;
  /** Human and machine-readable description of the change */
  action: string;
  /** The specific config key(s) affected */
  config_path: string;
  /** What the value was */
  before: string;
  /** What the value should be */
  after: string;
  /** Whether this fix can be auto-applied (vs requires human decision) */
  auto_fixable: boolean;
}

export interface RemediationResult {
  /** The corrected config JSON — ready to copy-paste/apply */
  corrected_config: Record<string, unknown>;
  /** Total deductions removed by applying all auto-fixable fixes */
  points_recovered: number;
  /** Predicted score after applying all fixes */
  predicted_score: number;
  /** Predicted verdict after applying all fixes */
  predicted_verdict: 'ALLOW' | 'ALLOW_WITH_CAUTION' | 'BLOCK';
  /** Whether connection will be allowed after fixes */
  will_be_allowed: boolean;
  /** Ordered list of remediation steps */
  steps: RemediationStep[];
  /** Issues that require human judgment (can't be auto-fixed) */
  requires_human_decision: string[];
  /** Summary for agent consumption */
  summary: string;
}

// ─── Known package latest safe versions ─────────────────────────────────

const SAFE_VERSIONS: Record<string, string> = {
  'mcp-remote': '0.3.0',
  '@anthropic-ai/mcp-server-git': '0.7.0',
  '@modelcontextprotocol/server-github': '0.7.0',
  '@modelcontextprotocol/server-filesystem': '2.0.0',
  '@anthropic-ai/mcp-server-fetch': '0.6.0',
  'playwright-mcp': '0.0.15',
  '@anthropic-ai/mcp-server-memory': '0.6.1',
  '@modelcontextprotocol/server-postgres': '0.6.1',
  '@modelcontextprotocol/server-sqlite': '0.6.1',
  '@modelcontextprotocol/server-slack': '0.6.1',
  'mcp-server-kubernetes': '0.3.0',
  '@modelcontextprotocol/server-brave-search': '0.6.0',
  'mcp-server-docker': '0.2.0',
  '@modelcontextprotocol/server-puppeteer': '0.6.0',
  'mcp-server-langchain': '0.2.0',
};

// Packages that should be removed entirely (no safe version exists)
const REMOVE_PACKAGES = new Set([
  'mcp-server-shell',
  '@akoskm/create-mcp-server-stdio',
  'mcp-server-apache-doris',
  'langflow',
  'whatsapp-mcp',
]);

// ─── Remediation Logic ──────────────────────────────────────────────────

export function generateRemediation(
  originalConfig: Record<string, McpServerInput>,
  scanResult: ExtendedScanResult,
): RemediationResult {
  const correctedConfig: Record<string, Record<string, unknown>> = {};
  const steps: RemediationStep[] = [];
  const requiresHuman: string[] = [];
  let totalPointsRecovered = 0;

  for (const serverResult of scanResult.servers) {
    const serverName = serverResult.name;
    const original = originalConfig[serverName];
    if (!original) continue;

    const corrected: Record<string, unknown> = { ...original };
    if (original.args) corrected.args = [...original.args];
    if (original.env) corrected.env = { ...original.env };
    if (original.headers) corrected.headers = { ...original.headers };

    for (const issue of serverResult.issues) {
      const step = remediateIssue(serverName, issue, original, corrected);
      if (step) {
        steps.push(step);
        if (step.auto_fixable) {
          totalPointsRecovered += step.points_recovered;
        } else {
          requiresHuman.push(`${serverName}: ${step.title} — ${step.action}`);
        }
      }
    }

    correctedConfig[serverName] = corrected;
  }

  // Handle cross-server risks
  if (scanResult.crossServerRisks) {
    for (const risk of scanResult.crossServerRisks) {
      requiresHuman.push(
        `Cross-server: ${risk.title} — Consider removing unnecessary servers to reduce attack surface.`,
      );
    }
  }

  // Predict new score
  const predictedScore = Math.min(100, scanResult.score + totalPointsRecovered);
  let predictedVerdict: 'ALLOW' | 'ALLOW_WITH_CAUTION' | 'BLOCK';
  if (predictedScore >= 75) {
    predictedVerdict = 'ALLOW';
  } else if (predictedScore >= 50) {
    predictedVerdict = 'ALLOW_WITH_CAUTION';
  } else {
    predictedVerdict = 'BLOCK';
  }

  const willBeAllowed = predictedVerdict !== 'BLOCK';

  // Build summary
  const summary = buildSummary(
    scanResult.score,
    predictedScore,
    predictedVerdict,
    steps.filter((s) => s.auto_fixable).length,
    requiresHuman.length,
  );

  return {
    corrected_config: { mcpServers: correctedConfig },
    points_recovered: totalPointsRecovered,
    predicted_score: predictedScore,
    predicted_verdict: predictedVerdict,
    will_be_allowed: willBeAllowed,
    steps,
    requires_human_decision: requiresHuman,
    summary,
  };
}

// ─── Per-Issue Remediation ──────────────────────────────────────────────

function remediateIssue(
  serverName: string,
  issue: Issue,
  original: McpServerInput,
  corrected: Record<string, unknown>,
): RemediationStep | null {
  switch (issue.type) {
    case 'UNPINNED_DEPENDENCY': {
      const args = (corrected.args as string[]) ?? [];
      const pkgIndex = args.findIndex(
        (a) => a.startsWith('@') || (!a.startsWith('-') && a !== '-y' && a !== 'npx'),
      );
      // Find the actual package name in args
      const yIndex = args.indexOf('-y');
      const packageArgIndex = yIndex >= 0 ? yIndex + 1 : pkgIndex;
      const packageArg = args[packageArgIndex];

      if (packageArg && !packageArg.includes('@', 1)) {
        const safePkg = packageArg.startsWith('@')
          ? packageArg
          : packageArg;
        const safeVersion = SAFE_VERSIONS[safePkg] ?? '1.0.0';
        const pinnedPackage = `${safePkg}@${safeVersion}`;
        const newArgs = [...args];
        newArgs[packageArgIndex] = pinnedPackage;
        (corrected as Record<string, unknown>).args = newArgs;

        return {
          issue_type: issue.type,
          severity: issue.severity,
          title: issue.title,
          points_recovered: issue.deduction,
          action: `Pin ${safePkg} to version ${safeVersion}`,
          config_path: `mcpServers.${serverName}.args[${packageArgIndex}]`,
          before: packageArg,
          after: pinnedPackage,
          auto_fixable: true,
        };
      }
      return null;
    }

    case 'UNRESTRICTED_FILESYSTEM': {
      const args = (corrected.args as string[]) ?? [];
      args.push('--directory', './workspace');
      (corrected as Record<string, unknown>).args = args;

      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Add --directory flag to restrict filesystem access',
        config_path: `mcpServers.${serverName}.args`,
        before: JSON.stringify(original.args ?? []),
        after: JSON.stringify(args),
        auto_fixable: true,
      };
    }

    case 'MISSING_AUTH_HEADER': {
      const headers = (corrected.headers as Record<string, string>) ?? {};
      headers['Authorization'] = 'Bearer ${MCP_AUTH_TOKEN}';
      (corrected as Record<string, unknown>).headers = headers;

      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Add Authorization header with environment variable reference',
        config_path: `mcpServers.${serverName}.headers.Authorization`,
        before: '(missing)',
        after: 'Bearer ${MCP_AUTH_TOKEN}',
        auto_fixable: true,
      };
    }

    case 'HARDCODED_SECRET_IN_HEADERS': {
      if (corrected.headers) {
        const headers = corrected.headers as Record<string, string>;
        for (const [key, value] of Object.entries(headers)) {
          if (/^Bearer\s+[A-Za-z0-9_\-\.]{20,}$/.test(value)) {
            const envVar = `\${${key.toUpperCase().replace(/-/g, '_')}_TOKEN}`;
            const before = value.length > 20 ? value.slice(0, 20) + '...' : value;
            headers[key] = `Bearer ${envVar}`;

            return {
              issue_type: issue.type,
              severity: issue.severity,
              title: issue.title,
              points_recovered: issue.deduction,
              action: `Replace hardcoded credential in ${key} header with env var reference`,
              config_path: `mcpServers.${serverName}.headers.${key}`,
              before: `Bearer ${before}`,
              after: `Bearer ${envVar}`,
              auto_fixable: true,
            };
          }
        }
      }
      return null;
    }

    case 'SECRET_IN_URL': {
      if (original.url) {
        try {
          const urlObj = new URL(original.url);
          const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
          (corrected as Record<string, unknown>).url = cleanUrl;

          // Move the secret to headers
          const headers = (corrected.headers as Record<string, string>) ?? {};
          for (const [param] of urlObj.searchParams.entries()) {
            headers['Authorization'] = `Bearer \${${param.toUpperCase()}}`;
            break;
          }
          (corrected as Record<string, unknown>).headers = headers;

          return {
            issue_type: issue.type,
            severity: issue.severity,
            title: issue.title,
            points_recovered: issue.deduction,
            action: 'Move secret from URL query string to Authorization header',
            config_path: `mcpServers.${serverName}.url`,
            before: original.url.slice(0, 60) + (original.url.length > 60 ? '...' : ''),
            after: cleanUrl,
            auto_fixable: true,
          };
        } catch {
          return null;
        }
      }
      return null;
    }

    case 'INSECURE_URL': {
      if (original.url && original.url.startsWith('http://')) {
        const secureUrl = original.url.replace('http://', 'https://');
        (corrected as Record<string, unknown>).url = secureUrl;

        return {
          issue_type: issue.type,
          severity: issue.severity,
          title: issue.title,
          points_recovered: issue.deduction,
          action: 'Upgrade URL from HTTP to HTTPS',
          config_path: `mcpServers.${serverName}.url`,
          before: original.url,
          after: secureUrl,
          auto_fixable: true,
        };
      }
      return null;
    }

    case 'HARDCODED_SECRETS': {
      if (original.env) {
        const env = (corrected.env as Record<string, string>) ?? {};
        for (const [key, value] of Object.entries(env)) {
          if (value.length > 16 && !/\$\{/.test(value)) {
            env[key] = `\${${key}}`;
          }
        }
        (corrected as Record<string, unknown>).env = env;

        return {
          issue_type: issue.type,
          severity: issue.severity,
          title: issue.title,
          points_recovered: issue.deduction,
          action: 'Replace hardcoded secrets with ${VAR_NAME} env references',
          config_path: `mcpServers.${serverName}.env`,
          before: '(hardcoded values)',
          after: '${ENV_VAR} references',
          auto_fixable: true,
        };
      }
      return null;
    }

    case 'ROOT_FILESYSTEM_ACCESS': {
      const args = (corrected.args as string[]) ?? [];
      const dangerousArgs = ['/', 'C:\\', '~', '*'];
      const newArgs = args.filter((a) => !dangerousArgs.includes(a));
      newArgs.push('./workspace');
      (corrected as Record<string, unknown>).args = newArgs;

      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Replace root path with restricted workspace directory',
        config_path: `mcpServers.${serverName}.args`,
        before: JSON.stringify(args),
        after: JSON.stringify(newArgs),
        auto_fixable: true,
      };
    }

    case 'CWD_SENSITIVE_DIR':
    case 'CWD_BROAD_DIR': {
      (corrected as Record<string, unknown>).cwd = './workspace';

      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Restrict working directory to project-specific path',
        config_path: `mcpServers.${serverName}.cwd`,
        before: original.cwd ?? '(unset)',
        after: './workspace',
        auto_fixable: true,
      };
    }

    case 'CONSENT_BYPASS': {
      // Remove autoApprove from the config
      delete (corrected as Record<string, unknown>).autoApprove;
      delete (corrected as Record<string, unknown>).approveAll;
      delete (corrected as Record<string, unknown>).skipConsent;

      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Remove auto-approval settings — require per-tool consent',
        config_path: `mcpServers.${serverName}.autoApprove`,
        before: 'true',
        after: '(removed)',
        auto_fixable: true,
      };
    }

    case 'BROAD_PERMISSIONS': {
      // Can't auto-fix without knowing the user's intent
      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Restrict arguments to only necessary directories — remove references to sensitive system paths (.ssh, .aws, /etc)',
        config_path: `mcpServers.${serverName}.args`,
        before: JSON.stringify(original.args ?? []),
        after: '(requires manual review — remove sensitive path references)',
        auto_fixable: false,
      };
    }

    case 'COMMAND_EXECUTION': {
      // Server allows shell execution — recommend removal
      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: issue.deduction,
        action: 'Remove this server or replace with a sandboxed alternative. Shell execution servers are inherently dangerous.',
        config_path: `mcpServers.${serverName}`,
        before: '(shell execution server)',
        after: '(remove server or use sandboxed alternative)',
        auto_fixable: false,
      };
    }

    case 'STDIO_TRANSPORT': {
      // STDIO is how most local MCP servers work — can't auto-fix this
      // but we note it. If there's a URL alternative, suggest it.
      return {
        issue_type: issue.type,
        severity: issue.severity,
        title: issue.title,
        points_recovered: 0, // Only recovered if user switches to HTTP
        action: 'Consider using the HTTP/SSE version of this server if available. STDIO transport is inherent to local MCP servers and accepted with caution.',
        config_path: `mcpServers.${serverName}.command`,
        before: original.command ?? '',
        after: '(switch to url-based transport if available)',
        auto_fixable: false,
      };
    }

    case 'VULNERABLE_PACKAGE': {
      const args = (corrected.args as string[]) ?? [];
      const yIndex = args.indexOf('-y');
      const packageArgIndex = yIndex >= 0 ? yIndex + 1 : -1;
      const packageArg = packageArgIndex >= 0 ? args[packageArgIndex] : null;

      if (packageArg) {
        const baseName = packageArg.replace(/@[^@]*$/, '');
        if (REMOVE_PACKAGES.has(baseName)) {
          return {
            issue_type: issue.type,
            severity: issue.severity,
            title: issue.title,
            points_recovered: issue.deduction,
            action: `Remove ${baseName} entirely — no safe version exists`,
            config_path: `mcpServers.${serverName}`,
            before: baseName,
            after: '(REMOVE THIS SERVER)',
            auto_fixable: false,
          };
        }

        const safeVersion = SAFE_VERSIONS[baseName];
        if (safeVersion) {
          const pinnedPackage = `${baseName}@${safeVersion}`;
          const newArgs = [...args];
          newArgs[packageArgIndex] = pinnedPackage;
          (corrected as Record<string, unknown>).args = newArgs;

          return {
            issue_type: issue.type,
            severity: issue.severity,
            title: issue.title,
            points_recovered: issue.deduction,
            action: `Upgrade ${baseName} to safe version ${safeVersion}`,
            config_path: `mcpServers.${serverName}.args[${packageArgIndex}]`,
            before: packageArg,
            after: pinnedPackage,
            auto_fixable: true,
          };
        }
      }
      return null;
    }

    default:
      // Unknown issue type — can't auto-remediate
      return null;
  }
}

// ─── Summary Builder ────────────────────────────────────────────────────

function buildSummary(
  currentScore: number,
  predictedScore: number,
  predictedVerdict: string,
  autoFixCount: number,
  humanCount: number,
): string {
  const parts: string[] = [];

  parts.push(`Current score: ${currentScore}/100.`);

  if (autoFixCount > 0) {
    parts.push(
      `Apply ${autoFixCount} auto-fix${autoFixCount > 1 ? 'es' : ''} to reach ${predictedScore}/100 (${predictedVerdict}).`,
    );
  }

  if (humanCount > 0) {
    parts.push(
      `${humanCount} issue${humanCount > 1 ? 's require' : ' requires'} human decision.`,
    );
  }

  if (predictedVerdict === 'ALLOW') {
    parts.push('After fixes: connection will be ALLOWED.');
  } else if (predictedVerdict === 'ALLOW_WITH_CAUTION') {
    parts.push('After fixes: connection will be ALLOWED WITH CAUTION (monitoring active).');
  } else {
    parts.push('After fixes: connection still BLOCKED — additional manual remediation required.');
  }

  return parts.join(' ');
}
