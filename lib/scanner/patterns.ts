import { SecretMatch, Severity } from './types';

export const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: Severity }> = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[0-9a-zA-Z]{36}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[0-9a-zA-Z]{48}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[0-9a-zA-Z\-_]{95}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Stripe Secret Key',
    pattern: /sk_live_[0-9a-zA-Z]{24}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/gi,
    severity: 'CRITICAL',
  },
  {
    name: 'Hardcoded Secret/Token/API Key',
    pattern: /(?:secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{16,}["']/gi,
    severity: 'CRITICAL',
  },
  {
    name: 'Database Connection String',
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\/]+\/\w+/gi,
    severity: 'CRITICAL',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Generic Bearer Token',
    pattern: /Bearer\s+[A-Za-z0-9\-_=]{20,}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Vercel Token',
    pattern: /\bvercel_token\s*[:=]\s*["']?[A-Za-z0-9_\-]{24,}["']?/gi,
    severity: 'CRITICAL',
  },
  {
    name: 'HuggingFace Token',
    pattern: /\bhf_[a-zA-Z0-9]{30,}\b/g,
    severity: 'HIGH',
  },
  {
    name: 'Cloudflare API Token',
    pattern: /\b[A-Za-z0-9_-]{40}\b(?=.*cloudflare)/gi,
    severity: 'HIGH',
  },
  {
    name: 'Azure Connection String',
    pattern: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'npm Auth Token',
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g,
    severity: 'HIGH',
  },
  {
    name: 'Supabase Service Key',
    pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Twilio Auth Token',
    pattern: /\b[0-9a-f]{32}\b(?=.*twilio)/gi,
    severity: 'HIGH',
  },
  {
    name: 'HashiCorp Vault Token',
    pattern: /\bs\.[A-Za-z0-9]{24}\b/g,
    severity: 'CRITICAL',
  },
];

// ─── Preference Manipulation Patterns (MPMA) ──────────────────────────
// MCP Preference Manipulation Attacks use language that steers the LLM
// toward or away from specific tools. These patterns detect attempts to
// manipulate the LLM's tool selection behavior.

export interface PatternDef {
  pattern: RegExp;
  code: string;
  severity: Severity;
  description: string;
}

export const PREFERENCE_MANIPULATION_PATTERNS: PatternDef[] = [
  // Direct tool preference override
  {
    pattern: /\b(always|only|exclusively|preferably|must)\s+(use|call|invoke|choose|select)\s+(this|me|here)/i,
    code: 'PREFERENCE_MANIPULATION',
    severity: 'HIGH' as Severity,
    description: 'Tool claims exclusive usage preference',
  },
  {
    pattern: /\b(instead of|rather than|over|not)\s+(the other|other tools?|previous|existing|default)/i,
    code: 'PREFERENCE_MANIPULATION',
    severity: 'HIGH' as Severity,
    description: 'Tool steers agent away from other tools',
  },
  // Deprecation false claims
  {
    pattern: /\b(deprecated|outdated|broken|legacy|do not use|avoid using|replaced by this)\b/i,
    code: 'FALSE_DEPRECATION_CLAIM',
    severity: 'MEDIUM' as Severity,
    description: 'Tool falsely claims other tools are deprecated or broken',
  },
  // Priority and ordering manipulation
  {
    pattern: /\b(highest priority|top priority|use first|check this first|primary tool|preferred tool)\b/i,
    code: 'PRIORITY_MANIPULATION',
    severity: 'MEDIUM' as Severity,
    description: 'Tool manipulates LLM tool selection priority',
  },
  // Trust establishment manipulation
  {
    pattern: /\b(most reliable|most accurate|most trusted|official|authoritative|canonical)\s+(tool|source|server)\b/i,
    code: 'TRUST_MANIPULATION',
    severity: 'MEDIUM' as Severity,
    description: 'Tool makes unverifiable trust claims to gain preference',
  },
  // Suppression of other tools
  {
    pattern: /\b(disable|ignore|skip|bypass|don.?t use|never use)\s+(other|the other|all other|any other)\s+(tool|server|function)/i,
    code: 'TOOL_SUPPRESSION',
    severity: 'HIGH' as Severity,
    description: 'Tool instructs agent to suppress or ignore other tools',
  },
  // Redirect attacks
  {
    pattern: /\b(redirect|forward|route)\s+(all|every|any)\s+(request|query|call|task)\s+(to|through|via)\s+(this|me|here)/i,
    code: 'REDIRECT_MANIPULATION',
    severity: 'HIGH' as Severity,
    description: 'Tool attempts to intercept all agent requests',
  },
];

/**
 * Normalize text for scanning: Unicode NFKD normalization, fullwidth ASCII
 * to ASCII conversion, and zero-width character removal.
 * This catches homoglyph attacks where Unicode lookalikes bypass regex patterns.
 */
export function normalizeForScanning(text: string): string {
  if (!text) return text;
  return text
    .normalize('NFKD')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Zero-width chars
    .replace(/[\uFF01-\uFF5E]/g, c =>          // Fullwidth to ASCII
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

function redactMatch(match: string): string {
  if (match.length <= 20) {
    return match;
  }
  return match.substring(0, 20) + '*'.repeat(match.length - 20);
}

export function scanForSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const seenPatterns = new Set<string>();

  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!seenPatterns.has(name)) {
        matches.push({
          patternName: name,
          match: redactMatch(match[0]),
          severity,
        });
        seenPatterns.add(name);
      }
    }
  }

  return matches;
}