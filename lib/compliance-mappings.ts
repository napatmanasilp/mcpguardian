export interface ComplianceRefs {
  owasp_mcp: string[];
  owasp_agentic: string[];
  nsa_csi: string[];
  cwe: string[];
}

export interface MitreAtlasEntry {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  url: string;
}

export type ComplianceSummary = {
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
};

const makeRefs = (owasp_mcp: string[], owasp_agentic: string[], nsa_csi: string[], cwe: string[]): ComplianceRefs => ({
  owasp_mcp,
  owasp_agentic,
  nsa_csi,
  cwe,
});

const DEFAULT: ComplianceRefs = makeRefs(
  ['MCP10'], ['ASI00'], [], ['CWE-1104'],
);

export const COMPLIANCE_MAP: Record<string, ComplianceRefs> = {
  // ── Credential & secret exposure ─────────────────────────────────────
  HARDCODED_SECRETS: makeRefs(
    ['MCP01'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-312'],
  ),
  ENV_VARIABLE_EXPOSURE: makeRefs(
    ['MCP01'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-200'],
  ),

  // ── Supply chain & provenance ────────────────────────────────────────
  VULNERABLE_PACKAGE: makeRefs(
    ['MCP04'], ['ASI08'], [], ['CWE-1395'],
  ),
  TYPOSQUAT_RISK: makeRefs(
    ['MCP04'], ['ASI08'], [], ['CWE-829'],
  ),
  SLOPSQUATTING_RISK: makeRefs(
    ['MCP04'], ['ASI08'], [], ['CWE-829', 'CWE-1287'],
  ),
  UNPINNED_DEPENDENCY: makeRefs(
    ['MCP04'], ['ASI08'], ['NSA-MCP-1.3'], ['CWE-1104'],
  ),
  UNVERIFIED_SOURCE: makeRefs(
    ['MCP04'], ['ASI08'], [], ['CWE-829'],
  ),
  PRERELEASE_PACKAGE: makeRefs(
    ['MCP04'], [], [], ['CWE-1104'],
  ),

  // ── Permission & filesystem ──────────────────────────────────────────
  BROAD_PERMISSIONS: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-250'],
  ),
  ROOT_FILESYSTEM_ACCESS: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-22'],
  ),
  UNRESTRICTED_FILESYSTEM: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-22'],
  ),
  FILE_SYSTEM_RESOURCE: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-22'],
  ),
  INTERNAL_RESOURCE_EXPOSURE: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-200'],
  ),

  // ── Tool poisoning & injection ───────────────────────────────────────
  TOOL_POISONING_RISK: makeRefs(
    ['MCP03', 'MCP06'], ['ASI03'], [], ['CWE-94'],
  ),
  PROMPT_POISONING_RISK: makeRefs(
    ['MCP03', 'MCP06'], ['ASI03'], [], ['CWE-94'],
  ),
  RESOURCE_POISONING_RISK: makeRefs(
    ['MCP03', 'MCP06'], ['ASI03'], [], ['CWE-94'],
  ),

  // ── Execution & transport ────────────────────────────────────────────
  STDIO_TRANSPORT: makeRefs(
    ['MCP05'], ['ASI03'], ['NSA-MCP-3.1'], ['CWE-78'],
  ),
  UNSAFE_COMMAND: makeRefs(
    ['MCP05'], ['ASI03'], ['NSA-MCP-3.1'], ['CWE-78'],
  ),
  COMMAND_EXECUTION: makeRefs(
    ['MCP05'], ['ASI03'], ['NSA-MCP-3.1'], ['CWE-78'],
  ),
  CONSENT_BYPASS: makeRefs(
    ['MCP08'], ['ASI04'], ['NSA-MCP-2.4'], ['CWE-862'],
  ),

  // ── New: Missing auth header on URL servers (Rule 1) ────────────────
  MISSING_AUTH_HEADER: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-306'],
  ),

  // ── New: Secret in URL query string (Rule 2) ────────────────────────
  SECRET_IN_URL: makeRefs(
    ['MCP01'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-598', 'CWE-200'],
  ),

  // ── New: Hardcoded secret in config headers (Rule 3) ────────────────
  HARDCODED_SECRET_IN_HEADERS: makeRefs(
    ['MCP01'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-798'],
  ),

  // ── New: Dangerous working directory cwd (Rule 4) ───────────────────
  CWD_SENSITIVE_DIR: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-22'],
  ),
  CWD_BROAD_DIR: makeRefs(
    ['MCP02'], ['ASI05'], ['NSA-MCP-2.3'], ['CWE-22'],
  ),

  // ── Authentication & network ─────────────────────────────────────────
  MISSING_AUTHENTICATION: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-306'],
  ),
  AUTH_WEAK_BASIC: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-326'],
  ),
  AUTH_WEAK_DIGEST: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-326'],
  ),
  AUTH_NO_PKCE: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-523'],
  ),
  AUTH_NO_TOKEN_EXPIRY: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-672'],
  ),
  CREDENTIAL_REFLECTION: makeRefs(
    ['MCP01'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-522'],
  ),
  HARDCODED_CREDENTIAL_IN_ARGS: makeRefs(
    ['MCP01', 'MCP05'], ['ASI07'], ['NSA-MCP-1.1'], ['CWE-798'],
  ),
  INSECURE_URL: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-319'],
  ),
  LEGACY_SSE_TRANSPORT: makeRefs(
    ['MCP07'], [], ['NSA-MCP-2.1'], ['CWE-326'],
  ),

  // ── Cross-server & supply chain integrity ────────────────────────────
  RUG_PULL_DETECTED: makeRefs(
    ['MCP03', 'MCP09'], ['ASI01'], [], ['CWE-494'],
  ),
  TOOL_SHADOWING_RISK: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-345'],
  ),
  CROSS_SERVER_MANIPULATION: makeRefs(
    ['MCP03', 'MCP09'], ['ASI01'], [], ['CWE-345'],
  ),
  MULTI_SERVER_COMPOUND_RISK: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-345'],
  ),

  // ── Preference Manipulation (MPMA) ─────────────────────────────────
  PREFERENCE_MANIPULATION: makeRefs(
    ['MCP03'], ['ASI02'], ['Section 3.2'], ['CWE-94'],
  ),
  FALSE_DEPRECATION_CLAIM: makeRefs(
    ['MCP03'], [], [], ['CWE-94'],
  ),
  PRIORITY_MANIPULATION: makeRefs(
    ['MCP03'], [], [], ['CWE-94'],
  ),
  TRUST_MANIPULATION: makeRefs(
    ['MCP03'], [], [], ['CWE-94'],
  ),
  TOOL_SUPPRESSION: makeRefs(
    ['MCP03'], ['ASI02'], [], ['CWE-94'],
  ),
  REDIRECT_MANIPULATION: makeRefs(
    ['MCP03'], [], [], ['CWE-94'],
  ),

  // ── Prompt / resource documentation ──────────────────────────────────
  UNDOCUMENTED_PROMPT: makeRefs(
    ['MCP10'], ['ASI06'], [], ['CWE-1104'],
  ),

  // ── Pipeline stage issues ────────────────────────────────────────────
  UNAUTHENTICATED_ACCESS: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-306', 'CWE-862'],
  ),
  DOMAIN_TOO_NEW: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-345'],
  ),
  SSL_CERT_EXPIRED: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-295'],
  ),
  SSL_SELF_SIGNED: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-295'],
  ),
  SSL_DOMAIN_MISMATCH: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-297'],
  ),
  IP_REPUTATION_BAD: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-515'],
  ),
  IP_REPUTATION_SUSPICIOUS: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-515'],
  ),
  IP_REPUTATION_UNVERIFIED: makeRefs(
    [], [], [], [],
  ),
  DNS_INCONSISTENT: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-350', 'CWE-345'],
  ),
  BLOCKLISTED_SERVER: makeRefs(
    ['MCP09'], ['ASI01'], [], ['CWE-345'],
  ),
  CORS_WILDCARD_ORIGIN: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-942'],
  ),
  CORS_NO_POLICY: makeRefs(
    ['MCP07'], ['ASI05'], ['NSA-MCP-2.1'], ['CWE-942'],
  ),
  TOOL_HASH_MISMATCH: makeRefs(
    ['MCP03', 'MCP09'], ['ASI01'], [], ['CWE-494'],
  ),
  CONFIRMED_INJECTION: makeRefs(
    ['MCP03', 'MCP06'], ['ASI03'], [], ['CWE-94'],
  ),
  SUSPECTED_INJECTION: makeRefs(
    ['MCP03', 'MCP06'], ['ASI03'], [], ['CWE-94'],
  ),

  // ── Informational ────────────────────────────────────────────────────
  PROBE_FAILED: makeRefs(
    [], [], [], [],
  ),
  SBOM_UNAVAILABLE: makeRefs(
    [], [], [], [],
  ),
};

