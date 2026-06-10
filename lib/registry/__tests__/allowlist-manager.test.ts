import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Supabase ───────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

// ─── Imports after mock ──────────────────────────────────────────────

import {
  checkAllowlist,
  submitForApproval,
  approveServer,
  revokeServer,
  getRegistryForOrg,
} from '../allowlist-manager';

// ─── Helpers ──────────────────────────────────────────────────────────

function mockAllowlistConfig(overrides: Record<string, unknown> = {}) {
  const mockMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      organization_id: overrides.orgId ?? 'org-123',
      enforcement_mode: overrides.enforcementMode ?? 'strict',
      auto_approve_above_score: overrides.autoApprove ?? 85,
      updated_at: new Date().toISOString(),
    },
    error: null,
  });
  const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValueOnce({ select: mockSelect });
}

function mockServerRegistryEntry(status: string | null, overrides: Record<string, unknown> = {}) {
  const data =
    status === null
      ? null
      : {
          id: 'entry-1',
          organization_id: overrides.orgId ?? 'org-123',
          server_url: overrides.serverUrl ?? 'https://api.example.com/mcp',
          approval_status: status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  // Second .eq() returns object with .maybeSingle()
  const eq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  // First .eq() returns object with .eq() for chaining
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: eq1 });
  mockFrom.mockReturnValueOnce({ select: mockSelect });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('allowlist-manager', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── checkAllowlist: strict mode ───────────────────────────────────

  it('strict mode: blocks unregistered server', async () => {
    mockAllowlistConfig({ enforcementMode: 'strict' });
    mockServerRegistryEntry(null); // no entry found

    const result = await checkAllowlist('org-123', 'https://evil.com/mcp');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('not_registered');
    expect(result.enforcementMode).toBe('strict');
    expect(result.requiresApproval).toBe(true);
  });

  it('strict mode: blocks rejected server', async () => {
    mockAllowlistConfig({ enforcementMode: 'strict' });
    mockServerRegistryEntry('rejected');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('strict mode: blocks revoked server', async () => {
    mockAllowlistConfig({ enforcementMode: 'strict' });
    mockServerRegistryEntry('revoked');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('revoked');
  });

  it('strict mode: blocks pending server', async () => {
    mockAllowlistConfig({ enforcementMode: 'strict' });
    mockServerRegistryEntry('pending');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('pending');
    expect(result.requiresApproval).toBe(true);
  });

  it('strict mode: allows approved server', async () => {
    mockAllowlistConfig({ enforcementMode: 'strict' });
    mockServerRegistryEntry('approved');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('approved');
  });

  // ── checkAllowlist: warn mode ─────────────────────────────────────

  it('warn mode: allows unregistered server with warning', async () => {
    mockAllowlistConfig({ enforcementMode: 'warn' });
    mockServerRegistryEntry(null);

    const result = await checkAllowlist('org-123', 'https://evil.com/mcp');
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('not_registered');
    expect(result.message).toContain('WARNING');
  });

  it('warn mode: blocks rejected server', async () => {
    mockAllowlistConfig({ enforcementMode: 'warn' });
    mockServerRegistryEntry('rejected');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('warn mode: allows pending server with caution', async () => {
    mockAllowlistConfig({ enforcementMode: 'warn' });
    mockServerRegistryEntry('pending');

    const result = await checkAllowlist('org-123', 'https://api.example.com/mcp');
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('pending');
  });

  // ── checkAllowlist: off mode ──────────────────────────────────────

  it('off mode: always allows with no enforcement message', async () => {
    mockAllowlistConfig({ enforcementMode: 'off' });

    const result = await checkAllowlist('org-123', 'https://evil.com/mcp');
    expect(result.allowed).toBe(true);
    expect(result.enforcementMode).toBe('off');
    expect(result.message).toContain('disabled');
  });

  // ── submitForApproval ─────────────────────────────────────────────

  it('submitForApproval upserts as pending', async () => {
    const fakeUpsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValueOnce({ upsert: fakeUpsert });

    // Mock getAllowlistConfig result (inside submitForApproval)
    mockAllowlistConfig({ enforcementMode: 'strict', autoApprove: 99 }); // score 60 < 99, no auto-approve

    await submitForApproval('org-123', 'https://api.example.com/mcp', 'scan-1', 60, 'abc123');

    expect(fakeUpsert).toHaveBeenCalledTimes(1);
    const insertArg = fakeUpsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.organization_id).toBe('org-123');
    expect(insertArg.approval_status).toBe('pending');
  });

  it('submitForApproval auto-approves when score >= threshold', async () => {
    const fakeUpsert = vi.fn().mockResolvedValue({ error: null });
    // 1st from(): upsert into server_registry
    mockFrom.mockReturnValueOnce({ upsert: fakeUpsert });

    // 2nd from(): getAllowlistConfig
    mockAllowlistConfig({ enforcementMode: 'strict', autoApprove: 80 });

    // 3rd from(): update to approved
    const fakeUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValueOnce({ update: fakeUpdate });

    await submitForApproval('org-123', 'https://api.example.com/mcp', 'scan-1', 95, 'abc123');

    // Should have called update with approved status
    expect(fakeUpdate).toHaveBeenCalled();
    const updateArg = fakeUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.approval_status).toBe('approved');
    expect(updateArg.approved_by).toBe('system');
  });

  // ── approveServer ─────────────────────────────────────────────────

  it('approveServer updates status to approved', async () => {
    const fakeUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValueOnce({ update: fakeUpdate });

    await approveServer('org-123', 'https://api.example.com/mcp', 'admin-1');

    expect(fakeUpdate).toHaveBeenCalled();
    const updateArg = fakeUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.approval_status).toBe('approved');
    expect(updateArg.approved_by).toBe('admin-1');
  });

  it('approveServer throws on error', async () => {
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      }),
    });

    await expect(
      approveServer('org-123', 'https://api.example.com/mcp', 'admin-1'),
    ).rejects.toThrow('DB error');
  });

  // ── revokeServer ──────────────────────────────────────────────────

  it('revokeServer updates status to revoked with notes', async () => {
    const fakeUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValueOnce({ update: fakeUpdate });

    await revokeServer('org-123', 'https://api.example.com/mcp', 'Security policy change');

    expect(fakeUpdate).toHaveBeenCalled();
    const updateArg = fakeUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.approval_status).toBe('revoked');
    expect(updateArg.notes).toBe('Security policy change');
  });

  // ── getRegistryForOrg ─────────────────────────────────────────────

  it('getRegistryForOrg returns entries', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: '1',
          organization_id: 'org-123',
          server_url: 'https://api.example.com/mcp',
          approval_status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const entries = await getRegistryForOrg('org-123');
    expect(entries).toHaveLength(1);
    expect(entries[0].serverUrl).toBe('https://api.example.com/mcp');
    expect(entries[0].approvalStatus).toBe('approved');
  });

  it('getRegistryForOrg returns empty array on error', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const entries = await getRegistryForOrg('org-123');
    expect(entries).toEqual([]);
  });
});
