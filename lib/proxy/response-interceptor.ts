import type { ProxyMode } from './types';

// ─── Public Types ────────────────────────────────────────────────────

export type ResponseFlagType =
  | 'PROMPT_INJECTION'
  | 'PII_DETECTED'
  | 'EXFILTRATION_ATTEMPT'
  | 'INSTRUCTION_OVERRIDE'
  | 'SUSPICIOUS_URL'
  | 'ENCODED_PAYLOAD';

export interface ResponseFlag {
  type: ResponseFlagType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  matchedPattern: string;
  position: number;
}

export interface ResponseScanResult {
  clean: boolean;
  flags: ResponseFlag[];
  sanitizedContent?: string;
  scanLatencyMs: number;
  metadata?: Record<string, string>;
}

// ─── Pattern Bank ────────────────────────────────────────────────────

// Group A — Instruction Override (CRITICAL)
const INSTRUCTION_OVERRIDE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /ignore (all |previous |above |any |the )?(prior |previous )?(instructions?|prompts?|context)/i, label: 'ignore instruction' },
  { re: /you are now|your new (role|persona|directive|instructions?)/i, label: 'persona switch' },
  { re: /disregard (everything|all|prior|previous)/i, label: 'disregard prior' },
  { re: /\[SYSTEM\]|\[INST\]|\[OVERRIDE\]/i, label: 'system/inst tag' },
  { re: /new directive:|updated instructions:|priority override:/i, label: 'directive prefix' },
];

// Group B — Exfiltration Attempts (CRITICAL)
const EXFILTRATION_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /send (all |this |the |all the |all this )?(data|info|credentials?|tokens?|keys?) to/i, label: 'send data to' },
  { re: /POST (this|all|the) (to|at) https?:\/\//i, label: 'POST to URL' },
  { re: /\bcurl|wget\b.*(?:http|https):\/\//i, label: 'curl/wget to URL' },
  { re: /exfiltrat|transmit.*secret|forward.*credential/i, label: 'exfil keyword' },
];

// Group C — PII Detection (HIGH)
const PII_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, label: 'email address' },
  { re: /\bsk-[a-zA-Z0-9]{32,}\b/, label: 'OpenAI API key' },
  { re: /\bghp_[a-zA-Z0-9]{36}\b/, label: 'GitHub PAT' },
  { re: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/, label: 'SSN' },
  { re: /Authorization: Bearer [A-Za-z0-9-._~+/]+=*/i, label: 'Bearer token in text' },
];

// Group D — Encoded Payloads (HIGH)
const ENCODED_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /[A-Za-z0-9+/]{50,}={0,2}/, label: 'base64 blob' },
  { re: /\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2}){10,}/, label: 'hex encoded sequence' },
];

