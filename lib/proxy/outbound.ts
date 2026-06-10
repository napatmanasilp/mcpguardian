import { ProxyFlag, JsonRpcRequest, JsonRpcResponse, ProxyMode } from './types';
import { logInvocation, generateSessionId, type ResponseFlag } from '@/lib/monitor/invocation-logger';
import { scanResponse as scanResponseContent, type ResponseScanResult } from '@/lib/proxy/response-interceptor';
import { validateOutboundToken, scanResponseForTokens, type TokenGuardResult } from '@/lib/proxy/token-guard';
import { createSseInterceptor } from '@/lib/proxy/sse-interceptor';
import { type SamplingInspectionResult } from '@/lib/proxy/sampling-inspector';

/**
 * Track session-level context for invocation source classification.
 * If the previous response had injection flags, mark the next tool call
 * as 'response_triggered' for forensic traceability.
 */
const sessionLastResponseFlags = new Map<string, { flags: string[]; lastInvocationId?: string }>();

export function setSessionLastResponseFlags(
  sessionId: string,
  flags: string[],
  lastInvocationId?: string,
): void {
  sessionLastResponseFlags.set(sessionId, { flags, lastInvocationId });
}

export function getSessionInvocationSource(
  sessionId: string,
): { source: 'user_initiated' | 'agent_planned' | 'response_triggered' | 'unknown'; parentInvocationId?: string } {
  const entry = sessionLastResponseFlags.get(sessionId);
  if (entry && entry.flags.some(f => f === 'INSTRUCTION_OVERRIDE' || f === 'EXFILTRATION_ATTEMPT')) {
    return {
      source: 'response_triggered',
      parentInvocationId: entry.lastInvocationId,
    };
  }
  return { source: 'unknown' };
}


const SSRF_PATTERNS = [
  { type: 'CLOUD_METADATA', re: /169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200/i },
  { type: 'LOCALHOST', re: /localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|\[::1\]/i },
  { type: 'INTERNAL_IP_10', re: /10\.\d{1,3}\.\d{1,3}\.\d{1,3}/ },
  { type: 'INTERNAL_IP_172', re: /172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/ },
  { type: 'INTERNAL_IP_192', re: /192\.168\.\d{1,3}\.\d{1,3}/ },
  { type: 'INTERNAL_IP_169', re: /169\.254\.\d{1,3}\.\d{1,3}/ },
  { type: 'PATH_TRAVERSAL_ENCODED', re: /%2e%2e/i },
];