// Every scanner-level issue type must be listed here so the test
// can verify each has a corresponding entry in COMPLIANCE_MAP.
export const ISSUE_TYPES: string[] = [
  'AUTH_NO_PKCE',
  'AUTH_NO_TOKEN_EXPIRY',
  'CWD_BROAD_DIR',
  'CWD_SENSITIVE_DIR',
  'HARDCODED_SECRET_IN_HEADERS',
  'MISSING_AUTH_HEADER',
  'SECRET_IN_URL',
  'AUTH_WEAK_BASIC',
  'AUTH_WEAK_DIGEST',
  'BROAD_PERMISSIONS',
  'COMMAND_EXECUTION',
  'CONSENT_BYPASS',
  'CREDENTIAL_REFLECTION',
  'CROSS_SERVER_MANIPULATION',
  'ENV_VARIABLE_EXPOSURE',
  'FILE_SYSTEM_RESOURCE',
  'HARDCODED_CREDENTIAL_IN_ARGS',
  'HARDCODED_SECRETS',
  'INSECURE_URL',
  'INTERNAL_RESOURCE_EXPOSURE',
  'LEGACY_SSE_TRANSPORT',
  'MISSING_AUTHENTICATION',
  'MULTI_SERVER_COMPOUND_RISK',
  'PRERELEASE_PACKAGE',
  'PROBE_FAILED',
  'PROMPT_POISONING_RISK',
  'RESOURCE_POISONING_RISK',
  'ROOT_FILESYSTEM_ACCESS',
  'RUG_PULL_DETECTED',
  'SBOM_UNAVAILABLE',
  'SLOPSQUATTING_RISK',
  'STDIO_TRANSPORT',
  'TOOL_POISONING_RISK',
  'TOOL_SHADOWING_RISK',
  'TYPOSQUAT_RISK',
  'UNDOCUMENTED_PROMPT',
  'UNPINNED_DEPENDENCY',
  'BLOCKLISTED_SERVER',
  'CORS_NO_POLICY',
  'CORS_WILDCARD_ORIGIN',
  'CONFIRMED_INJECTION',
  'DNS_INCONSISTENT',
  'DOMAIN_TOO_NEW',
  'FALSE_DEPRECATION_CLAIM',
  'IP_REPUTATION_BAD',
  'IP_REPUTATION_SUSPICIOUS',
  'IP_REPUTATION_UNVERIFIED',
  'PREFERENCE_MANIPULATION',
  'PRIORITY_MANIPULATION',
  'REDIRECT_MANIPULATION',
  'SSL_CERT_EXPIRED',
  'SSL_DOMAIN_MISMATCH',
  'SSL_SELF_SIGNED',
  'SUSPECTED_INJECTION',
  'TOOL_HASH_MISMATCH',
  'TOOL_SUPPRESSION',
  'TRUST_MANIPULATION',
  'UNAUTHENTICATED_ACCESS',
  'UNRESTRICTED_FILESYSTEM',
  'UNSAFE_COMMAND',
  'UNVERIFIED_SOURCE',
  'VULNERABLE_PACKAGE',
];

