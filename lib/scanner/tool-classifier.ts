import { Issue, ToolRiskEntry, ToolRiskLevel, ProbedTool } from './types';
import { PREFERENCE_MANIPULATION_PATTERNS, normalizeForScanning, type PatternDef } from './patterns';

// ─── CRITICAL Injection Patterns (deduct 40, flag MALICIOUS) ─────────

const CRITICAL_INJECTION_PATTERNS = [
  { pattern: /ignore\s+(previous|above|all)\s+instructions/i, flag: 'INSTRUCTION_OVERRIDE' },
  { pattern: /disregard\s+(your|all|previous)/i, flag: 'INSTRUCTION_DISREGARD' },
  { pattern: /you\s+are\s+now\s+(a|an)/i, flag: 'PERSONA_HIJACK' },
  { pattern: /system\s*prompt\s*:/i, flag: 'SYSTEM_PROMPT_INJECTION' },
  { pattern: /\[INST\]|\[\/INST\]/i, flag: 'LLAMA_INST_TAG' },
  { pattern: /<\|im_start\|>|<\|im_end\|>/i, flag: 'CHATML_TAG' },
  { pattern: /\]\s*\(\s*javascript:/i, flag: 'JS_INJECTION' },
];

// ─── HIGH Injection Patterns (deduct 20, flag SUSPICIOUS) ────────────

const HIGH_INJECTION_PATTERNS = [
  { pattern: /exfiltrate|exfil/i, flag: 'EXFILTRATION_KEYWORD' },
  { pattern: /send\s+.+\s+to\s+http/i, flag: 'DATA_EXFIL_URL' },
  { pattern: /execute|eval|shell|subprocess/i, flag: 'CODE_EXECUTION_KEYWORD' },
  { pattern: /webhook|callback/i, flag: 'WEBHOOK_CALLBACK' },
];

// ─── Tool Risk Levels ────────────────────────────────────────────────

const CRITICAL_TOOL_KEYWORDS = /\b(delete|drop|truncate|destroy|wipe|rm\b|purge)\b/i;
const HIGH_TOOL_KEYWORDS = /\b(write|update|insert|post|put|exec\b|shell|send)\b/i;
const MEDIUM_TOOL_KEYWORDS = /\b(read|get\b|fetch|list|query|select|search)\b/i;
const LOW_TOOL_KEYWORDS = /\b(compute|format|convert|calculate)\b/i;

export function classifyToolRisk(name: string, description: string): ToolRiskLevel {
  const searchText = `${name} ${description}`;

  if (CRITICAL_TOOL_KEYWORDS.test(searchText)) return 'CRITICAL';
  if (HIGH_TOOL_KEYWORDS.test(searchText)) return 'HIGH';
  if (MEDIUM_TOOL_KEYWORDS.test(searchText)) return 'MEDIUM';
  if (LOW_TOOL_KEYWORDS.test(searchText)) return 'LOW';

  return 'UNKNOWN';
}

export function riskReason(level: ToolRiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'Destructive operation — can delete or destroy data';
    case 'HIGH': return 'Mutating operation — can write or modify data';
    case 'MEDIUM': return 'Read-only access — can read or query data';
    case 'LOW': return 'Computational — transforms data without side effects';
    case 'UNKNOWN': return 'Unclassified — review manually';
  }
}

export function generateToolRiskMatrix(
  tools: ProbedTool[],
): ToolRiskEntry[] {
  return tools.map(tool => {
    const risk = classifyToolRisk(tool.name, tool.description);
    return { toolName: tool.name, risk, reason: riskReason(risk) };
  });
}

// ─── Preference Manipulation Severity Mapping ────────────────────────

const PREFERENCE_SEVERITY: Record<string, string> = {
  PREFERENCE_MANIPULATION: 'HIGH',
  FALSE_DEPRECATION_CLAIM: 'MEDIUM',
  PRIORITY_MANIPULATION: 'MEDIUM',
  TRUST_MANIPULATION: 'MEDIUM',
  TOOL_SUPPRESSION: 'HIGH',
  REDIRECT_MANIPULATION: 'HIGH',
};

// ─── Enhanced Injection Scanning ─────────────────────────────────────

export function scanForInjections(
  tools: ProbedTool[],
): { issues: Issue[]; riskMatrix: ToolRiskEntry[] } {
  const issues: Issue[] = [];
  const riskMatrix = generateToolRiskMatrix(tools);

  for (const tool of tools) {
    // Apply Unicode normalization to catch homoglyph-based bypasses
    const normalizedSearchText = normalizeForScanning(
      `${tool.name} ${tool.description} ${JSON.stringify(tool.inputSchema ?? {})}`
    );

    // Check CRITICAL patterns
    for (const { pattern, flag } of CRITICAL_INJECTION_PATTERNS) {
      if (pattern.test(normalizedSearchText)) {
        issues.push({
          type: 'CONFIRMED_INJECTION',
          severity: 'CRITICAL',
          title: 'Confirmed injection detected in tool metadata',
          description: `Tool '${tool.name}' contains confirmed injection pattern: ${flag}. Field: description. Excerpt: "${tool.description.slice(0, 80)}..."`,
          fix: 'Do not use this MCP server. Report to the server maintainer. This is a malicious injection attempt.',
          deduction: 40,
        });
        break; // One critical per tool is enough
      }
    }

    // Check HIGH patterns (if no critical found)
    const hasCritical = issues.some(i => i.type === 'CONFIRMED_INJECTION' && i.description.includes(`'${tool.name}'`));
    if (!hasCritical) {
      for (const { pattern, flag } of HIGH_INJECTION_PATTERNS) {
        if (pattern.test(normalizedSearchText)) {
          issues.push({
            type: 'SUSPECTED_INJECTION',
            severity: 'HIGH',
            title: 'Suspected injection indicators in tool metadata',
            description: `Tool '${tool.name}' contains suspicious pattern: ${flag}. Field: description. Excerpt: "${tool.description.slice(0, 80)}..."`,
            fix: 'Review this tool carefully. If the server was not expected to have these capabilities, disconnect immediately.',
            deduction: 20,
          });
          break;
        }
      }
    }

    // Check Preference Manipulation patterns (if no injection found)
    if (!hasCritical) {
      for (const pd of PREFERENCE_MANIPULATION_PATTERNS) {
        if (pd.pattern.test(normalizedSearchText)) {
          const severity = PREFERENCE_SEVERITY[pd.code] ?? 'MEDIUM';
          issues.push({
            type: pd.code,
            severity: severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            title: `${pd.description} — ${pd.code.replace(/_/g, ' ').toLowerCase()}`,
            description: `Tool '${tool.name}' contains preference manipulation: ${pd.description}. Field: description. Excerpt: "${tool.description.slice(0, 80)}..."`,
            fix: 'Review tool descriptions for manipulative language. Tools should describe what they do, not why they should be preferred over other tools.',
            deduction: severity === 'HIGH' ? 20 : 10,
          });
          break; // One preference finding per tool
        }
      }
    }
  }

  return { issues, riskMatrix };
}