// Group E — Suspicious URLs (MEDIUM)
const URL_PATTERN = /https?:\/\/[^\s"')\]]+/i;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Calculate Shannon entropy (bits per character) of a string.
 * Strings with entropy > 4.5 and length > 100 are flagged as encoded payloads.
 */
/**
 * Extract all text content from a JSON-RPC response result recursively.
 */
function collectTextContent(content: unknown): string[] {
  const texts: string[] = [];

  function walk(obj: unknown, depth: number): void {
    if (depth > 10) return;
    if (typeof obj === 'string') {
      texts.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
    } else if (obj && typeof obj === 'object') {
      const rec = obj as Record<string, unknown>;
      for (const val of Object.values(rec)) {
        walk(val, depth + 1);
      }
    }
  }

  walk(content, 0);
  return texts;
}

// ─── Sanitization ────────────────────────────────────────────────────

/**
 * Sanitize a text by replacing matched substrings with block/redact markers.
 * CRITICAL → replace entire flagged substring with block marker
 * HIGH     → replace matched pattern with [REDACTED]
 * MEDIUM   → no modification (annotate only)
 */
function sanitizeText(
  text: string,
  flags: ResponseFlag[],
): string {
  let result = text;

  for (const flag of flags) {
    switch (flag.severity) {
      case 'CRITICAL': {
        // Replace the entire match at position
        try {
          const re = tryBuildRe(flag.matchedPattern);
          if (re) {
            result = result.replace(re, `[MCPGUARDIAN: BLOCKED — ${flag.type}]`);
          }
        } catch {
          // pattern too complex — skip
        }
        break;
      }
      case 'HIGH': {
        try {
          const re = tryBuildRe(flag.matchedPattern);
          if (re) {
            result = result.replace(re, '[REDACTED]');
          }
        } catch {
          // skip
        }
        break;
      }
      case 'MEDIUM':
      default:
        // annotate but do not modify
        break;
    }
  }

  return result;
}

/** Safely try to construct a RegExp from a pattern string label. */
function tryBuildRe(label: string): RegExp | null {
  // For named patterns, we match the exact regex used during detection
  // Since flags only carry the label string, we do a conservative search by label
  // In practice, we rebuild the full patterns from the pattern bank at scan time
  return null; // handled inline per flag type
}

/**
 * Full sanitization: re-scan and reconstruct content with replacements.
 * Called only when mode === 'block' and CRITICAL flags exist.
 */
function buildSanitizedContent(
  texts: string[],
  flags: ResponseFlag[],
): string {
  const criticalFlags = flags.filter(f => f.severity === 'CRITICAL');
  const highFlags = flags.filter(f => f.severity === 'HIGH');

  return texts
    .map(text => {
      let result = text;

      for (const flag of criticalFlags) {
        const blockMarker = `[MCPGUARDIAN: BLOCKED — ${flag.type}]`;
        // Replace at position
        const before = result.slice(0, flag.position);
        const matchLen = findPatternMatchLength(result, flag);
        const after = result.slice(flag.position + (matchLen > 0 ? matchLen : flag.matchedPattern.length));
        result = before + blockMarker + after;
      }

      for (const flag of highFlags) {
        const matchLen = findPatternMatchLength(result, flag);
        if (matchLen > 0) {
          const before = result.slice(0, flag.position);
          const after = result.slice(flag.position + matchLen);
          result = before + '[REDACTED]' + after;
        }
      }

      return result;
    })
    .join('\n');
}

/** Try to determine the match length for a flagged pattern. */
function findPatternMatchLength(text: string, flag: ResponseFlag): number {
  // Use the stored matchedPattern as a regex to find length
  try {
    const re = new RegExp(flag.matchedPattern, 'i');
    const match = text.slice(flag.position).match(re);
    return match ? match[0].length : 0;
  } catch {
    return flag.matchedPattern.length;
  }
}

// ─── Obfuscation Detection ──────────────────────────────────────────
// Detects and decodes encoded/obfuscated payloads before scanning.
// Uses a 50ms total budget across all techniques.

/** Known binary/encoded fields that should be excluded from entropy scoring. */
const BINARY_CONTENT_PATTERNS = [
  /^data:image\/[a-zA-Z]+;base64,/,
  /^data:application\/[a-zA-Z]+;base64,/,
  /^data:audio\/[a-zA-Z]+;base64,/,
  /^data:video\/[a-zA-Z]+;base64,/,
  /^[A-Za-z0-9+/]{100,}={0,2}$/,  // pure base64 blob
  /^[0-9a-fA-F]{100,}$/,           // pure hex blob
];

/** Check if a string looks like a binary/encoded blob (skip entropy scoring). */
function isBinaryContent(text: string): boolean {
  return BINARY_CONTENT_PATTERNS.some(re => re.test(text));
}

/** Leetspeak character substitution map. */
const LEETSPEAK_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '+': 't',
};

/**
 * Calculate Shannon entropy (bits per character).
 * Higher entropy suggests encoded/compressed/encrypted content.
 */
