import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { getSessionLogs } from '@/lib/monitor/invocation-logger';
import { buildBaseline, detectAnomalies, type BaselineSet, type AnomalyScore } from '@/lib/monitor/behavior-baseline';

// ─── Types ───────────────────────────────────────────────────────────

export interface WatchdogConfig {
  rescanIntervalMs: number;         // default: 900_000 (15 min)
  toolHashDriftAction: 'kill' | 'alert';  // default: 'kill'
  anomalyRateThreshold: number;     // calls/min above baseline to alert
  autoKillOnCritical: boolean;      // default: true
}

export interface SessionStatus {
  sessionId: string;
  status: 'active' | 'terminated' | 'compromised' | 'suspicious';
  serverUrl: string;
  sessionStart: string;
  lastSeen: string;
  terminationReason?: string;
  anomalyCount: number;
}

export interface ActiveSession {
  id: string;
  serverUrl: string;
  status: string;
  sessionStart: string;
  lastSeen: string;
  terminationReason?: string;
  anomalyCount: number;
}

export interface AnomalyResult {
  id: string;
  anomalyType: string;
  severity: string;
  detail: string | null;
  detectedAt: string;
  autoKilled: boolean;
}

// ─── Sequence Detection Types ─────────────────────────────────────────

export interface SequencePattern {
  name: string;
  severity: 'CRITICAL' | 'HIGH';
  sequence: Array<{
    toolNamePattern: RegExp;
    parameterPattern?: RegExp;
    minCount?: number;
  }>;
  maxTimeWindowMs: number;
}

export interface SequenceMatch {
  detected: boolean;
  invocationIds: string[];
}

export interface SequenceAnomaly {
  sessionId: string;
  patternName: string;
  severity: 'CRITICAL' | 'HIGH';
  matchedInvocationIds: string[];
  detectedAt: string;
}

// ─── Known Dangerous Sequences ────────────────────────────────────────

const DANGEROUS_SEQUENCES: SequencePattern[] = [
  {
    name: 'RECON_READ_EXFILTRATE',
    severity: 'CRITICAL',
    sequence: [
      { toolNamePattern: /list|find|search|discover|enumerate/i },
      { toolNamePattern: /read|get|fetch|download|open|cat/i },
      { toolNamePattern: /http|request|post|send|upload|webhook/i },
    ],
    maxTimeWindowMs: 300_000,
  },
  {
    name: 'BULK_FILE_EXFILTRATION',
    severity: 'CRITICAL',
    sequence: [
      { toolNamePattern: /read|get|fetch|open/i, minCount: 5 },
      { toolNamePattern: /http|request|post|send/i },
    ],
    maxTimeWindowMs: 600_000,
  },
  {
    name: 'CREDENTIAL_HARVEST',
    severity: 'CRITICAL',
    sequence: [
      {
        toolNamePattern: /read|get|fetch/i,
        parameterPattern: /\.env|\.ssh|password|credential|secret|token/i,
      },
      { toolNamePattern: /http|request|post|webhook/i },
    ],
    maxTimeWindowMs: 60_000,
  },
];

// ─── In-memory Kill Switch Store ─────────────────────────────────────
// Maps sessionId -> { reason, killedAt }
// The proxy checks this before forwarding each request.

const terminatedSessions = new Map<string, { reason: string; killedAt: number }>();

// ─── Active Re-verification Intervals ─────────────────────────────────
// Maps sessionId -> setInterval reference for periodic tool hash checks.
// Managed by registerSession() and killSession().

const activeIntervals = new Map<string, NodeJS.Timeout>();

export function isSessionTerminated(sessionId: string): { terminated: boolean; reason?: string } {
  const entry = terminatedSessions.get(sessionId);
  if (entry) {
    return { terminated: true, reason: entry.reason };
  }
  return { terminated: false };
}

export function markSessionTerminated(sessionId: string, reason: string): void {
  terminatedSessions.set(sessionId, { reason, killedAt: Date.now() });
}

