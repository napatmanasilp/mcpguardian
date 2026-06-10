import { createHash, randomUUID, createCipheriv, randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ───────────────────────────────────────────────────────────

export interface ResponseFlag {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  blocked: boolean;
}

export interface InvocationRecord {
  sessionId: string;
  userId?: string;
  serverUrl: string;
  toolName: string;
  parameters: Record<string, unknown>;
  responseContent: string;
  latencyMs: number;
  responseFlags: ResponseFlag[];
  proxyMode: 'monitor' | 'block' | 'off';
  blocked: boolean;
  invocationSource?: 'user_initiated' | 'agent_planned' | 'response_triggered' | 'unknown';
  parentInvocationId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const SENSITIVE_KEY_RE = /password|secret|token|key|auth|credential/i;

/**
 * Mask sensitive parameter values before hashing/storing.
 * Replaces values for keys matching password|secret|token|key|auth|credential.
 */
function maskSensitiveParams(params: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_KEY_RE.test(key) && typeof value === 'string') {
      masked[key] = '[MASKED]';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Compute SHA-256 hex digest of a JSON-serialized value.
 */
function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

/**
 * Generate a random session ID using crypto.randomUUID.
 */
export function generateSessionId(): string {
  return randomUUID();
}

// ─── Forensic Content Storage (Opt-In, P9) ─────────────────────────

/**
 * Store encrypted invocation content for post-breach forensic analysis.
 * Only active when GUARDIAN_FORENSIC_MODE is enabled and encryption key is configured.
 * Content is AES-256-GCM encrypted before storage.
 */
export async function storeEncryptedContent(
  invocationId: string,
  content: string,
  contentType: 'request_params' | 'response_body',
): Promise<void> {
  const keyHex = process.env.GUARDIAN_FORENSIC_KEY;
  if (!keyHex) return; // Silently skip if not configured

  try {
    const key = Buffer.from(keyHex, 'hex'); // 32 bytes for AES-256
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(content, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    // Append auth tag to ciphertext: base64(iv):base64(ciphertext+tag)
    const payload = `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;

    const supabase = createServiceClient();
    await supabase.from('invocation_content_store').insert({
      invocation_id: invocationId,
      content_type: contentType,
      content_encrypted: payload,
      content_size: Buffer.byteLength(content, 'utf8'),
      iv: iv.toString('base64'),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[invocation-logger] Failed to store encrypted content:', err instanceof Error ? err.message : String(err));
  }
}

// ─── Main Logger ─────────────────────────────────────────────────────

/**
 * Log a single tool invocation to Supabase.
 * Fire-and-forget: never throws, never blocks the proxy.
 */
export async function logInvocation(record: InvocationRecord): Promise<void> {
  const maskedParams = maskSensitiveParams(record.parameters);

  const parameterHash = hashValue(maskedParams);
  const responseHash = hashValue(record.responseContent);
  const responseSize = Buffer.byteLength(record.responseContent, 'utf8');

  const supabase = createServiceClient();

  try {
    const { data: insertResult, error } = await supabase.from('tool_invocation_logs').insert({
      session_id: record.sessionId,
      user_id: record.userId ?? null,
      server_url: record.serverUrl,
      tool_name: record.toolName,
      parameters: maskedParams,
      parameter_hash: parameterHash,
      response_hash: responseHash,
      response_size: responseSize,
      latency_ms: record.latencyMs,
      response_flags: record.responseFlags,
      proxy_mode: record.proxyMode,
      blocked: record.blocked,
      invocation_source: record.invocationSource ?? 'unknown',
      parent_invocation_id: record.parentInvocationId ?? null,
    }).select('id').maybeSingle();

    if (error) {
      console.error('[invocation-logger] Failed to insert log:', error.message);
      return;
    }

    // ── Forensic content storage (opt-in) ──────────────────────────
    const forensicEnabled = process.env.GUARDIAN_FORENSIC_MODE === 'enabled';
    const onlyForFlagged = process.env.GUARDIAN_FORENSIC_FLAGGED_ONLY !== 'false';
    const hasFlags = record.responseFlags.length > 0;
    const invocationId = insertResult?.id;

    if (forensicEnabled && (!onlyForFlagged || hasFlags) && invocationId) {
      const responseContent = record.responseContent || '';
      if (responseContent.length > 0) {
        await storeEncryptedContent(invocationId, responseContent, 'response_body').catch(() => {});
      }
    }
  } catch (err: unknown) {
    console.error('[invocation-logger] Failed to insert log:', err instanceof Error ? err.message : String(err));
  }
}

// ─── Forensic Timeline ────────────────────────────────────────────────

/**
 * Reconstruct a forensic timeline for a session with causality chains.
 * Returns ordered events with invocation_source linking to parents.
 * Only available when forensic content storage is enabled.
 */
export async function getForensicTimeline(
  sessionId: string,
): Promise<ForensicEvent[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('tool_invocation_logs')
      .select(`
        id,
        created_at,
        tool_name,
        parameters,
        response_hash,
        response_size,
        latency_ms,
        response_flags,
        blocked,
        invocation_source,
        parent_invocation_id,
        invocation_content_store (
          content_type,
          content_encrypted,
          content_size,
          iv,
          created_at
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[forensic] Failed to get timeline:', error.message);
      return [];
    }

    return (data ?? []).map((row: Record<string, unknown>) => {
      const flags = Array.isArray(row.response_flags)
        ? (row.response_flags as Array<{ type: string; severity: string }>)
        : [];
      const criticalFlags = flags.filter(f => f.severity === 'CRITICAL').map(f => f.type);

      return {
        eventId: String(row.id ?? ''),
        timestamp: String(row.created_at ?? ''),
        toolName: String(row.tool_name ?? ''),
        parameters: row.parameters as Record<string, unknown> ?? {},
        responseSize: Number(row.response_size ?? 0),
        latencyMs: Number(row.latency_ms ?? 0),
        flags: flags,
        criticalFlags,
        blocked: Boolean(row.blocked),
        invocationSource: String(row.invocation_source ?? 'unknown') as ForensicEvent['invocationSource'],
        parentInvocationId: row.parent_invocation_id ? String(row.parent_invocation_id) : undefined,
        hasContent: Array.isArray(row.invocation_content_store) && row.invocation_content_store.length > 0,
      };
    });
  } catch (err) {
    console.error('[forensic] Timeline query error:', err);
    return [];
  }
}

export interface ForensicEvent {
  eventId: string;
  timestamp: string;
  toolName: string;
  parameters: Record<string, unknown>;
  responseSize: number;
  latencyMs: number;
  flags: Array<{ type: string; severity: string }>;
  criticalFlags: string[];
  blocked: boolean;
  invocationSource: 'user_initiated' | 'agent_planned' | 'response_triggered' | 'unknown';
  parentInvocationId?: string;
  hasContent: boolean;
}

// ─── Query Helpers ───────────────────────────────────────────────────

export async function getSessionLogs(
  sessionId: string,
  limit: number = 100,
): Promise<InvocationRecord[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('tool_invocation_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[invocation-logger] Failed to query session logs:', error.message);
      return [];
    }

    return (data ?? []).map(mapRowToRecord);
  } catch (err) {
    console.error('[invocation-logger] Query error:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

export async function getServerLogs(
  serverUrl: string,
  limit: number = 50,
): Promise<InvocationRecord[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('tool_invocation_logs')
      .select('*')
      .eq('server_url', serverUrl)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[invocation-logger] Failed to query server logs:', error.message);
      return [];
    }

    return (data ?? []).map(mapRowToRecord);
  } catch (err) {
    console.error('[invocation-logger] Query error:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ─── Row mapping ─────────────────────────────────────────────────────

function mapRowToRecord(row: Record<string, unknown>): InvocationRecord {
  return {
    sessionId: String(row.session_id ?? ''),
    userId: row.user_id ? String(row.user_id) : undefined,
    serverUrl: String(row.server_url ?? ''),
    toolName: String(row.tool_name ?? ''),
    parameters: (row.parameters as Record<string, unknown>) ?? {},
    responseContent: '', // Not stored by default; use getSessionLogs for metadata only
    latencyMs: Number(row.latency_ms ?? 0),
    responseFlags: Array.isArray(row.response_flags)
      ? (row.response_flags as ResponseFlag[])
      : [],
    proxyMode: (row.proxy_mode as 'monitor' | 'block' | 'off') ?? 'monitor',
    blocked: Boolean(row.blocked),
  };
}