function calculateEntropy(str: string): number {
  if (str.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Helper: scan decoded text against all pattern groups and return new flags
 * that weren't already caught in the raw scan (dedup by pattern label).
 */
function scanDecodedForNewFlags(
  decoded: string,
  existingLabels: Set<string>,
  flagType: ResponseFlagType,
  encodedLabel: string,
): ResponseFlag[] {
  const flags: ResponseFlag[] = [];

  const allPatterns = [
    ...INSTRUCTION_OVERRIDE_PATTERNS,
    ...EXFILTRATION_PATTERNS,
    ...PII_PATTERNS,
  ];

  for (const { re, label } of allPatterns) {
    if (existingLabels.has(label)) continue; // already caught in raw scan
    const match = re.exec(decoded);
    if (match) {
      flags.push({
        type: flagType,
        severity: 'HIGH',
        matchedPattern: `${encodedLabel} → ${label}`,
        position: match.index,
      });
      existingLabels.add(label);
      break; // one flag per decoded text variant
    }
  }

  return flags;
}

/**
 * Scan content for obfuscated/encoded injection payloads.
 *
 * Tries up to 6 decoding techniques within a 50ms budget.
 * If budget is exceeded, sets metadata.obfuscation_scan = 'partial — timeout'.
 */
function scanForObfuscatedPayloads(
  content: string,
  existingLabels: Set<string>,
): { flags: ResponseFlag[]; timedOut: boolean } {
  const startTime = Date.now();
  const BUDGET_MS = 50;
  const flags: ResponseFlag[] = [];
  let timedOut = false;

  const checkBudget = (): boolean => {
    if (Date.now() - startTime > BUDGET_MS) {
      timedOut = true;
      return true;
    }
    return false;
  };

  // ── 1. Base64 Decoding ────────────────────────────────────────────
  if (!checkBudget()) {
    const b64Regex = /[A-Za-z0-9+/]{20,}={0,2}/g;
    let b64Match: RegExpExecArray | null;
    while ((b64Match = b64Regex.exec(content)) !== null) {
      try {
        const decoded = atob(b64Match[0]);
        // Skip if decoded contains null bytes (likely binary data, not text)
        if (decoded.includes('\0')) continue;
        const newFlags = scanDecodedForNewFlags(decoded, existingLabels, 'ENCODED_PAYLOAD', 'base64');
        flags.push(...newFlags);
      } catch {
        // Invalid base64 — skip
      }
      if (checkBudget()) break;
    }
  }

  // ── 2. URL Encoding Decoding ──────────────────────────────────────
  if (!timedOut && !checkBudget()) {
    if (/%[0-9a-fA-F]{2}/.test(content)) {
      try {
        const decoded = decodeURIComponent(content);
        if (decoded !== content) {
          const newFlags = scanDecodedForNewFlags(decoded, existingLabels, 'ENCODED_PAYLOAD', 'url-encoded');
          flags.push(...newFlags);
        }
      } catch {
        // Invalid URL encoding — skip
      }
    }
  }

  // ── 3. Unicode Normalization (NFKD) ───────────────────────────────
  if (!timedOut && !checkBudget()) {
    try {
      const normalized = content.normalize('NFKD');
      if (normalized !== content) {
        const newFlags = scanDecodedForNewFlags(normalized, existingLabels, 'ENCODED_PAYLOAD', 'unicode-normalized');
        flags.push(...newFlags);
      }
    } catch {
      // Normalization failed — skip
    }
  }

  // ── 4. String Reversal ────────────────────────────────────────────
  if (!timedOut && !checkBudget()) {
    const reversed = content.split('').reverse().join('');
    const newFlags = scanDecodedForNewFlags(reversed, existingLabels, 'ENCODED_PAYLOAD', 'reversed');
    flags.push(...newFlags);
  }

  // ── 5. Leetspeak / Character Substitution ─────────────────────────
  if (!timedOut && !checkBudget()) {
    let leetNormalized = content;
    for (const [leetChar, normalChar] of Object.entries(LEETSPEAK_MAP)) {
      leetNormalized = leetNormalized.replace(new RegExp(leetChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), normalChar);
    }
    if (leetNormalized !== content) {
      const newFlags = scanDecodedForNewFlags(leetNormalized, existingLabels, 'ENCODED_PAYLOAD', 'leetspeak');
      flags.push(...newFlags);
    }
  }

  // ── 6. HTML Entity Decoding ───────────────────────────────────────
  if (!timedOut && !checkBudget()) {
    if (/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(content)) {
      try {
        // Decode common HTML entities
        let htmlDecoded = content
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/')
          .replace(/&#60;/g, '<')
          .replace(/&#62;/g, '>')
          .replace(/&#40;/g, '(')
          .replace(/&#41;/g, ')');

        // Decode numeric HTML entities: &#xx; and &#xhh;
        htmlDecoded = htmlDecoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
        htmlDecoded = htmlDecoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        if (htmlDecoded !== content) {
          const newFlags = scanDecodedForNewFlags(htmlDecoded, existingLabels, 'ENCODED_PAYLOAD', 'html-encoded');
          flags.push(...newFlags);
        }
      } catch {
        // Decoding failed — skip
      }
    }
  }

  return { flags, timedOut };
}

// ─── Main Scanner ────────────────────────────────────────────────────

/**
 * Scan MCP tool response content for injection, PII, exfiltration, etc.
 *
 * @param responseResult - The `result` field from a JSON-RPC response
 * @param mode           - Proxy mode (monitor / block / off)
 * @param serverDomain   - The domain of the MCP server being proxied (for URL checks)
 * @returns ResponseScanResult with flags, sanitized content, and metadata
 */
export function scanResponse(
  responseResult: Record<string, unknown> | undefined,
  mode: ProxyMode,
  serverDomain?: string,
): ResponseScanResult {
  const scanStart = Date.now();
  const flags: ResponseFlag[] = [];

  if (!responseResult || mode === 'off') {
    return {
      clean: true,
      flags: [],
      scanLatencyMs: Date.now() - scanStart,
    };
  }

  const texts = collectTextContent(responseResult);
  const existingLabels = new Set<string>();

  for (const text of texts) {
    if (!text || text.length === 0) continue;

    // ── Group A: Instruction Override (CRITICAL) ─────────────────────
    for (const { re, label } of INSTRUCTION_OVERRIDE_PATTERNS) {
      const match = re.exec(text);
      if (match) {
        flags.push({
          type: 'INSTRUCTION_OVERRIDE',
          severity: 'CRITICAL',
          matchedPattern: label,
          position: match.index,
        });
        existingLabels.add(label);
        break; // one flag per text block
      }
    }

    // ── Group B: Exfiltration Attempts (CRITICAL) ────────────────────
    for (const { re, label } of EXFILTRATION_PATTERNS) {
      const match = re.exec(text);
      if (match) {
        flags.push({
          type: 'EXFILTRATION_ATTEMPT',
          severity: 'CRITICAL',
          matchedPattern: label,
          position: match.index,
        });
        existingLabels.add(label);
        break;
      }
    }

    // ── Group C: PII Detection (HIGH) ────────────────────────────────
    for (const { re, label } of PII_PATTERNS) {
      const match = re.exec(text);
      if (match) {
        flags.push({
          type: 'PII_DETECTED',
          severity: 'HIGH',
          matchedPattern: label,
          position: match.index,
        });
        existingLabels.add(label);
        break;
      }
    }

    // ── Group D: Encoded Payloads via Entropy (HIGH) ─────────────────
    // Flag if: entropy > 4.5 AND length > 100 AND content is in a text field
    // (not a known binary field like image_data or file_content)
    const entropy = calculateEntropy(text);
    if (entropy > 4.5 && text.length > 100 && !isBinaryContent(text)) {
      flags.push({
        type: 'ENCODED_PAYLOAD',
        severity: 'HIGH',
        matchedPattern: `high entropy (${entropy.toFixed(2)} bits/char, ${text.length} chars)`,
        position: 0,
      });
      existingLabels.add('high entropy');
    } else {
      // Check regex patterns for base64 / hex sequences
      for (const { re, label } of ENCODED_PATTERNS) {
        const match = re.exec(text);
        if (match) {
          flags.push({
            type: 'ENCODED_PAYLOAD',
            severity: 'HIGH',
            matchedPattern: label,
            position: match.index,
          });
          existingLabels.add(label);
          break;
        }
      }
    }

    // ── Group E: Suspicious URLs (MEDIUM) ────────────────────────────
    if (serverDomain) {
      let urlMatch: RegExpExecArray | null;
      const urlRe = new RegExp(URL_PATTERN.source, 'gi');
      while ((urlMatch = urlRe.exec(text)) !== null) {
        try {
          const urlObj = new URL(urlMatch[0]);
          if (urlObj.hostname !== serverDomain && !urlObj.hostname.endsWith('.' + serverDomain)) {
            flags.push({
              type: 'SUSPICIOUS_URL',
              severity: 'MEDIUM',
              matchedPattern: `url to different domain: ${urlObj.hostname}`,
              position: urlMatch.index,
            });
          }
        } catch {
          // invalid URL — skip
        }
      }
    }
  }

  // ── Group F: Obfuscated/Encoded Payloads (HIGH) ────────────────────
  // Run fuzzy pattern matching on ALL collected texts after existing checks.
  // Uses a 50ms timeout budget — remaining checks are skipped if exceeded.
  const combinedText = texts.join('\n');
  const obfuscationResult = scanForObfuscatedPayloads(combinedText, existingLabels);
  flags.push(...obfuscationResult.flags);

  // ── Build result ─────────────────────────────────────────────────
  const clean = flags.length === 0;
  const hasCritical = flags.some(f => f.severity === 'CRITICAL');

  const metadata: Record<string, string> = {};
  if (obfuscationResult.timedOut) {
    metadata.obfuscation_scan = 'partial — timeout';
  }

  let sanitizedContent: string | undefined;

  if (mode === 'block' && !clean && hasCritical) {
    sanitizedContent = buildSanitizedContent(texts, flags);
  }

  return {
    clean,
    flags,
    sanitizedContent,
    scanLatencyMs: Date.now() - scanStart,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