/** Clear the in-memory kill switch store (used in tests). */
export function clearTerminatedSessions(): void {
  terminatedSessions.clear();
}

// ─── Default Config ──────────────────────────────────────────────────

const DEFAULT_CONFIG: WatchdogConfig = {
  rescanIntervalMs: 900_000,        // 15 minutes
  toolHashDriftAction: 'kill',
  anomalyRateThreshold: 3,
  autoKillOnCritical: true,
};

// ─── SessionWatchdog Class ───────────────────────────────────────────

export class SessionWatchdog {
  private config: WatchdogConfig;

  constructor(config?: Partial<WatchdogConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fetch the tools/list response from a live MCP server.
   * Uses a lightweight JSON-RPC request (tools/list only, no full scan).
   */
  async fetchToolsList(serverUrl: string, timeoutMs: number = 10_000): Promise<unknown> {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const body = await response.json() as { result?: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> } };
    return body.result?.tools ?? [];
  }

  /**
   * Compute a SHA-256 hash of sorted tool definitions.
   */
  private hashTools(tools: Array<{ name: string; description?: string; inputSchema?: unknown }>): string {
    const sorted = [...tools].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const concatenated = sorted.map(t =>
      `${t.name}|${t.description || ''}|${JSON.stringify(t.inputSchema || {})}`
    ).join('||');
    return createHash('sha256').update(concatenated, 'utf-8').digest('hex');
  }

  /**
   * Verify that tool definitions have not changed since the session was registered.
   * Fetches tools/list from the live server and compares the hash against the stored
   * initial_tool_hash. If they differ, records a TOOL_HASH_DRIFT anomaly.
   *
   * If toolHashDriftAction is 'kill', also terminates the session.
   */
  async verifyToolDefinitions(sessionId: string): Promise<void> {
    const supabase = createServiceClient();
    const { data: session, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !session || session.status !== 'active') return;

    let currentTools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    try {
      const raw = await this.fetchToolsList(session.server_url, 10_000);
      currentTools = (raw as Array<{ name: string; description?: string; inputSchema?: unknown }>) ?? [];
    } catch (err) {
      // Server unreachable mid-session — flag as suspicious but don't kill
      const { error: insertError } = await supabase.from('session_anomalies').insert({
        session_id: sessionId,
        anomaly_type: 'SERVER_UNREACHABLE',
        severity: 'HIGH',
        detail: `Server unreachable during tool re-verification: ${String(err)}`,
        auto_killed: false,
      });
      if (insertError) {
        console.error('[session-watchdog] Failed to insert SERVER_UNREACHABLE anomaly:', insertError.message);
      }
      return;
    }

    const currentHash = this.hashTools(currentTools);

    if (currentHash !== session.initial_tool_hash) {
      const reason = 'Tool definitions changed mid-session — possible rug-pull or server compromise';

      const { error: insertError } = await supabase.from('session_anomalies').insert({
        session_id: sessionId,
        anomaly_type: 'TOOL_HASH_DRIFT',
        severity: 'CRITICAL',
        detail: `${reason}. Expected: ${(session.initial_tool_hash || '').slice(0, 16)}... Got: ${currentHash.slice(0, 16)}...`,
        auto_killed: this.config.toolHashDriftAction === 'kill',
      });
      if (insertError) {
        console.error('[session-watchdog] Failed to insert TOOL_HASH_DRIFT anomaly:', insertError.message);
      }

      // Reconcile permissions: detect new/removed tools and update snapshot
      try {
        await this.reconcilePermissions(sessionId, currentTools, session.server_url);
      } catch (permErr) {
        console.error('[session-watchdog] Failed to reconcile permissions:', permErr);
      }

      if (this.config.toolHashDriftAction === 'kill') {
        await this.killSession(sessionId, reason);
      }
    }
  }

