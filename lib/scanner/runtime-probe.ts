import { Issue, ProbedPrompt, ProbedResource, ProbedTool, ProbeResult } from './types';
import { computeToolsHash } from './rug-pull';

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { [key: string]: unknown };
  error?: { code: number; message: string };
  _headers?: Record<string, string>;
  _body?: string;
}

const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0445': 'x', '\u0456': 'i', '\u0455': 's',
  '\u0501': 'd',
  '\u0410': 'A', '\u0415': 'E', '\u041E': 'O', '\u0420': 'P',
  '\u0421': 'C', '\u0425': 'X', '\u0406': 'I', '\u0405': 'S',
  '\u041C': 'M', '\u0422': 'T', '\u041D': 'N',
  '\u0500': 'D',
  '\u0578': 'n', '\u057D': 'u', '\u0548': 'N', '\u054D': 'U',
  '\u028F': 'y',
  '\u0399': 'I', '\u039C': 'M', '\u039F': 'O', '\u0391': 'A',
  '\u03A1': 'P', '\u03A4': 'T', '\u039D': 'N',
};

const HOMOGLYPH_RE = new RegExp(
  Object.keys(HOMOGLYPH_MAP).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);

export function normalizeText(text: string): string {
  let result = text.normalize('NFKC');
  result = result.replace(HOMOGLYPH_RE, ch => HOMOGLYPH_MAP[ch] || ch);
  result = result.replace(/[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u180E]+/g, '');
  result = result.replace(/[\p{Zs}\t\r\n]+/gu, ' ');
  return result.trim();
}

const POISONING_PATTERNS = [
  { pattern: /<IMPORTANT>|<INST>|<SYS>|<\/?s>|\[INST\]|\[SYS\]/i, weight: 40, flag: 'HIDDEN_INSTRUCTION_TAG' },
  { pattern: /~\/\.ssh|id_rsa|id_ed25519|authorized_keys/i, weight: 50, flag: 'SSH_KEY_ACCESS_INSTRUCTION' },
  { pattern: /pass.*as.*param|send.*to.*http|exfil|forward.*key|include.*token/i, weight: 40, flag: 'EXFILTRATION_INSTRUCTION' },
  { pattern: /ignore (previous|prior|above)|disregard.*instruction|override.*system/i, weight: 35, flag: 'SYSTEM_PROMPT_OVERRIDE' },
  { pattern: /\/etc\/passwd|\/etc\/shadow|\.aws\/credentials|\.kube\/config/i, weight: 50, flag: 'SENSITIVE_PATH_INSTRUCTION' },
  { pattern: /base64|atob|btoa|eval\(|fromCharCode/i, weight: 25, flag: 'OBFUSCATED_INSTRUCTION' },
  { pattern: /execute.*command|run.*shell|spawn.*process|child_process/i, weight: 35, flag: 'COMMAND_EXECUTION_INSTRUCTION' },
];

async function sendJsonRpc(url: string, request: JsonRpcRequest, signal: AbortSignal, extraHeaders?: Record<string, string>): Promise<JsonRpcResponse | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(request),
      signal,
    });
    const headers: Record<string, string> = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    }
    const bodyText = typeof res.text === 'function' ? await res.text() : '';
    if (!res.ok) {
      return { jsonrpc: '2.0', id: request.id, error: { code: res.status, message: res.statusText }, _headers: headers, _body: bodyText };
    }
    const parsed = bodyText ? JSON.parse(bodyText) as JsonRpcResponse : await res.json() as JsonRpcResponse;
    parsed._headers = headers;
    parsed._body = bodyText;
    return parsed;
  } catch {
    return null;
  }
}

function scanStdioArgsForHardcodedCredentials(args: string[] | undefined): Issue[] {
  const issues: Issue[] = [];
  if (!args) return issues;
  const credentialFlags = new Set(['--token', '--key', '--secret', '--password']);
  const envVarRe = /^\$[A-Z_][A-Z0-9_]*$|^\$\{[A-Z_][A-Z0-9_]*\}$|^process\.env\.\w+$/i;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const lowerArg = arg.toLowerCase();
    if (credentialFlags.has(lowerArg) && i + 1 < args.length) {
      const value = args[i + 1];
      if (!envVarRe.test(value) && !value.startsWith('$') && !value.includes('${')) {
        issues.push({
          type: 'HARDCODED_CREDENTIAL_IN_ARGS',
          severity: 'CRITICAL',
          title: 'Hardcoded credential in STDIO command arguments',
          description: `Argument "${arg}" has a hardcoded value that is not an environment variable reference`,
          fix: 'Use environment variable references like $TOKEN, ${TOKEN}, or process.env.TOKEN instead of hardcoding secrets in command arguments',
          deduction: 30,
        });
      }
    }
  }
  return issues;
}

