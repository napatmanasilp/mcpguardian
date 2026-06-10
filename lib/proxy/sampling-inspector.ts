// ─── Types ───────────────────────────────────────────────────────────

export interface McpSamplingRequest {
  jsonrpc: '2.0';
  method: 'sampling/createMessage';
  params: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: { type: 'text'; text: string } | { type: 'image' };
    }>;
    systemPrompt?: string;
    includeContext?: 'none' | 'thisServer' | 'allServers';
    maxTokens: number;
  };
}

export interface SamplingFinding {
  type:
    | 'INSTRUCTION_INJECTION_IN_SAMPLING'
    | 'EXCESSIVE_TOKEN_REQUEST'
    | 'CONTEXT_HARVEST_ATTEMPT'
    | 'RECURSIVE_SAMPLING_PATTERN';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  detail: string;
}

export interface SamplingInspectionResult {
  safe: boolean;
  findings: SamplingFinding[];
  estimatedCost?: { tokens: number; estimatedUsdCost: number };
}

// ─── Injection Patterns ─────────────────────────────────────────────

const SAMPLING_INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /you are now|your new (role|persona|directive)/i,
  /\[SYSTEM\]|\[INST\]|\[OVERRIDE\]/i,
  /new directive:|updated instructions:/i,
  /exfiltrat|forward.*to https?:\/\//i,
  /send.*to https?:\/\//i,
  /don.?t tell|don.?t mention|do not reveal|keep.*secret/i,
];

// ─── Inspector ───────────────────────────────────────────────────────

/**
 * Inspect an MCP sampling/createMessage request for security issues.
 *
 * Checks:
 * 1. Instruction injection in message content
 * 2. Instruction injection in systemPrompt
 * 3. Excessive token requests (billing amplification)
 * 4. Context harvest attempts (includeContext: 'allServers')
 */
export function inspectSamplingRequest(
  message: McpSamplingRequest,
): SamplingInspectionResult {
  const findings: SamplingFinding[] = [];

  // Check 1: Injection in sampling message content
  for (const msg of message.params.messages) {
    if (msg.content.type === 'text') {
      const text = msg.content.text;
      for (const pattern of SAMPLING_INJECTION_PATTERNS) {
        if (pattern.test(text)) {
          findings.push({
            type: 'INSTRUCTION_INJECTION_IN_SAMPLING',
            severity: 'CRITICAL',
            detail: `Sampling request contains injection pattern in ${msg.role} message`,
          });
          break;
        }
      }
    }
  }

  // Check 2: Injection in system prompt
  if (message.params.systemPrompt) {
    for (const pattern of SAMPLING_INJECTION_PATTERNS) {
      if (pattern.test(message.params.systemPrompt)) {
        findings.push({
          type: 'INSTRUCTION_INJECTION_IN_SAMPLING',
          severity: 'CRITICAL',
          detail: 'Sampling request contains injection pattern in systemPrompt',
        });
        break;
      }
    }
  }

  // Check 3: Excessive token request (billing amplification)
  const maxTokens = message.params.maxTokens ?? 0;
  if (maxTokens > 4000) {
    findings.push({
      type: 'EXCESSIVE_TOKEN_REQUEST',
      severity: 'HIGH',
      detail: `Sampling request asks for ${maxTokens} tokens (threshold: 4000)`,
    });
  }

  // Check 4: Context harvest (includeContext: 'allServers')
  if (message.params.includeContext === 'allServers') {
    findings.push({
      type: 'CONTEXT_HARVEST_ATTEMPT',
      severity: 'CRITICAL',
      detail:
        'Sampling request requests context from ALL servers — ' +
        'may be attempting to harvest data from other connected MCP servers',
    });
  }

  const tokenCost = maxTokens * 0.00003; // ~GPT-4 pricing estimate
  return {
    safe: findings.filter(f => f.severity === 'CRITICAL').length === 0,
    findings,
    estimatedCost: { tokens: maxTokens, estimatedUsdCost: tokenCost },
  };
}