  /**
   * Register a new proxy session in the database.
   * Starts a periodic re-verification loop that checks tool definitions
   * every rescanIntervalMs (default: 15 minutes).
   * Returns the session ID.
   */
  async registerSession(
    serverUrl: string,
    initialToolHash: string,
    userId: string = '',
    sessionId?: string,
    configOverride?: Partial<WatchdogConfig>,
  ): Promise<string> {
    const actualConfig = configOverride
      ? { ...this.config, ...configOverride }
      : this.config;

    const sid = sessionId || crypto.randomUUID();
    const serverUrlHash = createHash('sha256')
      .update(serverUrl)
      .digest('hex')
      .slice(0, 16);

    const supabase = createServiceClient();

    const { error } = await supabase.from('active_sessions').insert({
      id: sid,
      user_id: userId,
      server_url: serverUrl,
      server_url_hash: serverUrlHash,
      initial_tool_hash: initialToolHash,
      status: 'active',
      rescan_interval_ms: actualConfig.rescanIntervalMs,
      next_rescan_at: new Date(Date.now() + actualConfig.rescanIntervalMs).toISOString(),
    });

    if (error) {
      console.error('[session-watchdog] Failed to register session:', error.message);
    }

    // Start periodic re-verification loop
    // Clear any existing interval first (registerSession may be called multiple times
    // for the same sessionId — e.g. on every tools/call in the proxy route)
    const existing = activeIntervals.get(sid);
    if (existing) clearInterval(existing);

    const interval = setInterval(async () => {
      try {
        await this.verifyToolDefinitions(sid);
      } catch (err) {
        console.error(`[session-watchdog] verifyToolDefinitions failed for ${sid}:`, err);
      }
    }, actualConfig.rescanIntervalMs);

    activeIntervals.set(sid, interval);

    return sid;
  }

  /**
   * Check the status of a session.
   */
  async checkSession(sessionId: string): Promise<SessionStatus | null> {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) return null;

      // Also check in-memory kill switch
      const inMemory = isSessionTerminated(sessionId);
      const effectiveStatus = inMemory.terminated && data.status === 'active'
        ? 'terminated' as const
        : (data.status as SessionStatus['status']);

