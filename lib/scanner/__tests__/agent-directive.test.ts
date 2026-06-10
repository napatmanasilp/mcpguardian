import { describe, it, expect } from 'vitest';
import { buildAgentDirective } from '../report-builder';
import type { ExtendedScanResult, Issue, ServerResult, PipelineReport } from '../types';
import type { ToolRiskEntry } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeServer(overrides: Partial<ServerResult> = {}): ServerResult {
  return {
    name: 'test-server',
    score: 100,
    grade: 'A',
    issues: [],
    toolsHash: undefined,
    rawTools: undefined,
    serverUrl: 'https://api.test.com/mcp',
    promptsCount: 0,
    resourcesCount: 0,
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'TEST_ISSUE',
    severity: 'LOW',
    title: 'Test issue',
    description: 'A test issue for unit testing',
    fix: 'Fix it',
    deduction: 0,
    ...overrides,
  };
}

function makeToolRisk(overrides: Partial<ToolRiskEntry> = {}): ToolRiskEntry {
  return {
    toolName: 'test-tool',
    risk: 'LOW',
    reason: 'Computational — safe operation',
    ...overrides,
  };
}

function makePipelineReport(overrides: Partial<PipelineReport> = {}): PipelineReport {
  return {
    serverName: 'test-server',
    serverUrl: 'https://api.test.com/mcp',
    scanMode: 'FREE',
    verdict: 'SAFE',
    score: 100,
    grade: 'A',
    scannedAt: new Date().toISOString(),
    steps: [],
    toolRiskMatrix: [],
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ExtendedScanResult> = {}): ExtendedScanResult {
  return {
    grade: 'A',
    score: 100,
    verdict: 'SAFE',
    scanMode: 'FREE',
    serversScanned: 1,
    criticalIssues: 0,
    highIssues: 0,
    mediumIssues: 0,
    servers: [makeServer()],
    scannedAt: new Date().toISOString(),
    worstServer: 'test-server',
    secondaryScore: 100,
    totalPromptsScanned: 0,
    totalResourcesScanned: 0,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('buildAgentDirective', () => {

  // ── Verdict: BLOCK when score < 50 ────────────────────────────────
  it('produces verdict BLOCK when score < 50', () => {
    const result = makeScanResult({ score: 40, grade: 'F' });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('BLOCK');
    expect(directive.verdict_reason).toContain('BLOCKED');
  });

  // ── Verdict: BLOCK when CRITICAL finding exists ───────────────────
  it('produces verdict BLOCK when CRITICAL finding exists even with high score', () => {
    const server = makeServer({
      issues: [makeIssue({ type: 'CRITICAL_ISSUE', severity: 'CRITICAL', deduction: 40 })],
    });
    const result = makeScanResult({ score: 85, servers: [server], criticalIssues: 1 });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('BLOCK');
  });

  // ── Verdict: ALLOW_WITH_CAUTION when score 50-74 ──────────────────
  it('produces ALLOW_WITH_CAUTION when score is 50-74', () => {
    const result = makeScanResult({ score: 65, grade: 'D' });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('ALLOW_WITH_CAUTION');
  });

  // ── Verdict: ALLOW when score >= 75 and no CRITICAL ───────────────
  it('produces ALLOW when score >= 75 and no CRITICAL findings', () => {
    const result = makeScanResult({ score: 90, grade: 'A' });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('ALLOW');
    expect(directive.verdict_reason).toContain('Connection permitted');
  });

  // ── can_delete set to false when CRITICAL tool risk exists ─────────
  it('sets can_delete: false when any tool has CRITICAL risk', () => {
    const report = makePipelineReport({
      toolRiskMatrix: [
        makeToolRisk({ toolName: 'delete_all', risk: 'CRITICAL' }),
        makeToolRisk({ toolName: 'read_data', risk: 'LOW' }),
      ],
    });
    const result = makeScanResult({ pipelineReports: [report] });
    const directive = buildAgentDirective(result);
    expect(directive.default_permissions.can_delete).toBe(false);
    expect(directive.default_permissions.can_write).toBe(false);
    expect(directive.default_permissions.can_execute).toBe(false);
    expect(directive.default_permissions.can_read).toBe(true);
  });

  // ── can_write false when HIGH+ tool exists ─────────────────────────
  it('sets can_write: false when any tool has HIGH risk', () => {
    const report = makePipelineReport({
      toolRiskMatrix: [
        makeToolRisk({ toolName: 'write_file', risk: 'HIGH' }),
      ],
    });
    const result = makeScanResult({ pipelineReports: [report] });
    const directive = buildAgentDirective(result);
    expect(directive.default_permissions.can_write).toBe(false);
    expect(directive.default_permissions.can_delete).toBe(true); // not CRITICAL
    expect(directive.default_permissions.can_execute).toBe(false); // HIGH risk includes exec keywords
  });

  // ── can_read false when score < 40 ─────────────────────────────────
  it('sets can_read: false when score < 40', () => {
    const result = makeScanResult({ score: 35, grade: 'F' });
    const directive = buildAgentDirective(result);
    expect(directive.default_permissions.can_read).toBe(false);
  });

  // ── can_make_network_requests false when CORS wildcard exists ──────
  it('sets can_make_network_requests: false when SSRF-related finding exists', () => {
    const server = makeServer({
      issues: [makeIssue({ type: 'CORS_WILDCARD_ORIGIN', severity: 'CRITICAL' })],
    });
    const result = makeScanResult({ servers: [server], criticalIssues: 1 });
    const directive = buildAgentDirective(result);
    expect(directive.default_permissions.can_make_network_requests).toBe(false);
  });

  // ── tools_blocked populated from CRITICAL tool risks ──────────────
  it('tools_blocked contains tool names with CRITICAL risk', () => {
    const report = makePipelineReport({
      toolRiskMatrix: [
        makeToolRisk({ toolName: 'destroy', risk: 'CRITICAL' }),
        makeToolRisk({ toolName: 'write', risk: 'HIGH' }),
        makeToolRisk({ toolName: 'read', risk: 'MEDIUM' }),
      ],
    });
    const result = makeScanResult({ pipelineReports: [report] });
    const directive = buildAgentDirective(result);
    expect(directive.tools_blocked).toEqual(['destroy']);
    expect(directive.tools_requiring_approval).toEqual(['write']);
    expect(directive.tools_auto_approved).toEqual(['read']);
  });

  // ── tools_requiring_approval from HIGH findings ────────────────────
  it('tools_requiring_approval correctly populated from HIGH tool risks', () => {
    const report = makePipelineReport({
      toolRiskMatrix: [
        makeToolRisk({ toolName: 'update', risk: 'HIGH' }),
        makeToolRisk({ toolName: 'insert', risk: 'HIGH' }),
        makeToolRisk({ toolName: 'list', risk: 'LOW' }),
      ],
    });
    const result = makeScanResult({ pipelineReports: [report] });
    const directive = buildAgentDirective(result);
    expect(directive.tools_requiring_approval).toContain('update');
    expect(directive.tools_requiring_approval).toContain('insert');
    expect(directive.tools_auto_approved).toContain('list');
    expect(directive.tools_blocked).toEqual([]);
  });

  // ── Session policy rescan interval changes with verdict ──────────
  it('session_policy rescan_interval is 60 for ALLOW', () => {
    const result = makeScanResult({ score: 90 });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('ALLOW');
    expect(directive.session_policy.rescan_interval_minutes).toBe(60);
    expect(directive.session_policy.max_invocations_per_tool_per_hour).toBe(1000);
    expect(directive.session_policy.require_human_approval_above_risk).toBe('HIGH');
  });

  it('session_policy rescan_interval is 15 for ALLOW_WITH_CAUTION', () => {
    const server = makeServer({
      issues: [makeIssue({ type: 'HIGH_ISSUE', severity: 'HIGH', deduction: 20 })],
    });
    const result = makeScanResult({ score: 70, servers: [server], highIssues: 1 });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('ALLOW_WITH_CAUTION');
    expect(directive.session_policy.rescan_interval_minutes).toBe(15);
    expect(directive.session_policy.max_invocations_per_tool_per_hour).toBe(100);
    expect(directive.session_policy.require_human_approval_above_risk).toBe('MEDIUM');
  });

  it('session_policy rescan_interval is 0 for BLOCK', () => {
    const result = makeScanResult({ score: 30, grade: 'F' });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBe('BLOCK');
    expect(directive.session_policy.rescan_interval_minutes).toBe(0);
    expect(directive.session_policy.max_invocations_per_tool_per_hour).toBe(0);
  });

  // ── Compliance notes generated ─────────────────────────────────────
  it('compliance_notes includes formatted OWASP codes from findings', () => {
    const server = makeServer({
      issues: [makeIssue({
        type: 'TOOL_POISONING_RISK',
        severity: 'CRITICAL',
        title: 'Tool poisoning detected',
        description: 'Suspicious patterns found in tool descriptions',
        fix: 'Do not use this server',
        deduction: 35,
      })],
    });
    const result = makeScanResult({
      servers: [server],
      criticalIssues: 1,
      score: 60,
    });
    const directive = buildAgentDirective(result);
    expect(directive.compliance_notes.length).toBeGreaterThan(0);
    const mcp03Note = directive.compliance_notes.find(n => n.startsWith('[MCP03]'));
    expect(mcp03Note).toBeDefined();
    expect(mcp03Note).toContain('Tool poisoning');
  });

  // ── Empty tool lists produce empty arrays ──────────────────────────
  it('handles empty tool risk matrix gracefully', () => {
    const result = makeScanResult();
    const directive = buildAgentDirective(result);
    expect(directive.tools_blocked).toEqual([]);
    expect(directive.tools_requiring_approval).toEqual([]);
    expect(directive.tools_auto_approved).toEqual([]);
    expect(directive.compliance_notes).toEqual([]);
  });

  // ── No cross-server risks ─────────────────────────────────────────
  it('handles absence of crossServerRisks', () => {
    const result = makeScanResult({ crossServerRisks: undefined });
    const directive = buildAgentDirective(result);
    expect(directive.connection_verdict).toBeDefined();
  });

  // ── alert_on_response_size_change true when CRITICAL/HIGH exist ────
  it('sets alert_on_response_size_change true when CRITICAL/HIGH findings exist', () => {
    const server = makeServer({
      issues: [makeIssue({ type: 'MISSING_AUTHENTICATION', severity: 'HIGH', deduction: 20 })],
    });
    const result = makeScanResult({ score: 70, servers: [server], highIssues: 1 });
    const directive = buildAgentDirective(result);
    expect(directive.session_policy.alert_on_response_size_change).toBe(true);
  });

  it('sets alert_on_response_size_change false when no CRITICAL/HIGH', () => {
    const server = makeServer({
      issues: [makeIssue({ type: 'UNDOCUMENTED_PROMPT', severity: 'LOW', deduction: 0 })],
    });
    const result = makeScanResult({ servers: [server] });
    const directive = buildAgentDirective(result);
    expect(directive.session_policy.alert_on_response_size_change).toBe(false);
  });
});