function scoreSearchText(searchText: string, description: string): { suspiciousScore: number; flags: string[] } {
  const flags: string[] = [];
  let suspiciousScore = 0;

  const hasInvisibleChars = /[\u200B-\u200D\uFEFF\u00AD]/.test(searchText);
  if (hasInvisibleChars) {
    suspiciousScore += 30;
    flags.push('INVISIBLE_CHARACTERS');
  }

  const normalizedText = normalizeText(searchText);

  for (const { pattern, weight, flag } of POISONING_PATTERNS) {
    if (pattern.test(normalizedText)) {
      suspiciousScore += weight;
      flags.push(flag);
    }
  }

  if (description.length > 1000) {
    suspiciousScore += 20;
    flags.push('UNUSUALLY_LONG_DESCRIPTION');
  }

  suspiciousScore = Math.min(100, suspiciousScore);
  return { suspiciousScore, flags };
}

export function scanToolForPoisoning(tool: { name: string; description: string; inputSchema: unknown }): ProbedTool {
  const searchText = `${tool.name} ${tool.description} ${JSON.stringify(tool.inputSchema ?? {})}`;
  const { suspiciousScore, flags } = scoreSearchText(searchText, tool.description);
  return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema, suspiciousScore, flags };
}

function scanPromptForPoisoning(prompt: { name: string; description: string; arguments: unknown }): ProbedPrompt {
  const searchText = `${prompt.name} ${prompt.description} ${JSON.stringify(prompt.arguments ?? [])}`;
  const { suspiciousScore, flags } = scoreSearchText(searchText, prompt.description);
  return {
    name: prompt.name,
    description: prompt.description,
    argumentsCount: Array.isArray(prompt.arguments) ? prompt.arguments.length : 0,
    suspiciousScore,
    flags,
  };
}

const INTERNAL_IP_RE = /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/;

function scanResourceForExposure(resource: { uri: string; name: string; description: string; mimeType: string }): ProbedResource {
  const flags: string[] = [];
  let suspiciousScore = 0;

  const searchText = `${resource.name} ${resource.description}`;
  const normalizedText = normalizeText(searchText);

  for (const { pattern, weight, flag } of POISONING_PATTERNS) {
    if (pattern.test(normalizedText)) {
      suspiciousScore += weight;
      flags.push(flag);
    }
  }

  if (INTERNAL_IP_RE.test(resource.uri)) {
    suspiciousScore += 35;
    flags.push('INTERNAL_IP_RESOURCE');
  }

  if (resource.uri.startsWith('file://')) {
    suspiciousScore += 15;
    flags.push('FILE_SYSTEM_RESOURCE');
  }

  if (resource.description.length > 1000) {
    suspiciousScore += 20;
    flags.push('UNUSUALLY_LONG_DESCRIPTION');
  }

  suspiciousScore = Math.min(100, suspiciousScore);

  return {
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: resource.mimeType,
    suspiciousScore,
    flags,
  };
}

async function callListMethod(
  url: string,
  method: string,
  id: number,
  controller: AbortController,
): Promise<{ result: Record<string, unknown> | null; methodNotFound: boolean }> {
  const resp = await sendJsonRpc(url, {
    jsonrpc: '2.0',
    id,
    method,
    params: {},
  }, controller.signal);

  if (resp === null) return { result: null, methodNotFound: false };
  if (resp.error) {
    if (resp.error.code === -32601) return { result: null, methodNotFound: true };
    return { result: null, methodNotFound: false };
  }
  return { result: resp.result ?? null, methodNotFound: false };
}

const SENSITIVE_TOOL_KEYWORDS = /\b(file|exec|shell|database|admin|delete|write|deploy)\b/i;

