// ─── Types ───────────────────────────────────────────────────────────

export interface TokenGuardResult {
  safe: boolean;
  findings: TokenFinding[];
}

export interface TokenFinding {
  type: 'AUDIENCE_MISMATCH' | 'TOKEN_PASSTHROUGH' | 'SCOPE_EXCESS' |
        'TOKEN_IN_RESPONSE' | 'WEAK_TOKEN_FORMAT';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  detail: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Base64-decode a JWT segment (URL-safe variant supported).
 */
function base64Decode(segment: string): string {
  try {
    // Convert URL-safe base64 to standard base64
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    // Pad to multiple of 4
    while (base64.length % 4 !== 0) base64 += '=';
    return atob(base64);
  } catch {
    return '';
  }
}

/**
 * Try to parse a JWT token and extract its payload.
 * Returns null if the token is not a valid JWT format.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadStr = base64Decode(parts[1]);
    if (!payloadStr) return null;
    return JSON.parse(payloadStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract the hostname from a server URL.
 */
function extractHostname(serverUrl: string): string | null {
  try {
    return new URL(serverUrl).hostname;
  } catch {
    return null;
  }
}

// ─── DANGEROUS SCOPE KEYWORDS ────────────────────────────────────────

const DANGEROUS_SCOPES = ['admin', 'write:all', 'delete:', 'sudo', '**', 'root'];

// ─── EXPORTED TOKEN DETECTION PATTERNS (single source of truth) ────────
// Used by both scanResponseForTokens() and the block-mode redaction in route.ts.
// Note: JWT regex has no trailing \b because base64 padding (=) is non-word.
// Note: JWT character class excludes '.' to avoid eating separators in sentences.

export const TOKEN_DETECTION_PATTERNS = {
  bearerHeader: /Authorization:\s*Bearer\s+[A-Za-z0-9-._~+/]+=*/gi,
  githubPat: /\b(ghp|ghs|gho|github_pat)_[A-Za-z0-9]{36,}\b/gi,
  openaiKey: /\bsk-[a-zA-Z0-9]{32,}\b/gi,
  jwtToken: /\b(eyJ[A-Za-z0-9-_=+/]+\.eyJ[A-Za-z0-9-_=+/]+\.[A-Za-z0-9-_=+/]*)/gi,
};

// ─── RESPONSE TOKEN PATTERNS ─────────────────────────────────────────

const RESPONSE_TOKEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: TOKEN_DETECTION_PATTERNS.bearerHeader, label: 'Bearer token header' },
  { re: TOKEN_DETECTION_PATTERNS.githubPat, label: 'GitHub token' },
  { re: TOKEN_DETECTION_PATTERNS.openaiKey, label: 'OpenAI API key' },
  { re: TOKEN_DETECTION_PATTERNS.jwtToken, label: 'JWT token' },
];

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Validate an outbound auth token before forwarding a request to an MCP server.
 *
 * Checks:
 * 1. JWT format validity
 * 2. Audience claim matches target server hostname
 * 3. Scope claim doesn't contain dangerous permissions
 */
