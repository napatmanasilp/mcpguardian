import {
  type AgentDirective,
  type ConnectionVerdict,
  type DefaultPermissions,
  type SessionPolicy,
} from '../types/scan-report';
import type { ExtendedScanResult, Issue, ToolRiskEntry } from './types';
import { COMPLIANCE_MAP } from '../compliance-mappings';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Human-readable description per tool risk level. */
function riskLabel(risk: string): string {
  switch (risk) {
    case 'CRITICAL': return 'destructive';
    case 'HIGH': return 'mutating';
    case 'MEDIUM': return 'read-only';
    case 'LOW': return 'computational';
    default: return 'unclassified';
  }
}

/** Whether a tool risk is considered write-capable. */
function isWriteRisk(risk: string): boolean {
  return risk === 'CRITICAL' || risk === 'HIGH';
}

/** Whether a tool risk is destructive. */
function isDestructiveRisk(risk: string): boolean {
  return risk === 'CRITICAL';
}

// ─── Verdict Reason ──────────────────────────────────────────────────

function buildVerdictReason(
  verdict: ConnectionVerdict,
  score: number,
  criticalCount: number,
  highCount: number,
  crossServerCount: number,
): string {
  const parts: string[] = [];
  if (criticalCount > 0) parts.push(`${criticalCount} CRITICAL finding(s)`);
  if (highCount > 0) parts.push(`${highCount} HIGH finding(s)`);
  if (crossServerCount > 0) parts.push(`${crossServerCount} cross-server risk(s)`);

  switch (verdict) {
    case 'BLOCK':
      return `Score ${score} — BLOCKED. ${parts.join(', ')}. Connection refused.`;
    case 'ALLOW_WITH_CAUTION':
      return `Score ${score} — proceed with caution. ${parts.join(', ')}.`;
    case 'ALLOW':
      return `Score ${score} — no critical issues found. Connection permitted.`;
  }
}

// ─── Compliance Notes ────────────────────────────────────────────────