function analyzeAuthHeaders(headers: Record<string, string> | undefined): Issue[] {
  const issues: Issue[] = [];
  if (!headers) return issues;

  const wwwAuth = headers['www-authenticate'] || headers['www-authenticate'];
  if (!wwwAuth) return issues;

  const scheme = wwwAuth.split(/\s+/)[0]?.toLowerCase();

  if (scheme === 'basic') {
    issues.push({
      type: 'AUTH_WEAK_BASIC',
      severity: 'HIGH',
      title: 'Server uses Basic authentication',
      description: 'Basic authentication transmits credentials with minimal protection. Upgrade to OAuth 2.1 with PKCE.',
      fix: 'Replace Basic auth with OAuth 2.1 and PKCE flow',
      deduction: 20,
    });
  }

  if (scheme === 'digest') {
    issues.push({
      type: 'AUTH_WEAK_DIGEST',
      severity: 'MEDIUM',
      title: 'Server uses Digest authentication',
      description: 'Digest authentication is outdated and provides limited protection. Consider upgrading to OAuth 2.1 with PKCE.',
      fix: 'Replace Digest auth with OAuth 2.1 and PKCE flow',
      deduction: 10,
    });
  }

  if (scheme === 'bearer') {
    const scope = wwwAuth.match(/scope="([^"]+)"/i);
    if (!scope && !wwwAuth.includes('expires_in') && !wwwAuth.includes('expiry')) {
      issues.push({
        type: 'AUTH_NO_TOKEN_EXPIRY',
        severity: 'LOW',
        title: 'OAuth token has no expiry hint',
        description: 'Server returned Bearer auth without expiry information in the WWW-Authenticate header. Tokens may be long-lived.',
        fix: 'Include expires_in or token expiry information in the OAuth flow',
        deduction: 5,
      });
    }
    if (!wwwAuth.includes('code_challenge') && !wwwAuth.includes('pkce') && !wwwAuth.includes('S256')) {
      issues.push({
        type: 'AUTH_NO_PKCE',
        severity: 'LOW',
        title: 'OAuth flow does not advertise PKCE support',
        description: 'Server uses OAuth Bearer without indicating PKCE support in WWW-Authenticate header. PKCE is recommended for public clients but many servers implement it without advertising in headers.',
        fix: 'Consider implementing PKCE (S256 code challenge method) in the OAuth flow per RFC 7636',
        deduction: 0,
      });
    }
  }

  return issues;
}

