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
];

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