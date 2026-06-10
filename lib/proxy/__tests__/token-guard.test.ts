import { describe, it, expect } from 'vitest';
import { validateOutboundToken, scanResponseForTokens } from '../token-guard';

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Create a valid JWT with the given payload claims.
 * Uses a fake signature (tests don't verify signatures).
 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const sig = btoa('fake-signature');
  return `${header}.${body}.${sig}`;
}

// ─── validateOutboundToken ───────────────────────────────────────────

describe('validateOutboundToken', () => {
  it('returns safe when no auth header is present', () => {
    const result = validateOutboundToken(undefined, 'https://api.example.com/mcp');
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('returns safe when auth header is not Bearer', () => {
    const result = validateOutboundToken('Basic dXNlcjpwYXNz', 'https://api.example.com/mcp');
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('flags WEAK_TOKEN_FORMAT for non-JWT Bearer token', () => {
    const result = validateOutboundToken('Bearer not-a-jwt', 'https://api.example.com/mcp');
    expect(result.safe).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].type).toBe('WEAK_TOKEN_FORMAT');
    expect(result.findings[0].severity).toBe('MEDIUM');
  });

  it('detects AUDIENCE_MISMATCH CRITICAL when audience does not match server hostname', () => {
    const token = makeJwt({ aud: 'other-service.com', scope: 'read' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    const audFinding = result.findings.find(f => f.type === 'AUDIENCE_MISMATCH');
    expect(audFinding).toBeDefined();
    expect(audFinding!.severity).toBe('CRITICAL');
    expect(audFinding!.detail).toContain('other-service.com');
    expect(audFinding!.detail).toContain('api.example.com');
  });

  it('returns safe when audience matches server hostname exactly', () => {
    const token = makeJwt({ aud: 'api.example.com', scope: 'read' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('returns safe when audience matches server URL exactly', () => {
    const token = makeJwt({ aud: 'https://api.example.com/mcp', scope: 'read' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(true);
  });

  it('detects AUDIENCE_MISMATCH HIGH when token has no audience claim', () => {
    const token = makeJwt({ sub: 'user-123', scope: 'read' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    const audFinding = result.findings.find(f => f.type === 'AUDIENCE_MISMATCH');
    expect(audFinding).toBeDefined();
    expect(audFinding!.severity).toBe('HIGH');
    expect(audFinding!.detail).toContain('no audience claim');
  });

  it('detects SCOPE_EXCESS HIGH for admin scope', () => {
    const token = makeJwt({ aud: 'api.example.com', scope: 'admin read write' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    const scopeFinding = result.findings.find(f => f.type === 'SCOPE_EXCESS');
    expect(scopeFinding).toBeDefined();
    expect(scopeFinding!.severity).toBe('HIGH');
    expect(scopeFinding!.detail).toContain('admin');
  });

  it('detects SCOPE_EXCESS HIGH for write:all scope', () => {
    const token = makeJwt({ aud: 'api.example.com', scope: 'read write:all' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    const scopeFinding = result.findings.find(f => f.type === 'SCOPE_EXCESS');
    expect(scopeFinding).toBeDefined();
    expect(scopeFinding!.detail).toContain('write:all');
  });

  it('detects SCOPE_EXCESS HIGH for sudo scope', () => {
    const token = makeJwt({ aud: 'api.example.com', scope: 'sudo' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    const scopeFinding = result.findings.find(f => f.type === 'SCOPE_EXCESS');
    expect(scopeFinding).toBeDefined();
  });

  it('returns safe for benign scope like read-only', () => {
    const token = makeJwt({ aud: 'api.example.com', scope: 'read list get' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(true);
  });

  it('can produce multiple findings (missing aud + excess scope)', () => {
    const token = makeJwt({ scope: 'admin' });
    const result = validateOutboundToken(
      `Bearer ${token}`,
      'https://api.example.com/mcp',
    );
    expect(result.safe).toBe(false);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const types = result.findings.map(f => f.type);
    expect(types).toContain('AUDIENCE_MISMATCH');
    expect(types).toContain('SCOPE_EXCESS');
  });
});

// ─── scanResponseForTokens ───────────────────────────────────────────

describe('scanResponseForTokens', () => {
  it('returns safe for empty response content', () => {
    const result = scanResponseForTokens('', undefined);
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('detects TOKEN_PASSTHROUGH CRITICAL when response contains the same JWT', () => {
    const token = makeJwt({ sub: 'user-123' });
    const responseContent = `Here is your data: ${token} and some more text.`;
    const result = scanResponseForTokens(responseContent, `Bearer ${token}`);
    expect(result.safe).toBe(false);
    const ptFinding = result.findings.find(f => f.type === 'TOKEN_PASSTHROUGH');
    expect(ptFinding).toBeDefined();
    expect(ptFinding!.severity).toBe('CRITICAL');
    expect(ptFinding!.detail).toContain('echoing back');
  });

  it('detects TOKEN_IN_RESPONSE CRITICAL for a different JWT', () => {
    const requestToken = makeJwt({ sub: 'user-123' });
    const responseToken = makeJwt({ sub: 'user-456' }); // different token
    const responseContent = `Found token: ${responseToken}`;
    const result = scanResponseForTokens(responseContent, `Bearer ${requestToken}`);
    expect(result.safe).toBe(false);
    const inResponse = result.findings.find(f => f.type === 'TOKEN_IN_RESPONSE');
    expect(inResponse).toBeDefined();
    expect(inResponse!.severity).toBe('CRITICAL');
    expect(inResponse!.detail).toContain('exfiltration');
  });

  it('detects TOKEN_IN_RESPONSE for GitHub PAT pattern', () => {
    const responseContent = 'My token is ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const result = scanResponseForTokens(responseContent, undefined);
    expect(result.safe).toBe(false);
    const finding = result.findings.find(f => f.type === 'TOKEN_IN_RESPONSE');
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain('GitHub token');
  });

  it('detects TOKEN_IN_RESPONSE for OpenAI API key pattern', () => {
    const responseContent = 'Use key sk-abcdefghijklmnopqrstuvwxyz123456';
    const result = scanResponseForTokens(responseContent, undefined);
    expect(result.safe).toBe(false);
    const finding = result.findings.find(f => f.type === 'TOKEN_IN_RESPONSE');
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain('OpenAI');
  });

  it('detects TOKEN_IN_RESPONSE for Bearer token header in response', () => {
    const responseContent = 'Set authorization: Authorization: Bearer mysecrettoken12345';
    const result = scanResponseForTokens(responseContent, undefined);
    expect(result.safe).toBe(false);
    const finding = result.findings.find(f => f.type === 'TOKEN_IN_RESPONSE');
    expect(finding).toBeDefined();
  });

  it('returns safe for clean response with no tokens', () => {
    const responseContent = JSON.stringify({
      result: [{ text: 'The weather is sunny today.' }],
    });
    const result = scanResponseForTokens(responseContent, undefined);
    expect(result.safe).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('handles multiple token findings in one response', () => {
    const requestToken = makeJwt({ sub: 'user-123' });
    const responseContent = `Token: ${requestToken}. Also: sk-abcdefghijklmnopqrstuvwxyz123456`;
    const result = scanResponseForTokens(responseContent, `Bearer ${requestToken}`);
    // Should find at least the passthrough and the OpenAI key
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    const types = result.findings.map(f => f.type);
    expect(types).toContain('TOKEN_PASSTHROUGH');
    expect(types).toContain('TOKEN_IN_RESPONSE');
  });
});