async function checkCredentialReflection(url: string, timeoutMs: number): Promise<Issue[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const dummyToken = 'smcp_dummy_token_check_' + Date.now();

  try {
    const resp = await sendJsonRpc(url, {
      jsonrpc: '2.0',
      id: 999,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'MCPGuardian Scanner', version: '1.0.0' },
      },
    }, controller.signal, { 'Authorization': `Bearer ${dummyToken}` });

    if (!resp) return [];

    if (resp._body && resp._body.includes(dummyToken)) {
      return [{
        type: 'CREDENTIAL_REFLECTION',
        severity: 'CRITICAL',
        title: 'Server echoes back Authorization header values in response',
        description: 'The server reflected the Authorization header value in the response body. This can leak credentials to third parties via server logs, error pages, or intermediary caches.',
        fix: 'Ensure the server never echoes back authentication credentials in any response body or headers',
        deduction: 35,
      }];
    }

    if (resp._headers) {
      for (const [key, value] of Object.entries(resp._headers)) {
        if (value.includes(dummyToken)) {
          return [{
            type: 'CREDENTIAL_REFLECTION',
            severity: 'CRITICAL',
            title: 'Server echoes back Authorization header values in response headers',
            description: `The server reflected the Authorization header value in response header "${key}". This can leak credentials via intermediary caches, logs, or CORS headers.`,
            fix: 'Ensure the server never echoes back authentication credentials in any response body or headers',
            deduction: 35,
          }];
        }
      }
    }

    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function probeHttpMcpServer(url: string, timeoutMs: number = 5000): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const initResponse = await sendJsonRpc(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'MCPGuardian Scanner', version: '1.0.0' },
      },
    }, controller.signal);

    if (initResponse === null) {
      return { reachable: false, requiresAuth: false, toolCount: 0, tools: [], promptsCount: 0, prompts: [], resourcesCount: 0, resources: [], poisoningIssues: [], probeError: 'Connection timed out or failed' };
    }

    if (initResponse.error) {
      if (initResponse.error.code === 401 || initResponse.error.code === 403) {
        const authIssues = analyzeAuthHeaders(initResponse._headers);
        return { reachable: true, requiresAuth: true, toolCount: 0, tools: [], promptsCount: 0, prompts: [], resourcesCount: 0, resources: [], poisoningIssues: authIssues };
      }
      return { reachable: true, requiresAuth: false, toolCount: 0, tools: [], promptsCount: 0, prompts: [], resourcesCount: 0, resources: [], poisoningIssues: [], probeError: `Initialize error: ${initResponse.error.message}` };
    }

    const poisoningIssues: Issue[] = [];

    poisoningIssues.push({
      type: 'MISSING_AUTHENTICATION',
      severity: 'HIGH',
      title: 'MCP server requires no authentication',
      description: 'Server responded to initialize without credentials. 40% of remote MCP servers have no auth (Censys/Adversa June 2026)',
      fix: 'Add OAuth 2.1 or API key authentication to your MCP server',
      deduction: 20,
    });

    // ── tools/list ──────────────────────────────────────────────────────
    const toolsResp = await callListMethod(url, 'tools/list', 2, controller);
    const toolResults: ProbedTool[] = [];
    const cleanTools: Record<string, unknown>[] = [];
    let toolsHash: string | undefined;

    if (toolsResp.result) {
      const rawTools = toolsResp.result.tools;
      if (Array.isArray(rawTools)) {
        let hasSensitiveTool = false;
        for (const t of rawTools) {
          if (!t || typeof t !== 'object') continue;
          const tool = t as { name?: string; description?: string; inputSchema?: unknown };
          const toolName = typeof tool.name === 'string' ? tool.name : 'unknown';
          const toolDesc = typeof tool.description === 'string' ? tool.description : '';
          const toolSchema = tool.inputSchema;

          const probed = scanToolForPoisoning({ name: toolName, description: toolDesc, inputSchema: toolSchema });
          toolResults.push(probed);
          cleanTools.push({ name: toolName, description: toolDesc, inputSchema: toolSchema ?? {} });

          if (SENSITIVE_TOOL_KEYWORDS.test(`${toolName} ${toolDesc}`)) {
            hasSensitiveTool = true;
          }

          if (probed.suspiciousScore >= 40) {
            const severity = probed.suspiciousScore >= 70 ? 'CRITICAL' : 'HIGH';
            const deduction = probed.suspiciousScore >= 70 ? 35 : 20;
            poisoningIssues.push({
              type: 'TOOL_POISONING_RISK',
              severity: severity as 'CRITICAL' | 'HIGH',
              title: 'Tool poisoning indicators detected in server metadata',
              description: `Tool '${probed.name}' contains suspicious patterns: ${probed.flags.join(', ')}`,
              fix: 'Do not use this MCP server. Report to the server maintainer. Tool descriptions with hidden instructions are a top-2026 attack vector.',
              deduction,
            });
          }
        }

        // Escalate MISSING_AUTHENTICATION if sensitive tools were discovered without auth
        if (hasSensitiveTool) {
          const authIdx = poisoningIssues.findIndex(i => i.type === 'MISSING_AUTHENTICATION');
          if (authIdx !== -1) {
            poisoningIssues[authIdx] = {
              ...poisoningIssues[authIdx],
              severity: 'CRITICAL',
              title: 'Unauthenticated access to sensitive tools detected',
              description: 'Server exposes tools matching sensitive operations (file, exec, shell, database, admin, delete, write, deploy) without any authentication. This is a critical security risk.',
              deduction: 35,
            };
          }
        }
      }
      toolsHash = await computeToolsHash(cleanTools);
    }

    // ── prompts/list ────────────────────────────────────────────────────
    const promptsResp = await callListMethod(url, 'prompts/list', 3, controller);
    const promptResults: ProbedPrompt[] = [];

    if (promptsResp.result) {
      const rawPrompts = promptsResp.result.prompts;
      if (Array.isArray(rawPrompts)) {
        for (const p of rawPrompts) {
          if (!p || typeof p !== 'object') continue;
          const prompt = p as { name?: string; description?: string; arguments?: unknown };
          const promptName = typeof prompt.name === 'string' ? prompt.name : 'unknown';
          const promptDesc = typeof prompt.description === 'string' ? prompt.description : '';

          const probed = scanPromptForPoisoning({ name: promptName, description: promptDesc, arguments: prompt.arguments });
          promptResults.push(probed);

          if (!promptDesc || promptDesc.trim().length === 0) {
            poisoningIssues.push({
              type: 'UNDOCUMENTED_PROMPT',
              severity: 'LOW',
              title: 'Prompt has no description',
              description: `Prompt '${probed.name}' has no description — users cannot know what it does`,
              fix: 'Add a clear description to the prompt definition',
              deduction: 0,
            });
          }

          if (probed.suspiciousScore >= 40) {
            const severity = probed.suspiciousScore >= 70 ? 'CRITICAL' : 'HIGH';
            const deduction = probed.suspiciousScore >= 70 ? 35 : 20;
            poisoningIssues.push({
              type: 'PROMPT_POISONING_RISK',
              severity: severity as 'CRITICAL' | 'HIGH',
              title: 'Prompt poisoning indicators detected in server metadata',
              description: `Prompt '${probed.name}' contains suspicious patterns: ${probed.flags.join(', ')}`,
              fix: 'Do not use this MCP server. Report to the server maintainer. Prompt descriptions with hidden instructions are a top-2026 attack vector.',
              deduction,
            });
          }
        }
      }
    }

    // ── resources/list ──────────────────────────────────────────────────
    const resourcesResp = await callListMethod(url, 'resources/list', 4, controller);
    const resourceResults: ProbedResource[] = [];

    if (resourcesResp.result) {
      const rawResources = resourcesResp.result.resources;
      if (Array.isArray(rawResources)) {
        for (const r of rawResources) {
          if (!r || typeof r !== 'object') continue;
          const res = r as { uri?: string; name?: string; description?: string; mimeType?: string };
          const resUri = typeof res.uri === 'string' ? res.uri : '';
          const resName = typeof res.name === 'string' ? res.name : 'unknown';
          const resDesc = typeof res.description === 'string' ? res.description : '';
          const resMime = typeof res.mimeType === 'string' ? res.mimeType : '';

          const probed = scanResourceForExposure({ uri: resUri, name: resName, description: resDesc, mimeType: resMime });
          resourceResults.push(probed);

          if (probed.flags.includes('INTERNAL_IP_RESOURCE')) {
            poisoningIssues.push({
              type: 'INTERNAL_RESOURCE_EXPOSURE',
              severity: 'HIGH',
              title: 'MCP server exposes internal network resource',
              description: `Resource '${probed.name}' at ${probed.uri} points to an internal IP address, potentially exposing internal services`,
              fix: 'Remove internal resources from the MCP server or restrict access with authentication',
              deduction: 20,
            });
          }

          if (probed.flags.includes('FILE_SYSTEM_RESOURCE')) {
            poisoningIssues.push({
              type: 'FILE_SYSTEM_RESOURCE',
              severity: 'MEDIUM',
              title: 'MCP server exposes local filesystem resource',
              description: `Resource '${probed.name}' at ${probed.uri} uses file:// protocol, exposing local files`,
              fix: 'Remove file:// resources or ensure they point only to safe directories',
              deduction: 10,
            });
          }

          if (probed.suspiciousScore >= 40) {
            const severity = probed.suspiciousScore >= 70 ? 'CRITICAL' : 'HIGH';
            const deduction = probed.suspiciousScore >= 70 ? 35 : 20;
            poisoningIssues.push({
              type: 'RESOURCE_POISONING_RISK',
              severity: severity as 'CRITICAL' | 'HIGH',
              title: 'Resource metadata poisoning indicators detected',
              description: `Resource '${probed.name}' contains suspicious patterns: ${probed.flags.join(', ')}`,
              fix: 'Do not use this MCP server. Report to the server maintainer.',
              deduction,
            });
          }
        }
      }
    }

    const reflectionIssues = await checkCredentialReflection(url, timeoutMs);
    poisoningIssues.push(...reflectionIssues);

    return {
      reachable: true,
      requiresAuth: false,
      toolCount: toolResults.length,
      tools: toolResults,
      promptsCount: promptResults.length,
      prompts: promptResults,
      resourcesCount: resourceResults.length,
      resources: resourceResults,
      poisoningIssues,
      toolsHash,
      rawTools: cleanTools.length > 0 ? cleanTools : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Step 3.4: CORS header validation.
 * Send OPTIONS preflight to the MCP endpoint and check response headers.
 */
export async function checkCorsHeaders(url: string): Promise<{ originHeader: string | null; wildcardOrigin: boolean; originAbsent: boolean; specificOrigin: boolean }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://mcpguardian.dev',
          'Access-Control-Request-Method': 'POST',
        },
        signal: controller.signal,
      });

      const originHeader = res.headers.get('access-control-allow-origin');

      if (!originHeader) {
        return { originHeader: null, wildcardOrigin: false, originAbsent: true, specificOrigin: false };
      }

      if (originHeader === '*') {
        return { originHeader: '*', wildcardOrigin: true, originAbsent: false, specificOrigin: false };
      }

      return { originHeader, wildcardOrigin: false, originAbsent: false, specificOrigin: true };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { originHeader: null, wildcardOrigin: false, originAbsent: true, specificOrigin: false };
  }
}

export { scanStdioArgsForHardcodedCredentials };