      // Count anomalies
      const { count } = await supabase
        .from('session_anomalies')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      return {
        sessionId: data.id,
        status: effectiveStatus,
        serverUrl: data.server_url,
        sessionStart: data.session_start,
        lastSeen: data.last_seen,
        terminationReason: data.termination_reason || inMemory.reason,
        anomalyCount: count ?? 0,
      };
    } catch (err) {
      console.error('[session-watchdog] Failed to check session:', err);
      return null;
    }
  }

  /**
   * Kill a session — terminates it in both the database and the in-memory store.
   * Also clears the periodic re-verification interval.
   */
  async killSession(sessionId: string, reason: string): Promise<void> {
    // Clear re-verification interval
    const interval = activeIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      activeIntervals.delete(sessionId);
    }

    // Mark in in-memory store first (fast path for proxy)
    markSessionTerminated(sessionId, reason);

    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('active_sessions')
        .update({
          status: 'compromised',
          termination_reason: reason,
          last_seen: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[session-watchdog] Failed to kill session in DB:', error.message);
      }
    } catch (err) {
      console.error('[session-watchdog] killSession error:', err);
    }
  }

  /**
   * Get all active sessions for a user.
   */
  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false });

      if (error) {
        console.error('[session-watchdog] Failed to get active sessions:', error.message);
        return [];
      }

      const results: ActiveSession[] = [];

      for (const row of data ?? []) {
        const { count } = await supabase
          .from('session_anomalies')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', row.id);

        results.push({
          id: row.id,
          serverUrl: row.server_url,
          status: row.status,
          sessionStart: row.session_start,
          lastSeen: row.last_seen,
          terminationReason: row.termination_reason,
          anomalyCount: count ?? 0,
        });
      }

      return results;
    } catch (err) {
      console.error('[session-watchdog] getActiveSessions error:', err);
      return [];
    }
  }

  /**
   * Run a periodic rescan on a session.
   * Checks for tool hash drift + exfiltration sequences + behavior anomalies.
   */
  async runPeriodicRescan(sessionId: string): Promise<void> {
    try {
      const supabase = createServiceClient();
      const { data: session, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !session || session.status !== 'active') return;

      const hashDrifted = await this.detectToolHashDrift(sessionId);
      if (hashDrifted) {
        const reason = 'Tool definitions changed mid-session — possible rug-pull or server compromise';
        const { error: insertError } = await supabase.from('session_anomalies').insert({
          session_id: sessionId,
          anomaly_type: 'TOOL_HASH_DRIFT',
          severity: 'CRITICAL',
          detail: reason,
          auto_killed: this.config.toolHashDriftAction === 'kill',
        });
        if (insertError) {
          console.error('[session-watchdog] Failed to insert anomaly:', insertError.message);
        }

        if (this.config.toolHashDriftAction === 'kill') {
          await this.killSession(sessionId, reason);
        }

        console.log(`[session-watchdog] Session ${sessionId}: ${reason}`);
      }

      // ── Exfiltration sequence detection ──────────────────────────
      const sequenceAnomalies = await this.detectExfiltrationSequences(sessionId);
      for (const seq of sequenceAnomalies) {
        const { error: insertError } = await supabase.from('session_anomalies').insert({
          session_id: sessionId,
          anomaly_type: seq.patternName,
          severity: seq.severity,
          detail: `Sequence pattern '${seq.patternName}' detected across tool calls. Matched invocations: ${seq.matchedInvocationIds.join(', ')}`,
          auto_killed: this.config.autoKillOnCritical && seq.severity === 'CRITICAL',
        });
        if (insertError) {
          console.error('[session-watchdog] Failed to insert sequence anomaly:', insertError.message);
        }

        if (this.config.autoKillOnCritical && seq.severity === 'CRITICAL') {
          await this.killSession(sessionId, `SEQUENCE_ATTACK: ${seq.patternName} pattern detected across tool calls`);
        }
      }

      // ── Behavior anomaly detection ───────────────────────────────
      const anomalies = await this.detectBehaviorAnomalies(sessionId);
      for (const anomaly of anomalies) {
        await supabase.from('session_anomalies').insert({
          session_id: sessionId,
          anomaly_type: anomaly.anomalyType,
          severity: anomaly.severity,
          detail: anomaly.detail,
          auto_killed: this.config.autoKillOnCritical && anomaly.severity === 'HIGH',
        });

        if (this.config.autoKillOnCritical && anomaly.severity === 'HIGH') {
          await this.killSession(sessionId, `Auto-killed: ${anomaly.detail}`);
          break; // stop processing after kill
        }
      }

      // Update next_rescan_at
      await supabase
        .from('active_sessions')
        .update({
          next_rescan_at: new Date(Date.now() + this.config.rescanIntervalMs).toISOString(),
          last_seen: new Date().toISOString(),
        })
        .eq('id', sessionId);

    } catch (err) {
      console.error('[session-watchdog] runPeriodicRescan error:', err);
    }
  }

  /**
   * Detect exfiltration sequences by analyzing recent invocation patterns.
   * Checks for known dangerous sequences like read → exfiltrate.
   */
  async detectExfiltrationSequences(sessionId: string): Promise<SequenceAnomaly[]> {
    try {
      const logs = await getSessionLogs(sessionId, 50);
      if (logs.length < 2) return [];

      const detected: SequenceAnomaly[] = [];

      for (const pattern of DANGEROUS_SEQUENCES) {
        const match = this.matchSequencePattern(logs, pattern);
        if (match.detected) {
          detected.push({
            sessionId,
            patternName: pattern.name,
            severity: pattern.severity,
            matchedInvocationIds: match.invocationIds,
            detectedAt: new Date().toISOString(),
          });
        }
      }

      return detected;
    } catch (err) {
      console.error('[session-watchdog] detectExfiltrationSequences error:', err);
      return [];
    }
  }

  /**
   * Match a sequence pattern against recent invocations.
   * Checks tools called in order within the time window.
   */
  private matchSequencePattern(
    logs: Array<{ toolName: string; responseContent?: string; timestamp?: string }>,
    pattern: SequencePattern,
  ): SequenceMatch {
    const invocationIds: string[] = [];

    for (let i = 0; i < logs.length; i++) {
      const windowEnd = Math.min(i + pattern.sequence.length * 3, logs.length);
      const slice = logs.slice(i, windowEnd);

      let patternIdx = 0;
      let minCount = 1;

      for (let j = 0; j < slice.length && patternIdx < pattern.sequence.length; j++) {
        const step = pattern.sequence[patternIdx];
        const log = slice[j];
        const toolName = log.toolName;

        if (step.toolNamePattern.test(toolName)) {
          // Check parameter pattern if specified
          if (step.parameterPattern && log.responseContent) {
            // Check if the tool's response content hints at the targeted parameter
            if (!step.parameterPattern.test(log.responseContent)) {
              continue; // Doesn't match parameter constraint
            }
          }
          invocationIds.push(slice[j].toolName);
          minCount = step.minCount ?? 1;
          if (--minCount <= 0) {
            patternIdx++;
            minCount = 1;
          }
        }
      }

      if (patternIdx >= pattern.sequence.length) {
        return { detected: true, invocationIds };
      }
    }

    return { detected: false, invocationIds: [] };
  }

  // ── Permission Model (P8) ─────────────────────────────────────────

  /**
   * Snapshot the current tool permissions for a session.
   * Stores the set of tools that were available at session registration time,
   * so mid-session additions can be detected and denied.
   */
  async snapshotPermissions(
    sessionId: string,
    tools: Array<{ name: string }>,
    serverUrl: string,
  ): Promise<void> {
    const supabase = createServiceClient();
    const permissionRows = tools.map(tool => ({
      session_id: sessionId,
      tool_name: tool.name,
      server_url: serverUrl,
      permitted_at: new Date().toISOString(),
    }));

    if (permissionRows.length === 0) return;

    const { error } = await supabase.from('session_permissions').insert(permissionRows);
    if (error) {
      console.error('[session-watchdog] Failed to snapshot permissions:', error.message);
    }
  }

  /**
   * Check if a tool is permitted for a session.
   * Returns false if the tool was added after session start, or was revoked.
   */
  async isToolPermitted(sessionId: string, toolName: string): Promise<boolean> {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('session_permissions')
        .select('revoked_at')
        .eq('session_id', sessionId)
        .eq('tool_name', toolName)
        .maybeSingle();

      if (error || !data) return false; // Tool not in snapshot = added after session start = DENIED
      if (data.revoked_at !== null) return false; // Revoked = DENIED
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deny specific tools for a session (mark as revoked).
   */
  async denyTools(sessionId: string, toolNames: string[], reason: string): Promise<void> {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    for (const toolName of toolNames) {
      const { error } = await supabase.from('session_permissions').upsert({
        session_id: sessionId,
        tool_name: toolName,
        server_url: '',
        permitted_at: now,
        revoked_at: now,
        revoke_reason: reason,
      }, {
        onConflict: 'session_id, tool_name, server_url',
        ignoreDuplicates: false,
      });
      if (error) {
        console.error(`[session-watchdog] Failed to deny tool ${toolName}:`, error.message);
      }
    }
  }

  /**
   * After detecting a tool hash drift, check which tools were added or removed
   * and update the permission snapshot accordingly.
   */
  async reconcilePermissions(
    sessionId: string,
    currentTools: Array<{ name: string }>,
    serverUrl: string,
  ): Promise<void> {
    const supabase = createServiceClient();

    // Get originally permitted tool names
    const { data: originalPermissions } = await supabase
      .from('session_permissions')
      .select('tool_name')
      .eq('session_id', sessionId)
      .is('revoked_at', null);

    const originalToolNames = new Set(originalPermissions?.map(p => p.tool_name) ?? []);
    const currentToolNames = new Set(currentTools.map(t => t.name));

    // Detect newly added tools
    const addedTools = [...currentToolNames].filter(t => !originalToolNames.has(t));
    // Detect removed tools
    const removedTools = [...originalToolNames].filter(t => !currentToolNames.has(t));

    if (addedTools.length > 0) {
      await this.recordAnomaly(sessionId, {
        anomalyType: 'NEW_TOOLS_ADDED',
        severity: 'HIGH',
        detail: `${addedTools.length} new tools appeared mid-session: ${addedTools.join(', ')}`,
      });
      await this.denyTools(sessionId, addedTools, 'Added after session start');
    }

    if (removedTools.length > 0) {
      await supabase
        .from('session_permissions')
        .update({ revoked_at: new Date().toISOString(), revoke_reason: 'Tool removed from server' })
        .eq('session_id', sessionId)
        .in('tool_name', removedTools);
    }
  }

  /**
   * Record an anomaly directly (internal helper for permission reconciliation).
   */
  private async recordAnomaly(
    sessionId: string,
    anomaly: { anomalyType: string; severity: string; detail: string },
  ): Promise<void> {
    try {
      const supabase = createServiceClient();
      await supabase.from('session_anomalies').insert({
        session_id: sessionId,
        anomaly_type: anomaly.anomalyType,
        severity: anomaly.severity,
        detail: anomaly.detail,
        auto_killed: false,
      });
    } catch (err) {
      console.error('[session-watchdog] Failed to record anomaly:', err);
    }
  }

  /**
   * Detect if the tool hash has drifted since session registration.
   * Uses the lightweight probe (tools/list only).
   */
  private async detectToolHashDrift(sessionId: string): Promise<boolean> {
    try {
      const supabase = createServiceClient();
      const { data: session, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !session) return false;

      let currentHash: string | null = null;

      try {
        const raw = await this.fetchToolsList(session.server_url, 10_000);
        const tools = (raw as Array<{ name: string; description?: string; inputSchema?: unknown }>) ?? [];
        currentHash = this.hashTools(tools);
      } catch {
        return false;
      }

      if (!currentHash || !session.initial_tool_hash) return false;

      return currentHash !== session.initial_tool_hash;
    } catch (err) {
      console.error('[session-watchdog] detectToolHashDrift error:', err);
      return false;
    }
  }

  /**
   * Detect behavior anomalies by comparing recent invocations against the baseline.
   */
  private async detectBehaviorAnomalies(sessionId: string): Promise<AnomalyResult[]> {
    try {
      // Get recent invocation logs for this session (last hour)
      const logs = await getSessionLogs(sessionId, 200);
      if (logs.length < 3) return []; // need at least 3 calls for a baseline

      // Build baseline from first 10 invocations
      const baseline = buildBaseline(
        logs.slice(0, 10).map(l => ({
          toolName: l.toolName,
          parameters: l.parameters,
          responseSize: Buffer.byteLength(l.responseContent || '', 'utf8'),
          timestamp: '',
        })),
        10,
      );

      // Use last 50 calls for anomaly detection
      const recentInvocations = logs.slice(0, 50);

      const anomalies = detectAnomalies(
        baseline,
        recentInvocations.map(l => ({
          toolName: l.toolName,
          parameters: l.parameters,
          responseSize: Buffer.byteLength(l.responseContent || '', 'utf8'),
          timestamp: '',
        })),
      );

      return anomalies.map((a: AnomalyScore) => ({
        id: '',
        anomalyType: a.type,
        severity: a.severity,
        detail: a.detail,
        detectedAt: new Date().toISOString(),
        autoKilled: false,
      }));
    } catch (err) {
      console.error('[session-watchdog] detectBehaviorAnomalies error:', err);
      return [];
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────

let globalWatchdog: SessionWatchdog | null = null;

export function getWatchdog(config?: Partial<WatchdogConfig>): SessionWatchdog {
  if (!globalWatchdog) {
    globalWatchdog = new SessionWatchdog(config);
  }
  return globalWatchdog;
}
