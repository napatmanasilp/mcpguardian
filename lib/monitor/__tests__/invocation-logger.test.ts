import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logInvocation, getSessionLogs, getServerLogs, generateSessionId, type InvocationRecord, type ResponseFlag } from '../invocation-logger';

// ─── Mock Supabase ───────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockThen = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<InvocationRecord> = {}): InvocationRecord {
  return {
    sessionId: 'test-session-123',
    userId: undefined,
    serverUrl: 'https://mcp.example.com',
    toolName: 'get_weather',
    parameters: { city: 'London', units: 'metric' },
    responseContent: '{"temperature": 20}',
    latencyMs: 150,
    responseFlags: [],
    proxyMode: 'monitor',
    blocked: false,
    ...overrides,
  };
}

function makeFlag(overrides: Partial<ResponseFlag> = {}): ResponseFlag {
  return {
    type: 'CREDENTIAL_IN_ARGUMENT',
    severity: 'CRITICAL',
    title: 'Credential detected',
    description: 'A credential was found in the request',
    blocked: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('invocation-logger', () => {

  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockOrder.mockReset();
    mockLimit.mockReset();
    mockThen.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── logInvocation ──────────────────────────────────────────────────

  it('inserts a row into tool_invocation_logs', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    await logInvocation(makeRecord());

    expect(mockFrom).toHaveBeenCalledWith('tool_invocation_logs');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.session_id).toBe('test-session-123');
    expect(insertArg.tool_name).toBe('get_weather');
    expect(insertArg.server_url).toBe('https://mcp.example.com');
    expect(insertArg.proxy_mode).toBe('monitor');
    expect(insertArg.blocked).toBe(false);
  });

  it('masks sensitive parameter values before inserting', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    await logInvocation(makeRecord({
      parameters: {
        api_key: 'sk-secret-12345',
        city: 'London',
        token: 'ghp_abc123',
      },
    }));

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.parameters.api_key).toBe('[MASKED]');
    expect(insertArg.parameters.token).toBe('[MASKED]');
    expect(insertArg.parameters.city).toBe('London');
  });

  it('computes parameter_hash as SHA-256 hex', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    await logInvocation(makeRecord({
      parameters: { a: 1, b: 2 },
    }));

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.parameter_hash).toBeDefined();
    expect(typeof insertArg.parameter_hash).toBe('string');
    expect(insertArg.parameter_hash.length).toBe(64); // SHA-256 hex
  });

  it('computes response_hash as SHA-256 hex', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    await logInvocation(makeRecord({ responseContent: '{"result": "ok"}' }));

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.response_hash).toBeDefined();
    expect(insertArg.response_hash.length).toBe(64);
  });

  it('stores response_size as UTF-8 byte length', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    await logInvocation(makeRecord({
      responseContent: 'hello', // 5 bytes in UTF-8
    }));

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.response_size).toBe(5);
  });

  it('stores response_flags passed in the record', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: null });

    const flags: ResponseFlag[] = [
      makeFlag({ type: 'RETURN_VALUE_POISONING', severity: 'CRITICAL' }),
    ];

    await logInvocation(makeRecord({ responseFlags: flags }));

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.response_flags).toEqual(flags);
  });

  it('does NOT throw when Supabase insert fails — fire-and-forget', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockRejectedValue(new Error('DB connection lost'));

    // Should not throw
    await expect(
      logInvocation(makeRecord()),
    ).resolves.toBeUndefined();

    // Should have logged to console.error
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('does NOT throw when Supabase returns an error object', async () => {
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockResolvedValue({ error: { message: 'Constraint violation' } });

    await expect(
      logInvocation(makeRecord()),
    ).resolves.toBeUndefined();
  });

  // ── generateSessionId ─────────────────────────────────────────────

  it('generateSessionId returns a UUID string', () => {
    const id = generateSessionId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  // ── getSessionLogs ────────────────────────────────────────────────

  it('getSessionLogs queries by session_id', async () => {
    const mockData = [
      { session_id: 'sess-1', tool_name: 'get_weather', server_url: 'https://mcp.example.com', latency_ms: 100, proxy_mode: 'monitor', blocked: false },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          })),
        })),
      })),
    });

    const logs = await getSessionLogs('sess-1');
    expect(logs).toHaveLength(1);
    expect(logs[0].sessionId).toBe('sess-1');
    expect(logs[0].toolName).toBe('get_weather');
  });

  it('getSessionLogs returns empty array on error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
          })),
        })),
      })),
    });

    const logs = await getSessionLogs('sess-1');
    expect(logs).toEqual([]);
  });

  // ── getServerLogs ─────────────────────────────────────────────────

  it('getServerLogs queries by server_url', async () => {
    const mockData = [
      { session_id: 'sess-2', tool_name: 'send_email', server_url: 'https://email.example.com', latency_ms: 200, proxy_mode: 'block', blocked: true },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          })),
        })),
      })),
    });

    const logs = await getServerLogs('https://email.example.com');
    expect(logs).toHaveLength(1);
    expect(logs[0].serverUrl).toBe('https://email.example.com');
    expect(logs[0].blocked).toBe(true);
  });

  it('getServerLogs returns empty array on error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
          })),
        })),
      })),
    });

    const logs = await getServerLogs('https://mcp.example.com');
    expect(logs).toEqual([]);
  });
});
