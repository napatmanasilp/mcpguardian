import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanMcpConfig } from '../index';

// ─── Mock modules ─────────────────────────────────────────────────────

const mockRunSandboxedProbe = vi.fn();

// Mock child_process.execSync so the inline Docker check in pipeline.ts
// simulates Docker being available (no need for actual Docker on test machine).
vi.mock('child_process', () => ({
  execSync: vi.fn(() => Buffer.from('Docker version 24.0.0')),
}));

vi.mock('../sandbox', () => ({
  runSandboxedProbe: (...args: unknown[]) => mockRunSandboxedProbe(...args),
}));

// Mock domain-verifier so it doesn't make real TLS/fetch calls that would
// consume mock responses meant for the behavioral probe. This test focuses
// on rug-pull (hash comparison) logic, not domain verification.
vi.mock('../domain-verifier', () => ({
  verifyDomain: async (_url: string) => ({
    domainCheck: {
      domain: 'api.test.com',
      domainAgeDays: null,
      domainAgeFlagged: false,
      domainPrivacyHidden: false,
      sslValid: true,
      sslExpired: false,
      sslSelfSigned: false,
      sslDomainMismatch: false,
      certChainValid: true,
      certChainDepth: 2,
      certRootCA: 'Test CA',
      certInCTLogs: true,
      ctIssuerName: 'Test CA',
      ctCertCount: 1,
      hstsPresent: false,
      hstsMaxAge: null,
      ocspStatus: 'GOOD',
      ipReputationScore: null,
      ipReputationFlagged: false,
      ipReputationUnverified: true,
      dnsConsistent: true,
      dnsResults: [],
      blocklisted: false,
      blocklistReason: null,
      criticalBlocked: false,
    },
    issues: [],
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────

function mockFetchResponse(body: string, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { forEach: () => {} },
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  };
}

function mockJsonRpcResult(result: unknown) {
  return Promise.resolve(
    mockFetchResponse(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), 200),
  );
}

function mockToolsResponse(tools: unknown[]) {
  return Promise.resolve(
    mockFetchResponse(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { tools } }), 200),
  );
}

function mockMethodNotFound(id = 3) {
  return Promise.resolve(
    mockFetchResponse(
      JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }),
      200,
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('Sandbox-verified rug-pull detection', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockRunSandboxedProbe.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects rug-pull when sandbox hash differs from stored baseline — CRITICAL, code RUG_PULL_DETECTED, 40pt deduction', async () => {
    // ── Step 1: Pre-populate the hash store with a known baseline ──
    // We do this by importing the real storeHash and calling it directly.
    // vitest hoists vi.mock before imports, so this import gets the real module.
    const { storeHash } = await import('../hash-store');
    storeHash({
      serverUrl: 'https://api.test.com/mcp',
      toolsHash: '1111111111111111111111111111111111111111111111111111111111111111',
      scannedAt: '2026-01-01T00:00:00.000Z',
      toolCount: 1,
    });

    // ── Step 2: Mock HTTP probe responses ───────────────────────────
    // Fetch call order in pipeline:
    // 1. probeUnauthenticatedAccess (initialize POST)
    // 2. probeHttpMcpServer initialize POST
    // 3. probeHttpMcpServer tools/list POST
    // 4. probeHttpMcpServer prompts/list POST
    // 5. probeHttpMcpServer resources/list POST
    // 6. probeHttpMcpServer → checkCredentialReflection (POST with dummy token)
    // 7. checkCorsHeaders OPTIONS
    mockFetch
      // #1: Unauthenticated probe — return 401 so no issue added
      .mockResolvedValueOnce(mockFetchResponse(
        JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: 401, message: 'Unauthorized' } }),
        401,
      ))
      // #2: Initialize (authenticated)
      .mockResolvedValueOnce(mockJsonRpcResult({ protocolVersion: '2024-11-05', capabilities: {} }))
      // #3: tools/list
      .mockResolvedValueOnce(mockToolsResponse([{ name: 'echo', description: 'Echoes input', inputSchema: { type: 'object' } }]))
      // #4: prompts/list
      .mockResolvedValueOnce(mockMethodNotFound(3))
      // #5: resources/list
      .mockResolvedValueOnce(mockMethodNotFound(4))
      // #6: checkCredentialReflection — return response that does NOT echo back the token
      .mockResolvedValueOnce(mockFetchResponse(
        JSON.stringify({ jsonrpc: '2.0', id: 999, result: { protocolVersion: '2024-11-05', capabilities: {} } }),
        200,
      ))
      // #7: CORS OPTIONS — return specific origin so no CORS issue fires
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => name === 'access-control-allow-origin' ? 'https://mcpguardian.dev' : null,
          forEach: () => {},
        },
      });

    // ── Step 3: Mock sandbox probe to return a DIFFERENT hash ───────
    mockRunSandboxedProbe.mockResolvedValue({
      success: true,
      sandboxType: 'DOCKER',
      outputPath: '',
      rawOutput: {},
      probes: {},
      toolHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      rawTools: [],
      toolRiskMatrix: [],
      validation: { valid: true, errors: [], warnings: [] },
    });

    // ── Step 4: Run the scan ────────────────────────────────────────
    const config = JSON.stringify({
      mcpServers: { api: { url: 'https://api.test.com/mcp' } },
    });
    const result = await scanMcpConfig(config);

    // ── Step 5: Assertions ──────────────────────────────────────────
    const server = result.servers[0];
    expect(server).toBeDefined();

    // The RUG_PULL_DETECTED issue must be present with CRITICAL severity
    const rugPullIssue = server.issues.find(i => i.type === 'RUG_PULL_DETECTED');
    expect(rugPullIssue).toBeDefined();
    expect(rugPullIssue!.severity).toBe('CRITICAL');
    expect(rugPullIssue!.deduction).toBe(40);

    // Expected deductions:
    //   Step 1: MISSING_AUTH_HEADER (25) — no Authorization header in config
    //   Step 3: MISSING_AUTHENTICATION (20) — server didn't require auth
    //   Step 4: RUG_PULL_DETECTED (40) — sandbox hash differs
    // Total: 85 → score = max(0, 100 - 85) = 15
    expect(server.score).toBe(15);

    // The verdict should be DO_NOT_CONNECT (via hashChanged in determineVerdict)
    const pipelineReport = result.pipelineReports?.find(r => r.serverName === 'api');
    expect(pipelineReport).toBeDefined();
    expect(pipelineReport!.verdict).toBe('DO_NOT_CONNECT');
    expect(pipelineReport!.hashChanged).toBe(true);
  });

  it('does not flag rug-pull on first scan — isFirstScan suppresses mismatch', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonRpcResult({ protocolVersion: '2024-11-05', capabilities: {} }))
      .mockResolvedValueOnce(mockToolsResponse([{ name: 'greet', description: 'Says hello', inputSchema: {} }]))
      .mockResolvedValueOnce(mockMethodNotFound(3))
      .mockResolvedValueOnce(mockMethodNotFound(4));

    mockRunSandboxedProbe.mockResolvedValue({
      success: true,
      sandboxType: 'DOCKER',
      outputPath: '',
      rawOutput: {},
      probes: {},
      toolHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      rawTools: [],
      toolRiskMatrix: [],
      validation: { valid: true, errors: [], warnings: [] },
    });

    // Use a different URL so there's no pre-existing baseline
    const config = JSON.stringify({
      mcpServers: { fresh: { url: 'https://fresh-server.example.com/mcp' } },
    });
    const result = await scanMcpConfig(config);

    const server = result.servers[0];
    const rugPullIssue = server.issues.find(i => i.type === 'RUG_PULL_DETECTED');
    expect(rugPullIssue).toBeUndefined();
    expect(result.grade).toBeDefined();
  });
});