const INJECTION_PATTERNS = [
  /[;&|`]/,
  /\$\(.*?\)/,
  /\$\{.*?\}/,
  /\|\|/,
  /&&/,
];

const PATH_TRAVERSAL = [
  /\.\.[/\\]/,
  /\.\.\\/,
];

function isUrlArg(argName: string): boolean {
  const lower = argName.toLowerCase();
  return lower.includes('url') ||
    lower.includes('uri') ||
    lower.includes('path') ||
    lower.includes('host') ||
    lower.includes('endpoint') ||
    lower.includes('domain') ||
    lower.includes('link') ||
    lower.includes('webhook');
}

export function inspectOutboundRequest(
  request: JsonRpcRequest,
): ProxyFlag[] {
  const flags: ProxyFlag[] = [];

  if (request.method !== 'tools/call') return flags;
  if (!request.params || typeof request.params !== 'object') return flags;

  const args = (request.params as Record<string, unknown>).arguments ?? (request.params as Record<string, unknown>).args;
  if (!args || typeof args !== 'object') return flags;

  const argEntries = Object.entries(args as Record<string, unknown>);

  for (const [key, value] of argEntries) {
    if (typeof value !== 'string') continue;

    // ── Credential patterns ──────────────────────────────────────────
    const credPatterns = [
      { pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/, name: 'GitHub Token' },
      { pattern: /sk-[a-zA-Z0-9]{32,}/, name: 'OpenAI API Key' },
      { pattern: /AIza[0-9A-Za-z_-]{35}/, name: 'Google API Key' },
      { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },
      { pattern: /hf_[a-zA-Z0-9]{32,}/, name: 'HuggingFace Token' },
      { pattern: /xox[baprs]-[0-9a-zA-Z-]{24,}/, name: 'Slack Token' },
    ];

    for (const cp of credPatterns) {
      if (cp.pattern.test(value)) {
        flags.push({
          type: 'CREDENTIAL_IN_ARGUMENT',
          severity: 'CRITICAL',
          title: `Credential detected in tool argument: ${cp.name}`,
          description: `Argument "${key}" contains a ${cp.name} (${value.slice(0, 12)}...). This will be sent to the upstream MCP server and logged.`,
          blocked: false,
        });
      }
    }

    // ── SSRF — cloud metadata checked first (more specific) ──────────
    if (isUrlArg(key)) {
      let matchedSsrf: string | null = null;

      for (const sp of SSRF_PATTERNS) {
        if (sp.re.test(value)) {
          matchedSsrf = sp.type;
          break;
        }
      }

      if (matchedSsrf === 'CLOUD_METADATA') {
        flags.push({
          type: 'SSRF_ATTEMPT',
          severity: 'CRITICAL',
          title: 'SSRF attempt — cloud metadata endpoint in tool argument',
          description: `Argument "${key}" references cloud metadata endpoint "${value}". Attackers use this to steal cloud instance credentials (IMDS attack).`,
          blocked: true,
        });
      } else if (matchedSsrf === 'LOCALHOST') {
        flags.push({
          type: 'SSRF_ATTEMPT',
          severity: 'CRITICAL',
          title: 'SSRF attempt — localhost reference in tool argument',
          description: `Argument "${key}" references localhost "${value}". MCP tools should not access loopback addresses.`,
          blocked: true,
        });
      } else if (matchedSsrf && matchedSsrf.startsWith('INTERNAL_IP')) {
        flags.push({
          type: 'SSRF_ATTEMPT',
          severity: 'CRITICAL',
          title: 'SSRF attempt — internal IP address in tool argument',
          description: `Argument "${key}" contains internal IP address "${value}" which references a private network. MCP servers should not access internal infrastructure.`,
          blocked: true,
        });
      }
    }

    // ── Injection patterns ───────────────────────────────────────────
    for (const injRe of INJECTION_PATTERNS) {
      if (injRe.test(value)) {
        flags.push({
          type: 'INJECTION_ATTEMPT',
          severity: 'CRITICAL',
          title: 'Command injection attempt detected in tool argument',
          description: `Argument "${key}" contains shell metacharacters matching "${injRe.source}". This may be an attempt to execute arbitrary commands on the MCP server host.`,
          blocked: true,
        });
        break;
      }
    }

    for (const ptRe of PATH_TRAVERSAL) {
      if (ptRe.test(value)) {
        flags.push({
          type: 'INJECTION_ATTEMPT',
          severity: 'CRITICAL',
          title: 'Path traversal attempt detected in tool argument',
          description: `Argument "${key}" contains path traversal sequence "${ptRe.source}". This may be an attempt to read files outside allowed directories.`,
          blocked: true,
        });
      }
    }
  }

  return flags;
}

export function buildSanitizedRequest(
  request: JsonRpcRequest,
  flags: ProxyFlag[],
): JsonRpcRequest {
  const hasBlocked = flags.some(f => f.type === 'SSRF_ATTEMPT' || f.type === 'INJECTION_ATTEMPT');
  if (!hasBlocked) return request;

  return {
    ...request,
    params: {
      ...request.params,
      arguments: { _blocked: 'Request blocked by MCPGuardian proxy — flagged arguments were removed' },
      args: undefined,
    },
  };
}

/**
 * Scan a tool response for injection, PII, and exfiltration.
 * Delegates to response-interceptor.ts. Convenience wrapper for outbound.ts import chain.
 * Also checks if response Content-Type is text/event-stream and wraps with SSE interceptor.
 */
export function scanToolResponse(
  responseResult: Record<string, unknown> | undefined,
  mode: ProxyMode,
  serverDomain?: string,
): ResponseScanResult {
  return scanResponseContent(responseResult, mode, serverDomain);
}

/**
 * Wrap a Response with SSE interception if its Content-Type is text/event-stream.
 * This enables inspection of MCP sampling requests flowing through the proxy.
 */
export function maybeInterceptSseStream(
  response: Response,
  mode: ProxyMode,
  sessionId: string,
  onFlagsRaised?: (result: SamplingInspectionResult) => void,
): Response {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) return response;
  if (mode === 'off' || !response.body) return response;

  const interceptedStream = createSseInterceptor(
    response.body,
    mode,
    (result) => {
      if (onFlagsRaised) {
        onFlagsRaised(result);
      }
    },
  );

  return new Response(interceptedStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Validate an outbound auth token before forwarding to an MCP server.
 * Delegates to token-guard.ts. Convenience wrapper for outbound.ts import chain.
 */
export function validateToolToken(
  authHeader: string | undefined,
  targetServerUrl: string,
): TokenGuardResult {
  return validateOutboundToken(authHeader, targetServerUrl);
}

/**
 * Scan a response body for leaked or echoed-back tokens.
 * Delegates to token-guard.ts. Convenience wrapper for outbound.ts import chain.
 */
export function scanToolResponseForTokens(
  responseContent: string,
  requestAuthHeader: string | undefined,
  serverUrl?: string,
): TokenGuardResult {
  return scanResponseForTokens(responseContent, requestAuthHeader, serverUrl);
}

/**
 * Log a complete tool invocation (request + response) to Supabase.
 * Fire-and-forget: never throws, never blocks the proxy.
 * Call this after the response has been inspected and sanitized.
 */
export async function logOutboundToolCall(
  request: JsonRpcRequest,
  response: JsonRpcResponse,
  flags: ProxyFlag[],
  sessionId: string,
  mode: ProxyMode,
  serverUrl: string = '',
  latencyMs: number = 0,
  userId?: string,
  invocationSource?: 'user_initiated' | 'agent_planned' | 'response_triggered' | 'unknown',
  parentInvocationId?: string,
): Promise<void> {
  if (request.method !== 'tools/call') return;

  const toolName =
    (request.params as Record<string, string | undefined> | undefined)?.name ?? 'unknown';
  const args =
    (request.params as Record<string, unknown> | undefined)?.arguments ??
    (request.params as Record<string, unknown> | undefined)?.args ??
    {};

  const responseContent = response.result
    ? JSON.stringify(response.result)
    : JSON.stringify(response.error ?? {});

  // Convert ProxyFlag[] to ResponseFlag[] (they share the same shape)
  const responseFlags: ResponseFlag[] = flags.map(f => ({
    type: f.type,
    severity: f.severity,
    title: f.title,
    description: f.description,
    blocked: f.blocked,
  }));

  const blocked = flags.some(f => f.blocked);

  await logInvocation({
    sessionId,
    userId,
    serverUrl,
    toolName,
    parameters: args as Record<string, unknown>,
    responseContent,
    latencyMs,
    responseFlags,
    proxyMode: mode,
    blocked,
    invocationSource,
    parentInvocationId,
  });
}