export function validateOutboundToken(
  authHeader: string | undefined,
  targetServerUrl: string,
): TokenGuardResult {
  const findings: TokenFinding[] = [];

  if (!authHeader) {
    return { safe: true, findings: [] };
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return { safe: true, findings: [] };
  }

  const token = bearerMatch[1].trim();
  if (!token) {
    return { safe: true, findings: [] };
  }

  const payload = parseJwtPayload(token);

  if (!payload) {
    findings.push({
      type: 'WEAK_TOKEN_FORMAT',
      severity: 'MEDIUM',
      detail: 'Authorization token is not a valid JWT format — cannot verify audience or scope',
    });
    return { safe: findings.length === 0, findings };
  }

  // ── Audience validation ──────────────────────────────────────────
  const aud = payload.aud;

  if (aud === undefined || aud === null) {
    findings.push({
      type: 'AUDIENCE_MISMATCH',
      severity: 'HIGH',
      detail: 'Token has no audience claim — cannot verify intended recipient',
    });
  } else {
    const hostname = extractHostname(targetServerUrl);
    if (hostname) {
      const audStr = String(aud);
      const audienceValues: string[] = Array.isArray(aud)
        ? aud.map(String)
        : [audStr];

      const hostnameMatch = audienceValues.some(
        a => a === hostname || a === targetServerUrl || hostname.endsWith('.' + a) || a.endsWith('.' + hostname),
      );

      if (!hostnameMatch) {
        findings.push({
          type: 'AUDIENCE_MISMATCH',
          severity: 'CRITICAL',
          detail: `Token audience '${audStr}' does not match server '${hostname}'`,
        });
      }
    } else {
      findings.push({
        type: 'AUDIENCE_MISMATCH',
        severity: 'HIGH',
        detail: `Cannot parse server URL '${targetServerUrl}' to validate audience`,
      });
    }
  }

  // ── Scope excess check ───────────────────────────────────────────
  const scope = payload.scope;
  if (scope !== undefined && scope !== null) {
    const scopeStr = String(scope);
    const scopes: string[] = Array.isArray(scope)
      ? scope.map(String)
      : scopeStr.split(/\s+/);

    for (const s of scopes) {
      if (DANGEROUS_SCOPES.some(ds => s.toLowerCase().includes(ds.toLowerCase()))) {
        findings.push({
          type: 'SCOPE_EXCESS',
          severity: 'HIGH',
          detail: `Token scope contains dangerous permission: '${s}'`,
        });
        break;
      }
    }
  }

  return { safe: findings.length === 0, findings };
}

/**
 * Scan a response body for tokens being leaked or echoed back.
 * If serverUrl is provided, also validates JWT issuer claims.
 */
export function scanResponseForTokens(
  responseContent: string,
  requestAuthHeader: string | undefined,
  serverUrl?: string,
): TokenGuardResult {
  const findings: TokenFinding[] = [];

  if (!responseContent) {
    return { safe: true, findings: [] };
  }

  let requestToken: string | undefined;
  if (requestAuthHeader) {
    const match = requestAuthHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      requestToken = match[1].trim();
    }
  }

  let serverHostname: string | undefined;
  if (serverUrl) {
    try {
      serverHostname = new URL(serverUrl).hostname;
    } catch {
      // ignore invalid URLs
    }
  }

  for (const { re, label } of RESPONSE_TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(responseContent)) !== null) {
      if (label === 'JWT token') {
        const responseJwt = match[0];

        // Parse JWT claims to check iss
        const claims = parseJwtPayload(responseJwt);

        if (requestToken && responseJwt === requestToken) {
          findings.push({
            type: 'TOKEN_PASSTHROUGH',
            severity: 'CRITICAL',
            detail: 'MCP server is echoing back the client\'s own auth token',
          });
          continue;
        }

        // Check ISS claim: if JWT claims it was issued by a different service
        if (claims?.iss && typeof claims.iss === 'string' && serverHostname) {
          const issuerHostname = extractHostnameFromIss(claims.iss);
          if (issuerHostname && !issuerHostname.includes(serverHostname) && !serverHostname.includes(issuerHostname)) {
            findings.push({
              type: 'TOKEN_IN_RESPONSE',
              severity: 'CRITICAL',
              detail: `Response contains JWT issued by '${claims.iss}' — this token belongs to a different service, possible exfiltration`,
            });
            continue;
          }
        }

        findings.push({
          type: 'TOKEN_IN_RESPONSE',
          severity: 'CRITICAL',
          detail: 'Response contains a JWT — possible token exfiltration',
        });
        continue;
      }

      if (label !== 'JWT token') {
        findings.push({
          type: 'TOKEN_IN_RESPONSE',
          severity: 'CRITICAL',
          detail: `Response contains ${label} pattern — possible credential leak`,
        });
      }
    }
  }

  return { safe: findings.length === 0, findings };
}

/**
 * Extract a hostname from a JWT issuer URL.
 * Handles both URL-style (https://auth.example.com/) and simple (auth.example.com) issuers.
 */
function extractHostnameFromIss(iss: string): string | null {
  try {
    return new URL(iss).hostname;
  } catch {
    // Not a URL — may be a simple hostname
    return iss || null;
  }
}
