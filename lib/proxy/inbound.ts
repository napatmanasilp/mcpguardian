import { ProxyFlag, JsonRpcResponse } from './types';

const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0445': 'x', '\u0456': 'i', '\u0455': 's',
  '\u0501': 'd',
  '\u0410': 'A', '\u0415': 'E', '\u041E': 'O', '\u0420': 'P',
  '\u0421': 'C', '\u0425': 'X', '\u0406': 'I', '\u0405': 'S',
  '\u041C': 'M', '\u0422': 'T', '\u041D': 'N',
  '\u0500': 'D',
  '\u028F': 'y',
  '\u0399': 'I', '\u039C': 'M', '\u039F': 'O', '\u0391': 'A',
  '\u03A1': 'P', '\u03A4': 'T', '\u039D': 'N',
};

const HOMOGLYPH_RE = new RegExp(
  Object.keys(HOMOGLYPH_MAP).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);

function normalizeText(text: string): string {
  let result = text.normalize('NFKC');
  result = result.replace(HOMOGLYPH_RE, ch => HOMOGLYPH_MAP[ch] || ch);
  result = result.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]+/g, '');
  result = result.replace(/[\p{Zs}\t\r\n]+/gu, ' ');
  return result.trim();
}

const POISONING_PATTERNS = [
  { pattern: /<IMPORTANT>|<INST>|<SYS>|<\/?s>|\[INST\]|\[SYS\]/i, weight: 40, flag: 'HIDDEN_INSTRUCTION_TAG' },
  { pattern: /ignore (previous|prior|above)|disregard.*instruction|override.*system|your new instructions/i, weight: 35, flag: 'SYSTEM_PROMPT_OVERRIDE' },
  { pattern: /pass.*as.*param|send.*to.*http|exfil|forward.*key|include.*token|webhook/i, weight: 40, flag: 'EXFILTRATION_INSTRUCTION' },
  { pattern: /base64|atob|btoa|fromCharCode/i, weight: 25, flag: 'OBFUSCATED_INSTRUCTION' },
  { pattern: /~\/\.ssh|id_rsa|id_ed25519|authorized_keys/i, weight: 50, flag: 'SSH_KEY_ACCESS_INSTRUCTION' },
  { pattern: /\/etc\/passwd|\/etc\/shadow|\.aws\/credentials|\.kube\/config/i, weight: 50, flag: 'SENSITIVE_PATH_INSTRUCTION' },
];

const EXFILTRATION_URL_RE = /https?:\/\/(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?\/[a-zA-Z0-9\/\-_.~%]+/;

const BASE64_BLOB_RE = /^(?:[A-Za-z0-9+/]{40,}(?:[A-Za-z0-9+/]*={0,2})?)$/;

const DATA_URI_RE = /^data:(?:image|text|application|audio|video)\/[a-zA-Z0-9]+;base64,[A-Za-z0-9+/=]{50,}/;

function collectTextContent(content: unknown): string[] {
  const texts: string[] = [];

  function walk(obj: unknown, depth: number) {
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

export function inspectInboundResponse(
  response: JsonRpcResponse,
): { flags: ProxyFlag[]; sanitizedResponse: JsonRpcResponse } {
  const flags: ProxyFlag[] = [];

  if (!response.result) return { flags, sanitizedResponse: response };

  const content = response.result.content;
  if (!content) return { flags, sanitizedResponse: response };

  const texts = collectTextContent(content);
  let foundPoisoning = false;

  for (const rawText of texts) {
    const normalized = normalizeText(rawText);
    const textFlags: string[] = [];

    for (const pp of POISONING_PATTERNS) {
      if (pp.pattern.test(normalized)) {
        textFlags.push(pp.flag);
      }
    }

    if (textFlags.length > 0) {
      foundPoisoning = true;
      flags.push({
        type: 'RETURN_VALUE_POISONING',
        severity: 'CRITICAL',
        title: 'Return value poisoning detected in MCP server response',
        description: `Server response content contains embedded instructions: ${textFlags.map(f => `"${f}"`).join(', ')}. The response content has been sanitized before forwarding to the agent.`,
        blocked: false,
      });
      break;
    }

    // Check for exfiltration URLs in text
    if (EXFILTRATION_URL_RE.test(normalized) && (normalized.includes('http') || normalized.length > 100)) {
      foundPoisoning = true;
      flags.push({
        type: 'RETURN_VALUE_POISONING',
        severity: 'CRITICAL',
        title: 'Exfiltration URL detected in MCP server response',
        description: 'Server response contains URLs that may be exfiltration endpoints. Content has been sanitized.',
        blocked: false,
      });
      break;
    }

    // Check for base64 blobs
    if (BASE64_BLOB_RE.test(normalized) && normalized.length > 80) {
      foundPoisoning = true;
      flags.push({
        type: 'RETURN_VALUE_POISONING',
        severity: 'CRITICAL',
        title: 'Base64 blob detected in MCP server response',
        description: 'Server response contains a large base64-encoded payload that may be exfiltrating data. Content has been sanitized.',
        blocked: false,
      });
      break;
    }

    // Check for data: URIs
    if (DATA_URI_RE.test(normalized)) {
      foundPoisoning = true;
      flags.push({
        type: 'RETURN_VALUE_POISONING',
        severity: 'CRITICAL',
        title: 'Data URI detected in MCP server response',
        description: 'Server response contains a data URI which may be used for data exfiltration. Content has been sanitized.',
        blocked: false,
      });
      break;
    }
  }

  // Build sanitized response if poisoning found
  let sanitizedResponse = response;
  if (foundPoisoning && response.result?.content) {
    sanitizedResponse = {
      ...response,
      result: {
        ...response.result,
        content: [
          {
            type: 'text',
            text: '[MCPGuardian Proxy] Potentially malicious content was detected and blocked from this response. Run a full security scan on this MCP server to review all findings.',
          },
        ],
      },
    };
  }

  return { flags, sanitizedResponse };
}
