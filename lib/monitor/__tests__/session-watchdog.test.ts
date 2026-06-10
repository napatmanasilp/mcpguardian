import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';

// ─── Mock Supabase ───────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

// ─── Mock invocation-logger ──────────────────────────────────────────

vi.mock('@/lib/monitor/invocation-logger', () => ({
  getSessionLogs: vi.fn().mockResolvedValue([]),
  getServerLogs: vi.fn().mockResolvedValue([]),
  logInvocation: vi.fn().mockResolvedValue(undefined),
  generateSessionId: () => 'mock-uuid-12345',
}));

// ─── Mock behavior-baseline ──────────────────────────────────────────

vi.mock('@/lib/monitor/behavior-baseline', () => ({
  buildBaseline: vi.fn().mockReturnValue({ tools: new Map(), totalCalls: 0, establishedAt: Date.now() }),
  detectAnomalies: vi.fn().mockReturnValue([]),
}));

// ─── Imports after mocks ─────────────────────────────────────────────

import {
  SessionWatchdog,
  isSessionTerminated,
  markSessionTerminated,
  clearTerminatedSessions,
} from '../session-watchdog';

// ─── Helpers ─────────────────────────────────────────────────────────

function mockActiveSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'session-1',
    user_id: overrides.userId ?? 'user-1',
    server_url: overrides.serverUrl ?? 'https://api.example.com/mcp',
    server_url_hash: createHash('sha256').update('https://api.example.com/mcp').digest('hex').slice(0, 16),
    initial_tool_hash: overrides.initialToolHash ?? 'abc123',
    session_start: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: overrides.status ?? 'active',
    termination_reason: overrides.terminationReason ?? null,
    rescan_interval_ms: 900_000,
    next_rescan_at: new Date(Date.now() + 900_000).toISOString(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('SessionWatchdog', () => {
  let watchdog: SessionWatchdog;

  beforeEach(() => {
    watchdog = new SessionWatchdog();
    vi.clearAllMocks();
    clearTerminatedSessions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTerminatedSessions();
  });

  // ── isSessionTerminated / markSessionTerminated ──────────────────

  it('isSessionTerminated returns false for unknown session', () => {
    const result = isSessionTerminated('unknown-session');
    expect(result.terminated).toBe(false);
  });

  it('markSessionTerminated stores the termination', () => {
    markSessionTerminated('session-1', 'Test kill');
    const result = isSessionTerminated('session-1');
    expect(result.terminated).toBe(true);
    expect(result.reason).toBe('Test kill');
  });

  // ── registerSession ─────────────────────────────────────────────

  it('registerSession inserts a row and returns session ID', async () => {
    mockFrom.mockReturnValueOnce({ insert: mockInsert });
    mockInsert.mockResolvedValueOnce({ error: null });

    const sid = await watchdog.registerSession(
      'https://api.example.com/mcp',
      'abc123',
      'user-1',
    );

    expect(sid).toBeDefined();
    expect(typeof sid).toBe('string');
    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.server_url).toBe('https://api.example.com/mcp');
    expect(insertArg.initial_tool_hash).toBe('abc123');
    expect(insertArg.status).toBe('active');
  });

  it('registerSession uses provided session ID', async () => {
    mockFrom.mockReturnValueOnce({ insert: mockInsert });
    mockInsert.mockResolvedValueOnce({ error: null });

    const sid = await watchdog.registerSession(
      'https://api.example.com/mcp',
      'abc123',
      'user-1',
      'custom-session-id',
    );

    expect(sid).toBe('custom-session-id');
  });

  // ── checkSession ────────────────────────────────────────────────

  it('checkSession returns null for non-existent session', async () => {
    mockFrom.mockReturnValueOnce({ select: mockSelect });
    mockSelect.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await watchdog.checkSession('nonexistent');
    expect(result).toBeNull();
  });

  it('checkSession returns session status for active session', async () => {
    // First mock: select from active_sessions
    mockFrom.mockReturnValueOnce({ select: mockSelect });
    mockSelect.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockActiveSessionRow({ id: 'session-1', status: 'active' }),
      error: null,
    });

    // Second mock: count anomalies
    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          count: 3,
          error: null,
        })),
      })),
    });

    const result = await watchdog.checkSession('session-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
    expect(result!.anomalyCount).toBe(3);
    expect(result!.serverUrl).toBe('https://api.example.com/mcp');
  });

  it('checkSession returns terminated status when in-memory killed', async () => {
    // Mark as terminated in memory
    markSessionTerminated('session-2', 'Killed');

    // First mock: DB returns active
    mockFrom.mockReturnValueOnce({ select: mockSelect });
    mockSelect.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockActiveSessionRow({ id: 'session-2', status: 'active' }),
      error: null,
    });

    // Second mock: count anomalies
    mockFrom.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ count: 1, error: null })),
      })),
    });

    const result = await watchdog.checkSession('session-2');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('terminated');
    expect(result!.terminationReason).toBe('Killed');
  });

  // ── killSession ─────────────────────────────────────────────────

  it('killSession updates DB and marks in-memory store', async () => {
    const fakeUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValueOnce({ update: fakeUpdate });

    await watchdog.killSession('session-1', 'Security incident');

    // Check in-memory store
    const check = isSessionTerminated('session-1');
    expect(check.terminated).toBe(true);
    expect(check.reason).toBe('Security incident');

    // Check DB update
    expect(fakeUpdate).toHaveBeenCalled();
    const updateArg = fakeUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe('compromised');
    expect(updateArg.termination_reason).toBe('Security incident');
  });

  // ── getActiveSessions ───────────────────────────────────────────

  it('getActiveSessions returns sessions with anomaly counts', async () => {
    // Mock: select from active_sessions
    mockFrom.mockReturnValueOnce({
      select: mockSelect,
    });
    mockSelect.mockReturnValueOnce({
      eq: mockEq,
    });
    mockEq.mockReturnValueOnce({
      order: mockOrder,
    });
    mockOrder.mockResolvedValueOnce({
      data: [
        mockActiveSessionRow({ id: 's1', status: 'active' }),
        mockActiveSessionRow({ id: 's2', status: 'terminated', terminationReason: 'Manual' }),
      ],
      error: null,
    });

    // Mock anomaly counts for each session
    for (let i = 0; i < 2; i++) {
      mockFrom.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ count: i, error: null })),
        })),
      });
    }

    const sessions = await watchdog.getActiveSessions('user-1');
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('s1');
    expect(sessions[0].status).toBe('active');
    expect(sessions[1].anomalyCount).toBe(1);
  });

  it('getActiveSessions returns empty on error', async () => {
    mockFrom.mockReturnValueOnce({ select: mockSelect });
    mockSelect.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ order: mockOrder });
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const sessions = await watchdog.getActiveSessions('user-1');
    expect(sessions).toEqual([]);
  });

  // ── runPeriodicRescan ───────────────────────────────────────────

  it('runPeriodicRescan skips non-active sessions', async () => {
    mockFrom.mockReturnValueOnce({ select: mockSelect });
    mockSelect.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValueOnce({
      data: mockActiveSessionRow({ id: 's1', status: 'terminated' }),
      error: null,
    });

    // Should not proceed since status is 'terminated'
    await watchdog.runPeriodicRescan('s1');

    // Only one mock call (the select) should have been made
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