// ─── MITRE ATLAS Technique Mappings ───────────────────────────────────
// Maps MCPGuardian finding codes to MITRE ATLAS techniques.
// https://atlas.mitre.org

export const MITRE_ATLAS_MAPPINGS: Record<string, MitreAtlasEntry> = {
  // ── Preference Manipulation (MPMA) ──────────────────────────────────
  PREFERENCE_MANIPULATION: {
    techniqueId: 'AML.T0054.002',
    techniqueName: 'MCP Preference Manipulation',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  FALSE_DEPRECATION_CLAIM: {
    techniqueId: 'AML.T0054.002',
    techniqueName: 'MCP Preference Manipulation',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  PRIORITY_MANIPULATION: {
    techniqueId: 'AML.T0054.002',
    techniqueName: 'MCP Preference Manipulation',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  TRUST_MANIPULATION: {
    techniqueId: 'AML.T0054.002',
    techniqueName: 'MCP Preference Manipulation',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  TOOL_SUPPRESSION: {
    techniqueId: 'AML.T0048',
    techniqueName: 'AI Agent Context Poisoning',
    tactic: 'Impact',
    url: 'https://atlas.mitre.org/techniques/AML.T0048',
  },
  REDIRECT_MANIPULATION: {
    techniqueId: 'AML.T0049',
    techniqueName: 'Thread Injection',
    tactic: 'Privilege Escalation',
    url: 'https://atlas.mitre.org/techniques/AML.T0049',
  },

  // ── LLM Prompt Injection ────────────────────────────────────────────
  // ── LLM Prompt Injection ────────────────────────────────────────────
  PROMPT_POISONING_RISK: {
    techniqueId: 'AML.T0054',
    techniqueName: 'LLM Prompt Injection',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  RESOURCE_POISONING_RISK: {
    techniqueId: 'AML.T0054.001',
    techniqueName: 'LLM Prompt Injection via Tool Output',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  TOOL_POISONING_RISK: {
    techniqueId: 'AML.T0054.001',
    techniqueName: 'LLM Prompt Injection via Tool Output',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  CONFIRMED_INJECTION: {
    techniqueId: 'AML.T0054',
    techniqueName: 'LLM Prompt Injection',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },
  SUSPECTED_INJECTION: {
    techniqueId: 'AML.T0054',
    techniqueName: 'LLM Prompt Injection',
    tactic: 'ML Attack Staging',
    url: 'https://atlas.mitre.org/techniques/AML.T0054',
  },

  // ── ML Supply Chain Compromise ──────────────────────────────────────
  RUG_PULL_DETECTED: {
    techniqueId: 'AML.T0010',
    techniqueName: 'ML Supply Chain Compromise',
    tactic: 'Persistence',
    url: 'https://atlas.mitre.org/techniques/AML.T0010',
  },
  TOOL_HASH_MISMATCH: {
    techniqueId: 'AML.T0010',
    techniqueName: 'ML Supply Chain Compromise',
    tactic: 'Persistence',
    url: 'https://atlas.mitre.org/techniques/AML.T0010',
  },

  // ── AI Agent Context Poisoning ──────────────────────────────────────
  CROSS_SERVER_MANIPULATION: {
    techniqueId: 'AML.T0048',
    techniqueName: 'AI Agent Context Poisoning',
    tactic: 'Impact',
    url: 'https://atlas.mitre.org/techniques/AML.T0048',
  },
  TOOL_SHADOWING_RISK: {
    techniqueId: 'AML.T0048',
    techniqueName: 'AI Agent Context Poisoning',
    tactic: 'Impact',
    url: 'https://atlas.mitre.org/techniques/AML.T0048',
  },
  MULTI_SERVER_COMPOUND_RISK: {
    techniqueId: 'AML.T0048',
    techniqueName: 'AI Agent Context Poisoning',
    tactic: 'Impact',
    url: 'https://atlas.mitre.org/techniques/AML.T0048',
  },
  CONSENT_BYPASS: {
    techniqueId: 'AML.T0048',
    techniqueName: 'AI Agent Context Poisoning',
    tactic: 'Impact',
    url: 'https://atlas.mitre.org/techniques/AML.T0048',
  },

  // ── Publish Poisoned Artifacts ──────────────────────────────────────
  TYPOSQUAT_RISK: {
    techniqueId: 'AML.T0019',
    techniqueName: 'Publish Poisoned Artifacts to Shared Repositories',
    tactic: 'ML Supply Chain',
    url: 'https://atlas.mitre.org/techniques/AML.T0019',
  },
  SLOPSQUATTING_RISK: {
    techniqueId: 'AML.T0019.001',
    techniqueName: 'AI-Hallucinated Package Squatting',
    tactic: 'ML Supply Chain',
    url: 'https://atlas.mitre.org/techniques/AML.T0019',
  },

  // ── Exfiltration via ML Inference API ───────────────────────────────
  HARDCODED_SECRETS: {
    techniqueId: 'AML.T0016',
    techniqueName: 'Exfiltration via ML Inference API',
    tactic: 'Exfiltration',
    url: 'https://atlas.mitre.org/techniques/AML.T0016',
  },
  ENV_VARIABLE_EXPOSURE: {
    techniqueId: 'AML.T0016',
    techniqueName: 'Exfiltration via ML Inference API',
    tactic: 'Exfiltration',
    url: 'https://atlas.mitre.org/techniques/AML.T0016',
  },
  CREDENTIAL_REFLECTION: {
    techniqueId: 'AML.T0016',
    techniqueName: 'Exfiltration via ML Inference API',
    tactic: 'Exfiltration',
    url: 'https://atlas.mitre.org/techniques/AML.T0016',
  },
  HARDCODED_CREDENTIAL_IN_ARGS: {
    techniqueId: 'AML.T0016',
    techniqueName: 'Exfiltration via ML Inference API',
    tactic: 'Exfiltration',
    url: 'https://atlas.mitre.org/techniques/AML.T0016',
  },
};

// ─── Enricher & Summary Builder ──────────────────────────────────────

export function enrichIssuesWithCompliance<T extends { type: string }>(
  items: T[],
): (T & { compliance: ComplianceRefs })[] {
  return items.map(item => ({
    ...item,
    compliance: COMPLIANCE_MAP[item.type] ?? DEFAULT,
  }));
}

export function buildComplianceSummary(
  issues: { type: string }[],
  crossServerRisks?: { type: string }[],
): ComplianceSummary {
  const seenOwaspMcp = new Set<string>();
  const seenOwaspAgentic = new Set<string>();
  const seenNsaCsi = new Set<string>();
  const seenCwe = new Set<string>();

  // MITRE ATLAS: technique ID → list of issue types that triggered it
  const mitreAtlasMap = new Map<string, { entry: MitreAtlasEntry; triggeredBy: string[] }>();

  const allItems = [
    ...issues,
    ...(crossServerRisks ?? []),
  ];

  for (const item of allItems) {
    const refs = COMPLIANCE_MAP[item.type];
    if (!refs) continue;
    for (const r of refs.owasp_mcp) seenOwaspMcp.add(r);
    for (const r of refs.owasp_agentic) seenOwaspAgentic.add(r);
    for (const r of refs.nsa_csi) seenNsaCsi.add(r);
    for (const r of refs.cwe) seenCwe.add(r);

    // Collect MITRE ATLAS techniques
    const atlasEntry = MITRE_ATLAS_MAPPINGS[item.type];
    if (atlasEntry) {
      const existing = mitreAtlasMap.get(atlasEntry.techniqueId);
      if (existing) {
        // De-duplicate: add issue type to triggered_by if not already present
        if (!existing.triggeredBy.includes(item.type)) {
          existing.triggeredBy.push(item.type);
        }
      } else {
        mitreAtlasMap.set(atlasEntry.techniqueId, {
          entry: atlasEntry,
          triggeredBy: [item.type],
        });
      }
    }
  }

  // Build the mitre_atlas array, sorted by technique ID
  const mitreAtlas = Array.from(mitreAtlasMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, { entry, triggeredBy }]) => ({
      technique_id: entry.techniqueId,
      technique_name: entry.techniqueName,
      tactic: entry.tactic,
      triggered_by: triggeredBy.sort(),
      url: entry.url,
    }));

  return {
    owasp_mcp: [...seenOwaspMcp].sort(),
    owasp_agentic: [...seenOwaspAgentic].sort(),
    nsa_csi: [...seenNsaCsi].sort(),
    cwe: [...seenCwe].sort(),
    mitre_atlas: mitreAtlas,
    mitre_atlas_techniques_matched: mitreAtlas.length,
  };
}
