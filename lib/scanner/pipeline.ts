import {
  Issue,
  McpServerInput,
  PipelineReport,
  PipelineStepResult,
  ScanMode,
  Verdict,
  ProbedTool,
} from './types';
import { verifyDomain } from './domain-verifier';
import { scanForInjections, generateToolRiskMatrix } from './tool-classifier';
import { applyScoringCaps, determineVerdict, calculateGrade } from './verdict';
import { scanForSecrets } from './patterns';
import { probeHttpMcpServer, scanStdioArgsForHardcodedCredentials, checkCorsHeaders } from './runtime-probe';
import { checkForVulnerablePackages, checkSupplyChain } from './known-vulnerabilities';
import { execSync } from 'child_process';
import { storeHash, compareHash } from './hash-store';
import { enrichIssuesWithCompliance } from '../compliance-mappings';
import { runSandboxedProbe } from './sandbox';

const SAFE_COMMANDS = new Set(['node', 'npx', 'python', 'python3', 'uvx', 'uv', 'deno', 'bun', 'docker']);

// ─── Pipeline Steps ───────────────────────────────────────────────────

/**
 * STEP 1: Static Config Analysis
 * Runs all 5 config-level rules (auth header, secrets in URL, secrets in headers, cwd, HTTP).
 */
function runStaticConfigAnalysis(name: string, server: McpServerInput): { issues: Issue[]; deduction: number } {
  const issues: Issue[] = [];
  let deduction = 0;

  const serverString = JSON.stringify(server);
  const envValues = server.env ? Object.values(server.env).join(' ') : '';
  const nameLower = name.toLowerCase();
  const argsLower = (server.args || []).join(' ').toLowerCase();

  // ── Rule 1: Missing Authorization header ───────────────────────────
  if (server.url) {
    const hasAuthHeader = server.headers &&
      Object.keys(server.headers).some(k => k.toLowerCase() === 'authorization');
    if (!hasAuthHeader) {
      // For HTTPS servers, this is a medium concern (server may use OAuth or other auth)
      // For HTTP servers, this is high (no encryption + no auth = fully exposed)
      const isHttps = server.url.startsWith('https://');
      const severity = isHttps ? 'MEDIUM' : 'HIGH';
      const penalty = isHttps ? 10 : 25;
      deduction += penalty;
      issues.push({
        type: 'MISSING_AUTH_HEADER',
        severity: severity as 'MEDIUM' | 'HIGH',
        title: isHttps
          ? 'No Authorization header configured — server may use OAuth or other auth'
          : 'Remote MCP server has no Authorization header and no encryption',
        description: isHttps
          ? `Server "${name}" uses HTTPS but has no Authorization header in this config. If the server uses OAuth or session-based auth, this is expected. Otherwise, add a Bearer token.`
          : `Server "${name}" uses insecure HTTP with no Authorization header. Any network observer can intercept and connect.`,
        fix: isHttps
          ? 'If the server requires auth, add an Authorization header. If it uses OAuth, you can safely ignore this.'
          : 'Switch to HTTPS and add an Authorization header with a Bearer token or API key',
        deduction: penalty,
      });
    }
  }

  // ── Rule 2: Secrets in URL query strings ──────────────────────────
  if (server.url) {
    try {
      const urlObj = new URL(server.url);
      const sensitiveParamNames = /^(token|key|secret|api_key|apikey|password|auth|access_token|client_secret)$/i;
      const sensitiveValuePatterns = /^(sk_live_|sk_test_|ghp_|gho_|xoxb-|xoxp-|AIza|AKIA)/;

      for (const [paramName, paramValue] of urlObj.searchParams.entries()) {
        const isSensitiveName = sensitiveParamNames.test(paramName);
        const isSensitiveValue = sensitiveValuePatterns.test(paramValue);
        const isLongValue = paramValue.length > 20;

        if (isSensitiveName || isSensitiveValue || isLongValue) {
          deduction += 30;
          issues.push({
            type: 'SECRET_IN_URL',
            severity: 'CRITICAL',
            title: 'Secret or API key detected in URL query string',
            description: `URL parameter "${paramName}" in server "${name}" contains a potential secret. URL parameters are logged in server access logs, browser history, CDN caches, and HTTP Referer headers. Move all secrets to the Authorization header.`,
            fix: 'Move the secret from the URL query string to an Authorization header. Use environment variable references like \${API_KEY} instead of hardcoding.',
            deduction: 30,
          });
          break;
        }
      }
    } catch {
      // Invalid URL — skip query string check
    }
  }

  // ── Rule 3: Hardcoded secrets in config headers ───────────────────
  if (server.headers) {
    const envRefPattern = /\$\{.+\}|process\.env\./;
    const rawSecretPattern = /^Bearer\s+[A-Za-z0-9_\-\.]{20,}$/;

    for (const [headerKey, headerValue] of Object.entries(server.headers)) {
      if (!envRefPattern.test(headerValue) && rawSecretPattern.test(headerValue)) {
        deduction += 20;
        issues.push({
          type: 'HARDCODED_SECRET_IN_HEADERS',
          severity: 'HIGH',
          title: 'Hardcoded secret found in config headers',
          description: `Header "${headerKey}" in server "${name}" contains a raw credential instead of an environment variable reference. Use \${MCP_AUTH_TOKEN} or process.env.MCP_AUTH_TOKEN instead.`,
          fix: 'Replace the hardcoded credential with an environment variable reference like \${MCP_AUTH_TOKEN} or process.env.MCP_AUTH_TOKEN',
          deduction: 20,
        });
        break;
      }
    }
  }

  // ── Secrets in config JSON body ────────────────────────────────────
  const secrets = scanForSecrets(serverString);
  if (secrets.length > 0) {
    const secretDeduction = Math.min(30, secrets.length * 30);
    deduction += secretDeduction;
    issues.push({
      type: 'HARDCODED_SECRETS',
      severity: 'CRITICAL',
      title: 'Hardcoded secrets detected in server configuration',
      description: `Found ${secrets.length} secret(s): ${secrets.map(s => `${s.patternName} (${s.match})`).join(', ')}`,
      fix: 'Remove hardcoded secrets and use environment variables with \${VAR_NAME} syntax instead',
      deduction: secretDeduction,
    });
  }

  // ── STDIO transport checks ─────────────────────────────────────────
  if (server.command) {
    const isSafeCommand = SAFE_COMMANDS.has(server.command.toLowerCase());

    if (isSafeCommand) {
      // Safe runtimes (node, npx, python, etc.) are the standard way to run MCP servers
      // This is informational, not a significant risk
      deduction += 5;
      issues.push({
        type: 'STDIO_TRANSPORT',
        severity: 'LOW',
        title: 'Server uses STDIO transport with approved runtime',
        description: `Server "${name}" uses STDIO transport via "${server.command}". This is the standard MCP transport for local servers. Runtime execution is managed by the client.`,
        fix: 'No action needed — STDIO with approved runtimes is standard practice. Consider HTTPS for remote/shared servers.',
        deduction: 5,
      });
    } else {
      deduction += 30;
      issues.push({
        type: 'STDIO_TRANSPORT',
        severity: 'CRITICAL',
        title: 'STDIO transport with unknown command — arbitrary execution risk',
        description: `MCP's STDIO transport allows OS commands to be executed. Server "${name}" uses command "${server.command}" which is not in the approved runtime allowlist.`,
        fix: 'Use only approved runtimes: node, npx, python3, uvx, deno, bun, docker',
        deduction: 30,
      });
    }

    const stdioCredIssues = scanStdioArgsForHardcodedCredentials(server.args);
    deduction += stdioCredIssues.reduce((sum, i) => sum + i.deduction, 0);
    issues.push(...stdioCredIssues);
  }

  // ── Insecure URL (HTTP) ───────────────────────────────────────────
  if (server.url && !server.url.startsWith('https://')) {
    deduction += 20;
    issues.push({
      type: 'INSECURE_URL',
      severity: 'HIGH',
      title: 'Server uses insecure URL',
      description: `Server "${name}" uses URL "${server.url}" without HTTPS encryption`,
      fix: 'Change the URL to use https:// to ensure encrypted communication',
      deduction: 20,
    });
  }

  // ── Legacy SSE transport ──────────────────────────────────────────
  if (server.url && (/\/sse/.test(server.url) || /\/events$/.test(server.url) || /\/stream$/.test(server.url))) {
    deduction += 10;
    issues.push({
      type: 'LEGACY_SSE_TRANSPORT',
      severity: 'MEDIUM',
      title: 'Server uses deprecated SSE transport',
      description: 'SSE (Server-Sent Events) transport is deprecated in MCP spec. 1,227 of 1,467 exposed MCP servers still use SSE — it lacks bidirectional streaming and modern security controls.',
      fix: 'Migrate to Streamable HTTP transport (the current MCP standard)',
      deduction: 10,
    });
  }

  // ── Vulnerability checks ──────────────────────────────────────────
  const vulnerabilityIssues = checkForVulnerablePackages(name, server.command, server.args, []);
  deduction += vulnerabilityIssues.reduce((sum, i) => sum + i.deduction, 0);
  issues.push(...vulnerabilityIssues);

  const supplyChainIssues = checkSupplyChain(name, server.command, server.args);
  deduction += supplyChainIssues.reduce((sum, i) => sum + i.deduction, 0);
  issues.push(...supplyChainIssues);

  // ── Filesystem keywords ───────────────────────────────────────────
  const hasFilesystemKeywords = /filesystem|file-system|server-filesystem/.test(nameLower + ' ' + argsLower);
  const hasDirectoryFlag = /--directory|--root-dir/.test(argsLower);
  if (hasFilesystemKeywords && !hasDirectoryFlag) {
    deduction += 20;
    issues.push({
      type: 'UNRESTRICTED_FILESYSTEM',
      severity: 'HIGH',
      title: 'Server has unrestricted filesystem access',
      description: `Server "${name}" appears to be a filesystem server without a directory restriction flag`,
      fix: 'Add --directory or --root-dir flag to restrict access to a specific directory',
      deduction: 20,
    });
  }

  // ── Command execution keywords ────────────────────────────────────
  const hasExecKeywords = /exec|shell|bash|terminal|mcp-server-shell/.test(nameLower + ' ' + argsLower);
  if (hasExecKeywords) {
    deduction += 15;
    issues.push({
      type: 'COMMAND_EXECUTION',
      severity: 'HIGH',
      title: 'Server allows arbitrary command execution',
      description: `Server "${name}" may allow arbitrary command execution based on its configuration`,
      fix: 'Remove or restrict command execution capabilities; use sandboxed alternatives',
      deduction: 15,
    });
  }

  // ── Env variable exposure ─────────────────────────────────────────
  const envSecrets = scanForSecrets(envValues);
  if (envSecrets.length > 0) {
    const hasTemplateVar = /\$\{[^}]*\}/.test(envValues);
    if (!hasTemplateVar) {
      deduction += 10;
      issues.push({
        type: 'ENV_VARIABLE_EXPOSURE',
        severity: 'MEDIUM',
        title: 'Environment variables may expose secrets',
        description: `Found ${envSecrets.length} potential secret(s) in environment variables of server "${name}"`,
        fix: 'Use \${VARIABLE_NAME} template syntax to reference secrets instead of hardcoding them in env values',
        deduction: 10,
      });
    }
  }

  // ── Consent bypass ────────────────────────────────────────────────
  const hasConsentBypass = /"autoApprove"\s*:\s*"?true"?|"approveAll"\s*:\s*"?true"?|"skipConsent"\s*:\s*"?true"?/.test(serverString);
  if (hasConsentBypass) {
    deduction += 30;
    issues.push({
      type: 'CONSENT_BYPASS',
      severity: 'CRITICAL',
      title: 'Auto-approval bypass detected (CVE-2025-59536 pattern)',
      description: `Server "${name}" has autoApprove, approveAll, or skipConsent enabled. This bypasses user consent for tool execution, allowing arbitrary MCP tool calls without user confirmation.`,
      fix: 'Remove autoApprove/approveAll settings — always require per-tool consent',
      deduction: 30,
    });
  }

  // ── Sensitive paths in args ───────────────────────────────────────
  const argsJoined = (server.args || []).join(' ');
  const SENSITIVE_PATHS = [
    '.ssh', '/etc', '/root', '~/.aws', '/.aws', '~/.kube', '/.kube',
    '~/.azure', '~/.gcp', '~/.config/gcloud', '~/.docker',
    '/var/run/docker.sock', '/proc', '/sys',
    'C:\\Windows', 'C:\\Users', '/private/var/folders',
    '~/.npmrc', '~/.netrc',
  ];
  const hasBroadPath = SENSITIVE_PATHS.some(p => argsJoined.includes(p));
  if (hasBroadPath) {
    deduction += 10;
    issues.push({
      type: 'BROAD_PERMISSIONS',
      severity: 'MEDIUM',
      title: 'Server has broad filesystem permissions',
      description: `Server "${name}" has arguments that reference sensitive system paths`,
      fix: 'Restrict server arguments to only the necessary directories and avoid sensitive system paths',
      deduction: 10,
    });
  }

  // ── Root filesystem access ────────────────────────────────────────
  const allArgs = server.args ?? [];
  const hasRootAccess = allArgs.some(a => a === '/' || a === 'C:\\' || a === '~' || a === '*');
  if (hasRootAccess) {
    deduction += 25;
    issues.push({
      type: 'ROOT_FILESYSTEM_ACCESS',
      severity: 'CRITICAL',
      title: 'Unrestricted root filesystem access',
      description: `Server "${name}" has arguments granting unrestricted access to the entire filesystem`,
      fix: 'Restrict filesystem access to specific directories. Avoid granting access to /, C:\\\\, ~, or *',
      deduction: 25,
    });
  }

  // ── Rule 4: Dangerous working directory (cwd) ─────────────────────
  if (server.cwd) {
    const sensitiveDirs = /\.(ssh|aws|gnupg|config|env|kube)/i;
    const broadDirs = /^(\/Users\/|\/home\/|C:\\Users\\|\/root|\/)$/i;
    const desktopPaths = /(\/Desktop|\/Documents|\/Downloads)/i;
    const traversal = /\.\.\//;

    if (sensitiveDirs.test(server.cwd)) {
      deduction += 20;
      issues.push({
        type: 'CWD_SENSITIVE_DIR',
        severity: 'HIGH',
        title: 'Dangerous working directory — sensitive path',
        description: `Server "${name}" working directory "${server.cwd}" points to a sensitive directory. This gives the MCP server read/write access to credentials and configuration files.`,
        fix: 'Restrict cwd to a minimal project-specific directory. Never point to .ssh, .aws, .config, or .kube directories.',
        deduction: 20,
      });
    } else if (broadDirs.test(server.cwd) || desktopPaths.test(server.cwd) || traversal.test(server.cwd)) {
      deduction += 10;
      issues.push({
        type: 'CWD_BROAD_DIR',
        severity: 'MEDIUM',
        title: 'Dangerous working directory — broad path',
        description: `Server "${name}" working directory "${server.cwd}" is a broad user directory (home, desktop, root, or contains path traversal). This gives the MCP server read/write access to user files.`,
        fix: 'Restrict cwd to a minimal project-specific directory to limit the server\'s filesystem reach.',
        deduction: 10,
      });
    }
  }

  return { issues, deduction };
}