const COMPLIANCE_NOTE_TEMPLATES: Record<string, string> = {
  HARDCODED_SECRETS: 'Hardcoded secrets detected: revoke and rotate credentials immediately.',
  ENV_VARIABLE_EXPOSURE: 'Environment variables may expose secrets: review env configuration.',
  VULNERABLE_PACKAGE: 'Known vulnerable package detected: update to a patched version.',
  TYPOSQUAT_RISK: 'Package name likely typosquatted: verify the package source.',
  SLOPSQUATTING_RISK: 'AI-hallucinated package name detected: remove immediately.',
  UNPINNED_DEPENDENCY: 'Unpinned dependency may receive breaking updates: pin to a specific version.',
  UNVERIFIED_SOURCE: 'Unverified package source: only install from trusted registries.',
  PRERELEASE_PACKAGE: 'Pre-release package used: could introduce unstable or malicious code.',
  BROAD_PERMISSIONS: 'Broad filesystem permissions: restrict to minimal required paths.',
  ROOT_FILESYSTEM_ACCESS: 'Unrestricted FS access: limit to specific directories.',
  UNRESTRICTED_FILESYSTEM: 'Unrestricted filesystem server: add --directory flag.',
  FILE_SYSTEM_RESOURCE: 'File:// resource exposes local filesystem: remove or restrict.',
  INTERNAL_RESOURCE_EXPOSURE: 'Internal network resource exposed: remove or require auth.',
  TOOL_POISONING_RISK: 'Tool poisoning risk: human approval required for write tools.',
  PROMPT_POISONING_RISK: 'Prompt poisoning risk: review prompt descriptions carefully.',
  RESOURCE_POISONING_RISK: 'Resource poisoning risk: verify resource metadata.',
  STDIO_TRANSPORT: 'STDIO transport: prefer HTTPS for production deployments.',
  UNSAFE_COMMAND: 'Unsafe command execution risk: use only approved runtimes.',
  COMMAND_EXECUTION: 'Command execution capability: restrict or sandbox.',
  CONSENT_BYPASS: 'Auto-approval bypass detected: require per-tool consent.',
  MISSING_AUTH_HEADER: 'No Authorization header: add API key or Bearer token.',
  SECRET_IN_URL: 'Secret in URL: move to Authorization header to avoid log exposure.',
  HARDCODED_SECRET_IN_HEADERS: 'Hardcoded credential in headers: use env var references.',
  CWD_SENSITIVE_DIR: 'Dangerous working directory in sensitive path: restrict cwd.',
  CWD_BROAD_DIR: 'Working directory too broad: narrow to project-specific path.',
  MISSING_AUTHENTICATION: 'Server does not require authentication: add OAuth or API key.',
  AUTH_WEAK_BASIC: 'Weak Basic authentication: upgrade to OAuth 2.1 with PKCE.',
  AUTH_WEAK_DIGEST: 'Weak Digest authentication: upgrade to OAuth 2.1 with PKCE.',
  AUTH_NO_PKCE: 'OAuth flow without PKCE: implement PKCE per RFC 7636.',
  AUTH_NO_TOKEN_EXPIRY: 'OAuth token without expiry: configure token expiration.',
  CREDENTIAL_REFLECTION: 'Server echoes back credentials: fix to avoid credential leakage.',
  HARDCODED_CREDENTIAL_IN_ARGS: 'Hardcoded credential in command args: use env vars.',
  INSECURE_URL: 'HTTP without TLS: upgrade to HTTPS.',
  LEGACY_SSE_TRANSPORT: 'Deprecated SSE transport: migrate to Streamable HTTP.',
  RUG_PULL_DETECTED: 'Rug-pull detected: tool definitions changed since last scan.',
  TOOL_SHADOWING_RISK: 'Tool shadowing across servers: review combined toolset.',
  CROSS_SERVER_MANIPULATION: 'Cross-server manipulation: server description references another server.',
  MULTI_SERVER_COMPOUND_RISK: 'Compound risk from multiple servers: limit connected servers.',
  UNDOCUMENTED_PROMPT: 'Undocumented prompt found: add descriptions for transparency.',
  UNAUTHENTICATED_ACCESS: 'Server accepts unauthenticated connections: block network access.',
  CORS_WILDCARD_ORIGIN: 'CORS wildcard origin: restrict to specific origins.',
  CORS_NO_POLICY: 'No CORS policy: add CORS headers for browser clients.',
  PROBE_FAILED: 'Runtime probe failed: server may be unreachable or misconfigured.',
};

function buildComplianceNotes(allIssues: Issue[], crossServerIssues: Issue[]): string[] {
  const seenCodes = new Set<string>();
  const notes: string[] = [];

  const allItems = [...allIssues, ...crossServerIssues];

  for (const issue of allItems) {
    const refs = COMPLIANCE_MAP[issue.type];
    if (!refs) continue;

    const template = COMPLIANCE_NOTE_TEMPLATES[issue.type] ?? `${issue.type}: review findings.`;

    for (const code of refs.owasp_mcp) {
      const key = `${code}:${issue.type}`;
      if (seenCodes.has(key)) continue;
      seenCodes.add(key);
      notes.push(`[${code}] ${template}`);
    }

    for (const code of refs.nsa_csi) {
      const key = `${code}:${issue.type}`;
      if (seenCodes.has(key)) continue;
      seenCodes.add(key);
      notes.push(`[${code}] ${template}`);
    }
  }

  return notes;
}

// ─── Main Builder ────────────────────────────────────────────────────

