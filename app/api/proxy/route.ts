import { NextRequest, NextResponse } from 'next/server';
import { createSession, logToolCall, detectExfiltrationSequence } from '@/lib/proxy/session';
import { inspectOutboundRequest, buildSanitizedRequest, logOutboundToolCall, scanToolResponse } from '@/lib/proxy/outbound';
import { validateOutboundToken, scanResponseForTokens, TOKEN_DETECTION_PATTERNS } from '@/lib/proxy/token-guard';
import { checkAllowlist } from '@/lib/registry/allowlist-manager';
import { inspectInboundResponse } from '@/lib/proxy/inbound';
import { ProxyConfig, ProxyMode, JsonRpcRequest, JsonRpcResponse, ProxyFlag } from '@/lib/proxy/types';
import { validateApiKey } from '@/lib/api-key-auth';
import { generateSessionId } from '@/lib/monitor/invocation-logger';
import { getWatchdog, isSessionTerminated } from '@/lib/monitor/session-watchdog';

const DEFAULT_CONFIG: ProxyConfig = { mode: 'monitor' };
const VALID_MODES: ProxyMode[] = ['monitor', 'block', 'off'];

function extractMode(raw: string | null | undefined): ProxyMode | undefined {
  return (raw && VALID_MODES.includes(raw as ProxyMode)) ? raw as ProxyMode : undefined;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const upstreamUrl = request.nextUrl.searchParams.get('upstream');
  if (!upstreamUrl) {
    return NextResponse.json(
      { error: 'Missing upstream URL. Use ?upstream=<MCP_SERVER_URL>' },
      { status: 400 },
    );
  }

  let bodyRaw: Record<string, unknown>;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON-RPC body' }, { status: 400 });
  }

  if (bodyRaw.jsonrpc !== '2.0' || !bodyRaw.method) {
    return NextResponse.json({ error: 'Not a valid JSON-RPC 2.0 request' }, { status: 400 });
  }

  // ── API key auth ───────────────────────────────────────────────────
  const apiKeyResult = await validateApiKey(request);
  if (apiKeyResult) {
    // Attach user info for downstream session tracking
  }
  // fall back to session auth (no-op if neither — existing code handles 401 downstream)

  // ── Resolve mode (priority: header > query > body > default) ──────
  const headerMode = request.headers.get('X-MCPGuardian-Mode');
  const queryMode = request.nextUrl.searchParams.get('mode');
  const bodyMode = typeof bodyRaw.mode === 'string' ? bodyRaw.mode : undefined;

  const exactSource = headerMode ?? queryMode ?? bodyMode;
  if (exactSource && !(VALID_MODES as string[]).includes(exactSource)) {
    return NextResponse.json(
      { error: "Invalid mode. Must be 'monitor', 'block', or 'off'" },
      { status: 400 },
    );
  }

  const mode: ProxyMode = extractMode(headerMode) ?? extractMode(queryMode) ?? extractMode(bodyMode) ?? DEFAULT_CONFIG.mode;

  // ── Strip mode from body before forwarding ────────────────────────
  if ('mode' in bodyRaw) {
    const { mode: _discard, ...cleaned } = bodyRaw;
    bodyRaw = cleaned as Record<string, unknown>;
  }
  const body: JsonRpcRequest = bodyRaw as unknown as JsonRpcRequest;

  const config: ProxyConfig = { mode };

  // ═══════════════ OFF MODE — bypass all inspection ═══════════════════
  if (mode === 'off') {
    const fetchStart = Date.now();
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('authorization')
            ? { authorization: request.headers.get('authorization')! }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      const errorBody: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: `Proxy error: upstream MCP server at ${upstreamUrl} is unreachable or returned an invalid response` },
      };
      const latencyMs = Date.now() - fetchStart;
      return NextResponse.json(
        { ...errorBody, _mcpguardian: { mode: 'off', flagsRaised: [], latencyMs, proxy_overhead_ms: 0 } },
        { status: 502 },
      );
    }
    const latencyMs = Date.now() - fetchStart;
    const responseBody = await upstreamResponse.json();
    return NextResponse.json(
      {
        ...responseBody,
        _mcpguardian: { mode: 'off', flagsRaised: [], latencyMs, proxy_overhead_ms: 0 },
      },
      { status: upstreamResponse.status },
    );
  }

  // ═══════════════ MONITOR / BLOCK MODE ═══════════════════════════════

  // ── Allowlist check (runs BEFORE session creation to fail fast) ───
  const orgId = request.headers.get('X-MCP-Organization-ID') ??
    request.nextUrl.searchParams.get('organization_id');
  if (orgId && mode === 'block') {
    try {
      const allowlistResult = await checkAllowlist(orgId, upstreamUrl);
      if (!allowlistResult.allowed) {
        return NextResponse.json(
          {
            error: 'SERVER_NOT_ALLOWLISTED',
            message: allowlistResult.message,
            enforcement_mode: allowlistResult.enforcementMode,
            status: allowlistResult.status,
            server_url: upstreamUrl,
            action: 'Submit server for approval at /api/registry/submit',
          },
          {
            status: 403,
            headers: {
              'X-MCPGuardian-Block-Reason': 'ALLOWLIST_ENFORCEMENT',
              'X-MCPGuardian-Server-Status': allowlistResult.status ?? 'not_registered',
            },
          },
        );
      }
    } catch {
      // Allowlist check failed in block mode — reject to be safe
      return NextResponse.json(
        {
          error: 'ALLOWLIST_CHECK_FAILED',
          message: 'Allowlist check encountered an error — rejecting connection in block mode',
          server_url: upstreamUrl,
        },
        { status: 503 },
      );
    }
  }

  const session = createSession(upstreamUrl, config);

  // ── Kill switch check ─────────────────────────────────────────────
  const killCheck = isSessionTerminated(session.session_id);
  if (killCheck.terminated) {
    return NextResponse.json(
      {
        error: 'SESSION_TERMINATED',
        reason: killCheck.reason,
        sessionId: session.session_id,
      },
      { status: 503 },
    );
  }

  const allFlags: ProxyFlag[] = [];

  // ── Outbound inspection ───────────────────────────────────────────
  const outboundFlags = inspectOutboundRequest(body);
  allFlags.push(...outboundFlags);

  // ── Allowlist warning in monitor mode (after session created) ─────
  if (orgId && mode !== 'block') {
    try {
      const allowlistResult = await checkAllowlist(orgId, upstreamUrl);
      if (!allowlistResult.allowed || allowlistResult.status === 'not_registered' ||
          allowlistResult.enforcementMode === 'warn') {
        allFlags.push({
          type: 'SERVER_NOT_ALLOWLISTED',
          severity: allowlistResult.allowed ? 'MEDIUM' : 'HIGH',
          title: 'Server allowlist status',
          description: allowlistResult.message,
          blocked: false,
        });
      }
    } catch {
      allFlags.push({
        type: 'SERVER_NOT_ALLOWLISTED',
        severity: 'MEDIUM',
        title: 'Allowlist check failed',
        description: 'Allowlist check encountered an error — allowing connection but flagging for review',
        blocked: false,
      });
    }
  }

  // ── Token guard: validate outbound auth token ─────────────────────
  const tokenResult = validateOutboundToken(
    request.headers.get('authorization') ?? undefined,
    upstreamUrl,
  );
  if (!tokenResult.safe) {
    for (const f of tokenResult.findings) {
      allFlags.push({
        type: f.type,
        severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        title: `${f.type.replace(/_/g, ' ')} detected`,
        description: f.detail,
        blocked: f.severity === 'CRITICAL',
      });
    }
  }

  // Check all outbound findings (including token guard) for blocked CRITICALs
  const criticalBlocked = allFlags.filter(f => f.blocked);
  const shouldBlock = mode === 'block' && criticalBlocked.length > 0;

  let upstreamResponse: Response | undefined;
  let responseBody: JsonRpcResponse;
  let latencyMs = 0;

  if (shouldBlock) {
    // Return 403 without forwarding — SSRF / injection blocked
    const firstFlag = criticalBlocked[0];
    const proxy_overhead_ms = Date.now() - startTime;
    return NextResponse.json(
      { blocked: true, reason: firstFlag.type, details: firstFlag.description },
      {
        status: 403,
        headers: {
          'x-proxy-mode': mode,
          'x-proxy-flags': criticalBlocked.map(f => `${f.type}:${f.severity}`).join(','),
        },
      },
    );
  }

  // ── Forward to upstream MCP server ────────────────────────────────
  const forwardedBody = mode === 'block'
    ? buildSanitizedRequest(body, outboundFlags)
    : body;

  const fetchStart = Date.now();
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { authorization: request.headers.get('authorization')! }
          : {}),
      },
      body: JSON.stringify(forwardedBody),
      signal: AbortSignal.timeout(30000),
    });

    latencyMs = Date.now() - fetchStart;
    responseBody = await upstreamResponse.json();

    // ── Inbound inspection ──────────────────────────────────────────
    if (body.method === 'tools/call') {
      const { flags: inboundFlags, sanitizedResponse } = inspectInboundResponse(responseBody);
      allFlags.push(...inboundFlags);

      if (inboundFlags.length > 0) {
        responseBody = sanitizedResponse;
      }

      // ── Runtime response content scan ──────────────────────────────
      const serverDomain = upstreamUrl ? new URL(upstreamUrl).hostname : undefined;
      const responseScan = scanToolResponse(responseBody.result, mode, serverDomain);
      if (!responseScan.clean) {
        for (const flag of responseScan.flags) {
          allFlags.push({
            type: flag.type,
            severity: flag.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            title: `${flag.type} detected`,
            description: `Matched "${flag.matchedPattern}" at position ${flag.position}`,
            blocked: flag.severity === 'CRITICAL',
          });
        }
        if (mode === 'block' && responseScan.sanitizedContent) {
          responseBody = {
            ...responseBody,
            result: {
              ...responseBody.result,
              content: [{ type: 'text', text: responseScan.sanitizedContent }],
            },
          };
        }
      }

      // ── Token guard: scan response for token leaks ────────────────
      const responseTokenResult = scanResponseForTokens(
        JSON.stringify(responseBody),
        request.headers.get('authorization') ?? undefined,
        upstreamUrl,
      );
      if (!responseTokenResult.safe) {
        for (const f of responseTokenResult.findings) {
          allFlags.push({
            type: f.type,
            severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
            title: `${f.type.replace(/_/g, ' ')} detected`,
            description: f.detail,
            blocked: f.severity === 'CRITICAL',
          });
        }

        // In block mode, redact matched tokens from the response body
        if (mode === 'block' && responseBody.result) {
          const bodyStr = JSON.stringify(responseBody);
          // Redact token matches using the shared patterns from token-guard.ts
          const redacted = bodyStr
            .replace(TOKEN_DETECTION_PATTERNS.bearerHeader, 'Bearer [TOKEN_REDACTED]')
            .replace(TOKEN_DETECTION_PATTERNS.githubPat, '[TOKEN_REDACTED]')
            .replace(TOKEN_DETECTION_PATTERNS.openaiKey, '[TOKEN_REDACTED]')
            .replace(TOKEN_DETECTION_PATTERNS.jwtToken, '[TOKEN_REDACTED]');
          if (redacted !== bodyStr) {
            try {
              responseBody = JSON.parse(redacted);
            } catch {
              // If redaction corrupts JSON, keep original but still flag it
            }
          }
        }
      }

      const toolArgs = body.params?.arguments ?? body.params?.args;
      logToolCall(
        session,
        (body.params as Record<string, string | undefined> | undefined)?.name ?? 'unknown',
        toolArgs,
        responseBody.result,
        inboundFlags,
      );

      // Register the proxy session (fire-and-forget)
      if (upstreamUrl) {
        getWatchdog().registerSession(
          upstreamUrl,
          '', // tool hash not available at runtime — updated on next rescan
          '', // userId not tracked in this path
          session.session_id,
        ).catch(() => {});
      }

      // Persist to Supabase (fire-and-forget — intentionally not awaited)
      logOutboundToolCall(
        body,
        responseBody,
        allFlags,
        session.session_id,
        mode,
        upstreamUrl,
        latencyMs,
        undefined, // userId is not tracked in this path
      );
    }
  } catch {
    latencyMs = Date.now() - fetchStart;
    responseBody = {
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32000, message: `Proxy error: upstream MCP server at ${upstreamUrl} is unreachable or returned an invalid response` },
    };
  }

  // ── Exfiltration sequence detection ────────────────────────────────
  const exfilFlag = detectExfiltrationSequence(session);
  if (exfilFlag) allFlags.push(exfilFlag);

  // ── Build response ─────────────────────────────────────────────────
  const proxyHeaders: Record<string, string> = {
    'x-proxy-session-id': session.session_id,
    'x-proxy-mode': mode,
  };

  if (allFlags.length > 0) {
    proxyHeaders['x-proxy-flags'] = allFlags.map(f => `${f.type}:${f.severity}`).join(',');
    proxyHeaders['x-proxy-warning'] = allFlags.map(f => f.title).join(' | ');
  }

  const proxy_overhead_ms = (Date.now() - startTime) - latencyMs;

  const responseScanResult = body.method === 'tools/call' && upstreamUrl
    ? scanToolResponse(responseBody.result, mode, new URL(upstreamUrl).hostname)
    : { clean: true, flags: [], sanitizedContent: undefined, scanLatencyMs: 0 };

  // Compute inbound token scan result once (avoid redundant calls)
  const inboundTokenResult = body.method === 'tools/call'
    ? scanResponseForTokens(JSON.stringify(responseBody), request.headers.get('authorization') ?? undefined, upstreamUrl)
    : { safe: true, findings: [] };

  const proxyMetadata: Record<string, unknown> = {
    mode,
    flagsRaised: allFlags.map(f => ({ type: f.type, severity: f.severity, title: f.title })),
    sessionId: session.session_id,
    latencyMs,
    proxy_overhead_ms,
    response_scan: {
      clean: responseScanResult.clean,
      flags: responseScanResult.flags.map(f => ({
        type: f.type,
        severity: f.severity,
        matchedPattern: f.matchedPattern,
      })),
      scan_latency_ms: responseScanResult.scanLatencyMs,
    },
    token_guard: {
      outbound_safe: tokenResult.safe,
      outbound_findings: tokenResult.findings,
      inbound_safe: inboundTokenResult.safe,
      inbound_findings: inboundTokenResult.findings,
    },
  };

  return NextResponse.json(
    {
      ...responseBody,
      _mcpguardian: proxyMetadata,
    },
    {
      status: upstreamResponse?.status ?? 200,
      headers: proxyHeaders,
    },
  );
}
