// ─── McpServerInput type (used by pipeline & scanner) ─────────────────┐
// Kept here for import convenience; canonical definition is in index.ts  │
// ───────────────────────────────────────────────────────────────────────┘

export interface McpServerInput {
  command?: string;
  url?: string;
  args?: string[];
  env?: Record<string, string>;
  sbomPath?: string;
  headers?: Record<string, string>;
  cwd?: string;
}

// Backward-compatible alias for ExtendedScanResult
export type ScanResult = ExtendedScanResult;

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export type Verdict = 'SAFE' | 'CAUTION' | 'DO_NOT_CONNECT' | 'UNVERIFIED';

export type ScanMode = 'FREE' | 'MONITORED';

export interface ComplianceRefs {
  owasp_mcp: string[];
  owasp_agentic: string[];
  nsa_csi: string[];
  cwe: string[];
}

export interface Issue {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  deduction: number;
  compliance?: ComplianceRefs;
  diff?: {
    added: string[];
    removed: string[];
    modified: Array<{ name: string; oldDesc: string; newDesc: string }>;
  };
}

export interface ServerResult {
  name: string;
  score: number;
  grade: Grade;
  issues: Issue[];
  toolsHash?: string;
  rawTools?: unknown[];
  serverUrl?: string;
  promptsCount: number;
  resourcesCount: number;
}

export interface CrossServerRisk {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  fix: string;
  deduction: number;
  compliance?: ComplianceRefs;
}

export interface ComplianceSummary {
  owasp_mcp: string[];
  owasp_agentic: string[];
  nsa_csi: string[];
  cwe: string[];
  mitre_atlas: Array<{
    technique_id: string;
    technique_name: string;
    tactic: string;
    triggered_by: string[];
    url: string;
  }>;
  mitre_atlas_techniques_matched: number;
}

export interface SbomEntry {
  package: string;
  version: string;
  cve_matches: string[];
}

// ─── Domain Verification Types ────────────────────────────────────────

export interface DomainCheckResult {
  domain: string;
  domainAgeDays: number | null;
  domainAgeFlagged: boolean;
  domainPrivacyHidden: boolean;
  sslValid: boolean;
  sslExpired: boolean;
  sslSelfSigned: boolean;
  sslDomainMismatch: boolean;
  certChainValid: boolean;
  certChainDepth: number | null;
  certRootCA: string | null;
  certInCTLogs: boolean | null;
  ctIssuerName: string | null;
  ctCertCount: number | null;
  hstsPresent: boolean;
  hstsMaxAge: number | null;
  ocspStatus: string | null; // 'GOOD' | 'REVOKED' | 'UNKNOWN' | null
  ipReputationScore: number | null;
  ipReputationFlagged: boolean;
  ipReputationUnverified: boolean;
  dnsConsistent: boolean;
  dnsResults: string[];
  blocklisted: boolean;
  blocklistReason: string | null;
  criticalBlocked: boolean; // true = stop pipeline, do not connect
}

// ─── CORS Validation Types ───────────────────────────────────────────

export interface CorsResult {
  originHeader: string | null;
  wildcardOrigin: boolean;
  originAbsent: boolean;
  specificOrigin: boolean;
}

// ─── Tool Risk Classification ───────────────────────────────────────

export type ToolRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface ToolRiskEntry {
  toolName: string;
  risk: ToolRiskLevel;
  reason: string;
}

// ─── Hash Store Types ────────────────────────────────────────────────

export interface ToolHashRecord {
  serverUrl: string;
  toolsHash: string;
  scannedAt: string;
  toolCount: number;
}

// ─── Pipeline Step Results ───────────────────────────────────────────

export interface PipelineStepResult {
  stepName: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'UNVERIFIED';
  issues: Issue[];
  details?: string;
}

export interface PipelineReport {
  serverName: string;
  serverUrl: string | undefined;
  scanMode: ScanMode;
  verdict: Verdict;
  score: number;
  grade: Grade;
  scannedAt: string;
  steps: PipelineStepResult[];
  complianceSummary?: ComplianceSummary;
  domainCheck?: DomainCheckResult;
  corsResult?: CorsResult;
  toolRiskMatrix?: ToolRiskEntry[];
  toolHashRecord?: ToolHashRecord;
  hashChanged?: boolean;
  previousHash?: string;
  monitoringActive?: boolean;
  nextScheduledScan?: string;
}

// ─── Extended Scan Result ────────────────────────────────────────────

export interface ExtendedScanResult {
  grade: Grade;
  score: number;
  verdict: Verdict;
  scanMode: ScanMode;
  serversScanned: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  servers: ServerResult[];
  scannedAt: string;
  worstServer: string;
  secondaryScore: number;
  totalPromptsScanned: number;
  totalResourcesScanned: number;
  crossServerRisks?: CrossServerRisk[];
  crossServerDeduction?: number;
  complianceSummary?: ComplianceSummary;
  sbom?: SbomEntry[];
  pipelineReports?: PipelineReport[];
}

export interface SecretMatch {
  patternName: string;
  match: string;
  severity: Severity;
}

export type VersionField = 'semver' | 'all' | 'flag-check';
export type MatchType = 'exact' | 'substring';

export interface VulnerablePackage {
  name: string;
  versions: string;
  cve: string;
  severity: Severity;
  description: string;
  fix: string;
  matchType: MatchType;
  versionField: VersionField;
}

export interface ProbedTool {
  name: string;
  description: string;
  inputSchema: unknown;
  suspiciousScore: number;
  flags: string[];
}

export interface ProbedPrompt {
  name: string;
  description: string;
  argumentsCount: number;
  suspiciousScore: number;
  flags: string[];
}

export interface ProbedResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  suspiciousScore: number;
  flags: string[];
}

export interface ProbeResult {
  reachable: boolean;
  requiresAuth: boolean;
  toolCount: number;
  tools: ProbedTool[];
  promptsCount: number;
  prompts: ProbedPrompt[];
  resourcesCount: number;
  resources: ProbedResource[];
  poisoningIssues: Issue[];
  probeError?: string;
  toolsHash?: string;
  rawTools?: unknown[];
}
