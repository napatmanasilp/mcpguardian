import { createHash } from 'crypto';
import { ProxyConfig, ProxyFlag, ProxySession, ToolCallLog } from './types';

const sessions = new Map<string, ProxySession>();

const EXFILTRATION_SEQUENCE = ['read_file', 'encode', 'http_request'];

export function createSession(upstreamUrl: string, config: ProxyConfig): ProxySession {
  const sessionId = createHash('sha256')
    .update(`${upstreamUrl}-${Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 16);

  const session: ProxySession = {
    session_id: sessionId,
    upstream_url: upstreamUrl,
    tool_call_logs: [],
    config,
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): ProxySession | undefined {
  return sessions.get(sessionId);
}

function hashJson(data: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 12);
}

export function logToolCall(
  session: ProxySession,
  toolName: string,
  args: unknown,
  response: unknown,
  flags: ProxyFlag[],
): ToolCallLog {
  const log: ToolCallLog = {
    timestamp: new Date().toISOString(),
    tool_name: toolName,
    arguments_hash: hashJson(args),
    response_hash: hashJson(response),
    flags_raised: flags,
  };
  session.tool_call_logs.push(log);
  return log;
}

export function detectExfiltrationSequence(session: ProxySession): ProxyFlag | null {
  const logs = session.tool_call_logs;
  if (logs.length < 3) return null;

  for (let i = 2; i < logs.length; i++) {
    const names = [logs[i - 2].tool_name, logs[i - 1].tool_name, logs[i].tool_name];

    const matches = EXFILTRATION_SEQUENCE.every((expected, j) => {
      const actual = names[j].toLowerCase();
      return actual.includes(expected) || expected.includes(actual);
    });

    if (matches) {
      return {
        type: 'EXFILTRATION_SEQUENCE_DETECTED',
        severity: 'CRITICAL',
        title: 'Exfiltration sequence detected — read_file → encode → http_request',
        description: `Tool call sequence ${logs[i - 2].tool_name} → ${logs[i - 1].tool_name} → ${logs[i].tool_name} matches known data exfiltration pattern (read then encode then exfiltrate).`,
        blocked: false,
      };
    }
  }

  return null;
}