/**
 * Run the full free-mode pipeline (Steps 1-4) for a single server.
 */
export async function runFreeModePipeline(
  name: string,
  server: McpServerInput,
): Promise<{
  report: PipelineReport;
  serverIssues: Issue[];
  serverScore: number;
  isBlocked: boolean;
  probedTools?: ProbedTool[];
  toolsHash?: string;
  rawTools?: unknown[];
  promptsCount: number;
  resourcesCount: number;
}> {
  const steps: PipelineStepResult[] = [];
  const allIssues: Issue[] = [];
  const startTime = new Date().toISOString();
  let isBlocked = false;

  // ── Step 1: Static Config Analysis ────────────────────────────────
  const configResult = runStaticConfigAnalysis(name, server);
  allIssues.push(...configResult.issues);

  steps.push({
    stepName: 'STATIC_CONFIG',
    status: configResult.issues.length === 0 ? 'PASS' : 'FAIL',
    issues: configResult.issues,
    details: configResult.issues.length === 0
      ? 'No configuration issues found'
      : `${configResult.issues.length} issue(s) found in configuration`,
  });

  // ── Step 2: Pre-Connect Domain Verification ───────────────────────
  let domainBlocked = false;
  if (server.url) {
    const { domainCheck, issues: domainIssues } = await verifyDomain(server.url);
    allIssues.push(...domainIssues);

    domainBlocked = domainCheck.criticalBlocked;

    steps.push({
      stepName: 'DOMAIN_CHECK',
      status: domainCheck.criticalBlocked ? 'FAIL' :
        domainIssues.length === 0 ? 'PASS' : 'UNVERIFIED',
      issues: domainIssues,
      details: domainCheck.criticalBlocked
        ? `Domain "${domainCheck.domain}" is blocked — critical issue found`
        : domainIssues.length === 0
          ? `Domain "${domainCheck.domain}" verified successfully`
          : `${domainIssues.length} domain issue(s) found`,
    });

    if (domainBlocked) {
      isBlocked = true;
    }
  } else {
    steps.push({
      stepName: 'DOMAIN_CHECK',
      status: 'SKIP',
      issues: [],
      details: 'No URL to verify — STDIO server bypasses domain check',
    });
  }

  // ── Step 3: Behavioral Safety Probe ───────────────────────────────
  let probedTools: ProbedTool[] | undefined;
  let toolsHash: string | undefined;
  let rawTools: unknown[] | undefined;
  let promptsCount = 0;
  let resourcesCount = 0;
  let probeSucceeded = false;
  let corsResult = { originHeader: null as string | null, wildcardOrigin: false, originAbsent: false, specificOrigin: false };

  if (!domainBlocked && server.url) {
    // 3.1 Unauthenticated access probe
    const unauthIssues = await probeUnauthenticatedAccess(server.url);
    allIssues.push(...unauthIssues);

    // 3.2 Fetch and inspect tool definitions (authenticated probe)
    try {
      const probeResult = await probeHttpMcpServer(server.url);

      if (probeResult.probeError) {
        // Probe failed
        const isUnreachable = !probeResult.reachable;
        allIssues.push({
          type: 'PROBE_FAILED',
          severity: isUnreachable ? 'MEDIUM' : 'LOW',
          title: 'Runtime probe failed',
          description: `Could not probe server "${name}" at ${server.url}: ${probeResult.probeError}` +
            (!server.url.startsWith('https://')
              ? ' This probe was conducted over an insecure connection. Results may have been tampered with in transit.'
              : ''),
          fix: 'Ensure the server is running, reachable, and responds to MCP protocol requests',
          deduction: 0,
        });

        steps.push({
          stepName: 'BEHAVIOR_PROBE',
          status: 'UNVERIFIED',
          issues: [allIssues[allIssues.length - 1]],
          details: `Probe failed: ${probeResult.probeError}`,
        });
      } else {
        probeSucceeded = true;
        probedTools = probeResult.tools;
        toolsHash = probeResult.toolsHash;
        rawTools = probeResult.rawTools;
        promptsCount = probeResult.promptsCount ?? 0;
        resourcesCount = probeResult.resourcesCount ?? 0;

        // Add probe issues (MISSING_AUTHENTICATION, poisoning, etc.)
        allIssues.push(...probeResult.poisoningIssues);

        // If server requires auth (401/403), treat as positive and skip further probing
        if (probeResult.requiresAuth) {
          steps.push({
            stepName: 'BEHAVIOR_PROBE',
            status: 'PASS',
            issues: probeResult.poisoningIssues,
            details: 'Server correctly enforces authentication — unauthorized access blocked',
          });
        } else {

        // 3.4 Sandbox-verified hash (authoritative rug-pull detection)
        // Fast Docker check: docker --version returns immediately; docker info would hang 5s
        let dockerAvailable = false;
        try {
          execSync('docker --version', { stdio: 'ignore', timeout: 2000 });
          dockerAvailable = true;
        } catch {
          dockerAvailable = false;
        }

        if (server.url && dockerAvailable) {
          const scanId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const sandboxResult = await runSandboxedProbe({
            targetUrl: server.url,
            targetHeaders: server.headers,
            scanId,
            timeoutMs: 20000,
          });
          if (sandboxResult.success && sandboxResult.toolHash) {
            toolsHash = sandboxResult.toolHash;
            // Propagate any fallback sandbox issues (e.g., reduced isolation warnings)
            if (sandboxResult.fallbackIssues && sandboxResult.fallbackIssues.length > 0) {
              allIssues.push(...sandboxResult.fallbackIssues);
            }
          } else {
            allIssues.push({
              type: 'HASH_UNVERIFIED',
              severity: 'LOW',
              title: 'Hash computed outside sandbox — lower confidence',
              description: `Could not verify tool hash inside Docker sandbox: ${sandboxResult.error ?? 'unknown'}. Using host-computed hash.`,
              fix: 'Ensure Docker is installed and the scanner-probe image can be built',
              deduction: 0,
            });
          }
        } else if (server.url && !dockerAvailable) {
          allIssues.push({
            type: 'HASH_UNVERIFIED',
            severity: 'LOW',
            title: 'Hash computed outside sandbox — lower confidence',
            description: 'Docker is not available on this system. Tool hash was computed from host-side probe, which is less reliable than sandbox-verified hashes.',
            fix: 'Install Docker to enable sandboxed hash verification for rug-pull detection',
            deduction: 0,
          });
        }

        // 3.5 CORS validation
        corsResult = await checkCorsHeaders(server.url);
        if (corsResult.wildcardOrigin) {
          const corsIssue: Issue = {
            type: 'CORS_WILDCARD_ORIGIN',
            severity: 'CRITICAL',
            title: 'Any website can invoke MCP tools cross-origin',
            description: `Server "${name}" returns Access-Control-Allow-Origin: *. Any website can invoke your MCP tools cross-origin, enabling CSRF-style attacks on the MCP protocol.`,
            fix: 'Set Access-Control-Allow-Origin to a specific origin, not a wildcard.',
            deduction: 25,
          };
          allIssues.push(corsIssue);
        } else if (corsResult.originAbsent) {
          const corsIssue: Issue = {
            type: 'CORS_NO_POLICY',
            severity: 'HIGH',
            title: 'No CORS policy — browser clients may be exploitable',
            description: `Server "${name}" does not return Access-Control-Allow-Origin headers. Browser-based MCP clients may be vulnerable to cross-origin attacks.`,
            fix: 'Add specific CORS headers: Access-Control-Allow-Origin with your trusted domain(s).',
            deduction: 15,
          };
          allIssues.push(corsIssue);
        }

        // 3.3 Tool risk classification + 3.2 Injection scanning
        if (probedTools && probedTools.length > 0) {
          const { issues: injectionIssues } = scanForInjections(probedTools);
          allIssues.push(...injectionIssues);
        }

        steps.push({
          stepName: 'BEHAVIOR_PROBE',
          status: probeResult.poisoningIssues.length > 0 ? 'FAIL' : 'PASS',
          issues: probeResult.poisoningIssues,
          details: probeResult.toolCount > 0
            ? `Probe succeeded — ${probeResult.toolCount} tool(s), ${probeResult.promptsCount ?? 0} prompt(s), ${probeResult.resourcesCount ?? 0} resource(s)`
            : 'Probe succeeded — no tools exposed',
        });
        } // end else (server did NOT require auth)
      }
    } catch {
      allIssues.push({
        type: 'PROBE_FAILED',
        severity: 'MEDIUM',
        title: 'Runtime probe failed',
        description: `Could not probe server "${name}" at ${server.url}: unexpected error`,
        fix: 'Ensure the server is running, reachable, and responds to MCP protocol requests',
        deduction: 0,
      });

      steps.push({
        stepName: 'BEHAVIOR_PROBE',
        status: 'UNVERIFIED',
        issues: [allIssues[allIssues.length - 1]],
        details: 'Probe failed with unexpected error',
      });
    }
  } else if (!domainBlocked && !server.url) {
    steps.push({
      stepName: 'BEHAVIOR_PROBE',
      status: 'SKIP',
      issues: [],
      details: 'STDIO server — behavioral probe skipped (cannot probe STDIO remotely)',
    });
  } else {
    steps.push({
      stepName: 'BEHAVIOR_PROBE',
      status: 'SKIP',
      issues: [],
      details: 'Skipped due to domain check failure (blocked server)',
    });
  }

  // ── Step 4: Hash Comparison (Rescan Detection) ────────────────────
  let hashChanged = false;
  let previousHash: string | undefined;
  let isFirstScan = false;

  if (toolsHash && server.url) {
    const cleanToolNames = (probedTools ?? []).map(t => t.name);
    const { match, previousRecord, currentRecord, isFirstScan: first } = compareHash(
      server.url,
      toolsHash,
      probedTools?.length ?? 0,
      cleanToolNames,
    );

    isFirstScan = first;
    previousHash = previousRecord?.toolsHash;

    if (!first && !match) {
      hashChanged = true;
      const hashIssue: Issue = {
        type: 'RUG_PULL_DETECTED',
        severity: 'CRITICAL',
        title: 'Tool definition rug-pull detected — server changed its tools since last scan',
        description: `Tool definitions for server "${name}" have changed since ${previousRecord?.scannedAt ?? 'last scan'}. Previous hash: ${previousRecord?.toolsHash?.slice(0, 12) ?? 'unknown'} → ${toolsHash?.slice(0, 12) ?? 'unknown'}. This may indicate a rug-pull attack. The authoritative sandbox-verified hash differs from the stored baseline.`,
        fix: 'If unexpected, disconnect this server immediately. Rug-pull attacks are a top-2026 MCP attack vector.',
        deduction: 40,
      };
      allIssues.push(hashIssue);
    }

    // Store hash for future comparisons
    storeHash(currentRecord);

    steps.push({
      stepName: 'HASH_STATUS',
      status: isFirstScan ? 'PASS' : hashChanged ? 'FAIL' : 'PASS',
      issues: hashChanged ? [allIssues[allIssues.length - 1]] : [],
      details: isFirstScan
        ? `First scan of "${server.url}". Baseline captured (sha256:${toolsHash.slice(0, 12)}...).`
        : hashChanged
          ? `⚠️ Tool hashes changed since ${previousRecord?.scannedAt ?? 'last scan'}`
          : `✅ Tool definitions unchanged since ${previousRecord?.scannedAt ?? 'previous scan'}.`,
    });
  } else if (toolsHash && !server.url) {
    // STDIO server — still store hash keyed by server name
    const { currentRecord } = compareHash(name, toolsHash, probedTools?.length ?? 0, (probedTools ?? []).map(t => t.name));
    storeHash(currentRecord);
    isFirstScan = true;

    steps.push({
      stepName: 'HASH_STATUS',
      status: 'PASS',
      issues: [],
      details: `First scan of STDIO server "${name}". Baseline captured.`,
    });
  } else {
    steps.push({
      stepName: 'HASH_STATUS',
      status: 'SKIP',
      issues: [],
      details: 'No tools to hash — skipping hash comparison',
    });
  }

  // ── Compute Score ─────────────────────────────────────────────────
  let score = Math.max(0, 100 - allIssues.reduce((sum, i) => sum + i.deduction, 0));
  const capped = applyScoringCaps(score, allIssues);
  score = capped.score;

  // ── Determine Verdict ────────────────────────────────────────────
  const verdict = determineVerdict(score, allIssues, probeSucceeded, domainBlocked, hashChanged);

  // ── Build report ──────────────────────────────────────────────────
  const report: PipelineReport = {
    serverName: name,
    serverUrl: server.url,
    scanMode: 'FREE',
    verdict,
    score,
    grade: calculateGrade(score),
    scannedAt: startTime,
    steps,
    hashChanged,
    previousHash,
    corsResult,
    toolRiskMatrix: probedTools ? generateToolRiskMatrix(probedTools) : undefined,
  };

  return {
    report,
    serverIssues: enrichIssuesWithCompliance(allIssues),
    serverScore: score,
    isBlocked,
    probedTools,
    toolsHash,
    rawTools,
    promptsCount,
    resourcesCount,
  };
}

/**
 * Step 3.1: Unauthenticated access probe.
 * Send initialize request with NO auth headers.
 * If 200 OK → CRITICAL (server accepts unauthenticated connections).
 * If 401/403 → PASS (server correctly requires auth).
 */
async function probeUnauthenticatedAccess(url: string): Promise<Issue[]> {
  const issues: Issue[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'MCPGuardian Scanner', version: '1.0.0' },
          },
        }),
        signal: controller.signal,
      });

      if (res.status === 401 || res.status === 403) {
        // Server correctly rejects unauthenticated requests — PASS
        return [];
      }

      if (res.ok) {
        issues.push({
          type: 'UNAUTHENTICATED_ACCESS',
          severity: 'CRITICAL',
          title: 'Server accepted connection without credentials',
          description: `Server at "${url}" responded with HTTP ${res.status} without any authentication. The server is open to the entire internet. Block connection.`,
          fix: 'Add authentication (OAuth 2.1, API key, or Bearer token) to the MCP server. All MCP servers should require authentication.',
          deduction: 35,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Server unreachable — can't test unauthenticated access
  }

  return issues;
}