export function buildAgentDirective(result: ExtendedScanResult): AgentDirective {
  // ── Collect data ─────────────────────────────────────────────────
  const allIssues: Issue[] = result.servers.flatMap(s => s.issues);
  const allCrossServerIssues: Issue[] = (result.crossServerRisks ?? []) as unknown as Issue[];
  const allToolRisks: ToolRiskEntry[] = (result.pipelineReports ?? [])
    .flatMap(r => r.toolRiskMatrix ?? []);

  const criticalCount = allIssues.filter(i => i.severity === 'CRITICAL').length;
  const highCount = allIssues.filter(i => i.severity === 'HIGH').length;
  const crossServerCount = allCrossServerIssues.length;

  // ── Connection Verdict ───────────────────────────────────────────
  let connectionVerdict: ConnectionVerdict;
  if (result.score < 50 || criticalCount > 0) {
    connectionVerdict = 'BLOCK';
  } else if (result.score < 75 || highCount > 0) {
    connectionVerdict = 'ALLOW_WITH_CAUTION';
  } else {
    connectionVerdict = 'ALLOW';
  }

  const verdictReason = buildVerdictReason(
    connectionVerdict,
    result.score,
    criticalCount,
    highCount,
    crossServerCount,
  );

  // ── Default Permissions ──────────────────────────────────────────
  const hasWriteRisk = allToolRisks.some(t => isWriteRisk(t.risk));
  const hasDestructiveRisk = allToolRisks.some(t => isDestructiveRisk(t.risk));
  const hasSsrfRisk = allIssues.some(i =>
    i.type === 'CORS_WILDCARD_ORIGIN' || i.type === 'INTERNAL_RESOURCE_EXPOSURE',
  );

  const defaultPermissions: DefaultPermissions = {
    can_read: result.score >= 40,
    can_write: !hasWriteRisk,
    can_delete: !hasDestructiveRisk,
    can_execute: !hasWriteRisk,
    can_make_network_requests: !hasSsrfRisk,
  };

  // ── Tool Categorization ──────────────────────────────────────────
  const toolsBlocked = allToolRisks
    .filter(t => t.risk === 'CRITICAL')
    .map(t => t.toolName);

  const toolsRequiringApproval = allToolRisks
    .filter(t => t.risk === 'HIGH')
    .map(t => t.toolName);

  const blockedOrApproval = new Set([...toolsBlocked, ...toolsRequiringApproval]);
  const toolsAutoApproved = allToolRisks
    .filter(t => !blockedOrApproval.has(t.toolName))
    .map(t => t.toolName);

  // ── Session Policy ───────────────────────────────────────────────
  const hasCriticalOrHigh = criticalCount > 0 || highCount > 0;

  let rescanIntervalMinutes: number;
  let maxInvocationsPerToolPerHour: number;
  let requireHumanApprovalAboveRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  switch (connectionVerdict) {
    case 'BLOCK':
      rescanIntervalMinutes = 0;
      maxInvocationsPerToolPerHour = 0;
      requireHumanApprovalAboveRisk = 'LOW';
      break;
    case 'ALLOW_WITH_CAUTION':
      rescanIntervalMinutes = 15;
      maxInvocationsPerToolPerHour = 100;
      requireHumanApprovalAboveRisk = 'MEDIUM';
      break;
    case 'ALLOW':
      rescanIntervalMinutes = 60;
      maxInvocationsPerToolPerHour = 1000;
      requireHumanApprovalAboveRisk = 'HIGH';
      break;
  }

  const sessionPolicy: SessionPolicy = {
    rescan_interval_minutes: rescanIntervalMinutes,
    max_invocations_per_tool_per_hour: maxInvocationsPerToolPerHour,
    alert_on_new_parameters: true,
    alert_on_response_size_change: hasCriticalOrHigh,
    require_human_approval_above_risk: requireHumanApprovalAboveRisk,
  };

  // ── Compliance Notes ─────────────────────────────────────────────
  const complianceNotes = buildComplianceNotes(allIssues, allCrossServerIssues);

  return {
    connection_verdict: connectionVerdict,
    verdict_reason: verdictReason,
    default_permissions: defaultPermissions,
    tools_blocked: toolsBlocked,
    tools_requiring_approval: toolsRequiringApproval,
    tools_auto_approved: toolsAutoApproved,
    session_policy: sessionPolicy,
    compliance_notes: complianceNotes,
  };
}
