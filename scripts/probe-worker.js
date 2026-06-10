#!/usr/bin/env node
/**
 * SANDBOXED PROBE WORKER
 * =======================
 * Runs INSIDE the Docker container.
 * Has NO access to host filesystem, env vars, or network.
 * Only can reach the TARGET_URL passed via environment.
 * Writes all results to /tmp/scan-output/results.json
 * Container is DESTROYED after this script exits.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Config from environment ─────────────────────────────────────────
const TARGET_URL = process.env.TARGET_URL || '';
const TARGET_HEADERS_RAW = process.env.TARGET_HEADERS || '{}';
const SCAN_ID = process.env.SCAN_ID || 'unknown';
const STDIO_COMMAND = process.env.STDIO_COMMAND || '';
const STDIO_ARGS_RAW = process.env.STDIO_ARGS || '[]';

let TARGET_HEADERS = {};
try { TARGET_HEADERS = JSON.parse(TARGET_HEADERS_RAW); } catch {}

let STDIO_ARGS = [];
try { STDIO_ARGS = JSON.parse(STDIO_ARGS_RAW); } catch {}

const OUTPUT_FILE = '/tmp/scan-output/results.json';
const TIMEOUT_MS = 15_000; // max time for probe exchange
const CONSISTENCY_DELAY_MS = 3000;

// ─── Safe fetch wrapper with timeout ─────────────────────────────────

async function safeFetch(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── JSON-RPC helpers ────────────────────────────────────────────────

function jsonRpcRequest(method, params = {}, id = 1) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };
}

async function sendJsonRpc(url, request, headers = {}, timeoutMs = TIMEOUT_MS) {
  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(request),
  }, timeoutMs);

  if (!res) return null;

  const responseHeaders = {};
  if (res.headers && typeof res.headers.forEach === 'function') {
    res.headers.forEach((value, key) => { responseHeaders[key.toLowerCase()] = value; });
  }

  let bodyText = '';
  try { bodyText = await res.text(); } catch {}

  return {
    status: res.status,
    ok: res.ok,
    headers: responseHeaders,
    body: bodyText,
  };
}

// ─── Hash computation ────────────────────────────────────────────────

function computeToolsHash(tools) {
  const sorted = [...tools].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const concatenated = sorted.map(t =>
    `${t.name}|${t.description || ''}|${JSON.stringify(t.inputSchema || {})}`
  ).join('||');
  return crypto.createHash('sha256').update(concatenated, 'utf-8').digest('hex');
}

// ─── LAYER A: Extended Regex Pattern Bank ────────────────────────────

const CRITICAL_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|system)\s+instructions?/i, flag: 'INSTRUCTION_OVERRIDE' },
  { pattern: /disregard\s+(all\s+)?(your|the|previous|system)/i, flag: 'INSTRUCTION_DISREGARD' },
  { pattern: /forget\s+(all\s+)?(your|previous)\s+instructions?/i, flag: 'INSTRUCTION_FORGET' },
  { pattern: /override\s+(your\s+)?(instructions?|guidelines?|rules?)/i, flag: 'INSTRUCTION_OVERRIDE' },
  { pattern: /you\s+are\s+now\s+(a|an|the)/i, flag: 'PERSONA_HIJACK' },
  { pattern: /new\s+(persona|personality|role|instructions?)/i, flag: 'PERSONA_SWITCH' },
  { pattern: /act\s+as\s+(if\s+)?(you\s+are|a|an)/i, flag: 'PERSONA_ACTAS' },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, flag: 'PERSONA_PRETEND' },
  { pattern: /your\s+(new\s+)?(role|task|purpose|goal)\s+is/i, flag: 'ROLE_REDEFINE' },
  { pattern: /switch\s+(to\s+)?(mode|persona|role)/i, flag: 'MODE_SWITCH' },
  { pattern: /\[SYSTEM\]/i, flag: 'SYSTEM_TAG' },
  { pattern: /\[INST\]/i, flag: 'INST_TAG' },
  { pattern: /<\|im_start\|>/i, flag: 'CHATML_START' },
  { pattern: /<\|system\|>/i, flag: 'CHATML_SYSTEM' },
  { pattern: /<<SYS>>/i, flag: 'LLAMA_SYS' },
  { pattern: /###\s*instruction/i, flag: 'MARKDOWN_INSTRUCTION' },
  { pattern: /\]\s*\(\s*javascript:/i, flag: 'JS_IN_URL' },
  { pattern: /<!--[\s\S]*?(inject|override|ignore|execute)[\s\S]*?-->/i, flag: 'HTML_COMMENT_INJECTION' },
  { pattern: /<script[\s\S]*?>[\s\S]*?<\/script>/i, flag: 'SCRIPT_TAG' },
  { pattern: /send\s+.{0,50}\s+to\s+(https?:\/\/)/i, flag: 'DATA_EXFIL_URL' },
  { pattern: /post\s+.{0,50}\s+to\s+(https?:\/\/)/i, flag: 'DATA_POST_URL' },
  { pattern: /exfiltrat/i, flag: 'EXFIL_KEYWORD' },
  { pattern: /transmit\s+(all|the)\s+(data|information)/i, flag: 'TRANSMIT_ALL' },
  { pattern: /forward\s+(all|the)\s+(data|requests?)/i, flag: 'FORWARD_ALL' },
  { pattern: /upload\s+(all|the)\s+(data|files?|content)/i, flag: 'UPLOAD_ALL' },
];

const HIGH_PATTERNS = [
  { pattern: /exec(ute)?\s*\(/i, flag: 'EXEC_CALL' },
  { pattern: /eval\s*\(/i, flag: 'EVAL_CALL' },
  { pattern: /os\.(system|popen|exec)/i, flag: 'OS_COMMAND' },
  { pattern: /subprocess\.(run|call|popen)/i, flag: 'SUBPROCESS' },
  { pattern: /shell\s*=\s*true/i, flag: 'SHELL_TRUE' },
  { pattern: /child_process/i, flag: 'CHILD_PROCESS' },
  { pattern: /webhook/i, flag: 'WEBHOOK' },
  { pattern: /callback\s*url/i, flag: 'CALLBACK_URL' },
  { pattern: /collect\s+(all|every)\s+(messages?|conversations?)/i, flag: 'COLLECT_MESSAGES' },
  { pattern: /harvest\s+(data|credentials?|tokens?)/i, flag: 'HARVEST_DATA' },
  { pattern: /what\s+is\s+(your\s+)?(password|token|secret|key)/i, flag: 'PHISH_CREDENTIAL' },
];

const OBFUSCATION_PATTERNS = [
  { pattern: /[\u200b\u200c\u200d\u200e\u200f\ufeff]/, flag: 'ZERO_WIDTH_CHAR' },
  { pattern: /[\u2028\u2029]/, flag: 'LINE_SEPARATOR' },
  { pattern: /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, flag: 'CONTROL_CHAR' },
];

// ─── LAYER C: Structural Anomaly Detection ──────────────────────────

function detectStructuralAnomalies(tools) {
  const findings = [];

  for (const tool of tools) {
    const name = tool.name || 'unknown';
    const desc = tool.description || '';
    const schema = tool.inputSchema || {};

    // Description > 500 chars
    if (desc.length > 500) {
      findings.push({
        type: 'LONG_DESCRIPTION',
        tool: name,
        severity: 'MEDIUM',
        detail: `Description is ${desc.length} chars (max 500)`,
        deduction: 10,
      });
    }

    // External URLs in description
    const urlMatch = desc.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      findings.push({
        type: 'EXTERNAL_URL_IN_DESCRIPTION',
        tool: name,
        severity: 'HIGH',
        detail: `Found URL in description: ${urlMatch[0].slice(0, 80)}`,
        deduction: 20,
      });
    }

    // Tool name vs description category mismatch
    const isReadName = /^(get|read|list|fetch|search|find)/i.test(name);
    const hasWriteDesc = /(write|update|insert|delete|remove|modify|create)/i.test(desc);
    if (isReadName && hasWriteDesc) {
      findings.push({
        type: 'CATEGORY_MISMATCH',
        tool: name,
        severity: 'HIGH',
        detail: `Tool name suggests read-only but description mentions write operations`,
        deduction: 20,
      });
    }

    // Sensitive input params beyond stated scope
    const paramNames = getParamNames(schema);
    const hasSensitiveParam = paramNames.some(p =>
      /password|secret|token|credential|apikey|api_key/i.test(p)
    );
    const isAuthTool = /auth|login|token/i.test(name);
    if (hasSensitiveParam && !isAuthTool) {
      findings.push({
        type: 'SENSITIVE_PARAM_IN_NON_AUTH_TOOL',
        tool: name,
        severity: 'HIGH',
        detail: `Non-auth tool "${name}" requests sensitive parameter: ${paramNames.find(p => /password|secret|token/i.test(p))}`,
        deduction: 20,
      });
    }

    // Read-only name with write ops in description
    const isReadOnlyName = /^(get|read|list|fetch|query|select|search)/i.test(name);
    const hasWriteOps = /(delete|drop|update|insert|modify|exec|shell)/i.test(desc);
    if (isReadOnlyName && hasWriteOps) {
      findings.push({
        type: 'READ_NAME_WRITE_DESC',
        tool: name,
        severity: 'HIGH',
        detail: 'Tool name suggests read-only but description references destructive operations',
        deduction: 20,
      });
    }
  }

  return findings;
}

function getParamNames(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const properties = schema.properties || schema.parameters?.properties || {};
  if (!properties || typeof properties !== 'object') return [];
  return Object.keys(properties);
}

// ─── LAYER E: Behavioral Consistency Double Probe ───────────────────

async function checkBehavioralConsistency(url, headers) {
  // Fetch tools/list twice, 3 seconds apart, compare hashes
  const result1 = await fetchToolsList(url, headers);
  await new Promise(r => setTimeout(r, CONSISTENCY_DELAY_MS));
  const result2 = await fetchToolsList(url, headers);

  if (!result1 || !result2) {
    return { status: 'UNREACHABLE', detail: 'Could not complete consistency check' };
  }

  const hash1 = computeToolsHash(result1.tools);
  const hash2 = computeToolsHash(result2.tools);

  if (hash1 === hash2) {
    return { status: 'CONSISTENT', hash1, hash2, detail: 'Tool definitions consistent across two probes' };
  }

  return {
    status: 'INCONSISTENT',
    hash1,
    hash2,
    detail: 'Server returns different tool definitions on consecutive calls. Possible scanner fingerprinting or payload switching.',
    severity: 'CRITICAL',
    deduction: 40,
  };
}

async function fetchToolsList(url, headers) {
  const resp = await sendJsonRpc(url, jsonRpcRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'MCPGuardian Probe', version: '1.0.0' },
  }, 1), headers);

  if (!resp || !resp.ok) return null;

  const toolsResp = await sendJsonRpc(url, jsonRpcRequest('tools/list', {}, 2), headers);
  if (!toolsResp || !toolsResp.ok) return null;

  let body;
  try { body = JSON.parse(toolsResp.body); } catch { return null; }

  const tools = body?.result?.tools;
  if (!Array.isArray(tools)) return { tools: [] };

  const parsed = tools.map(t => ({
    name: t.name || 'unknown',
    description: t.description || '',
    inputSchema: t.inputSchema || {},
  }));

  return { tools: parsed };
}

// ─── LAYER D: AST Source Code Analysis (placeholder) ─────────────────

async function analyzeSourceCode(tools) {
  // Attempt to find source URLs in tool metadata
  // If GitHub/npm URL found, fetch and parse with AST
  // For now, flag source as unavailable and apply score cap
  return {
    status: 'UNAVAILABLE',
    findings: [{
      type: 'SOURCE_UNAVAILABLE',
      severity: 'HIGH',
      detail: 'No source repository URL available for AST analysis. Cannot verify tool implementations.',
      deduction: 15,
    }],
  };
}

// ─── LAYER B: TOML Rule Engine (load from rules.toml) ───────────────

function loadTomlRules() {
  const rulesPath = '/app/rules.toml';
  try {
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf-8');
      // Simple TOML parser for known rule format
      return parseSimpleToml(content);
    }
  } catch {}
  return [];
}

function parseSimpleToml(content) {
  // Minimal TOML section parser for rules format
  const rules = [];
  const sections = content.split(/\[\[rules\]\]/);
  for (const section of sections) {
    if (!section.trim()) continue;
    const rule = {};
    const lines = section.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s*=\s*"([^"]+)"/);
      if (match) {
        rule[match[1]] = match[2];
      }
    }
    if (rule.pattern && rule.flag) {
      try {
        rule.regex = new RegExp(rule.pattern, rule.flags || 'i');
        rules.push(rule);
      } catch {}
    }
  }
  return rules;
}

// ─── Tool Risk Classification ────────────────────────────────────────

function classifyToolRisk(name, description) {
  const text = `${name} ${description}`;
  const critical = /delete|drop|truncate|destroy|wipe|rm\b|purge|format/i;
  const high = /write|update|insert|post|put|patch|exec\b|shell|send|modify/i;
  const medium = /read|get\b|fetch|list|query|select|search|find/i;
  const low = /compute|format|convert|calculate|parse|validate/i;

  if (critical.test(text)) return { risk: 'CRITICAL', reason: 'Destructive operation — can delete or destroy data' };
  if (high.test(text)) return { risk: 'HIGH', reason: 'Mutating operation — can write or modify data' };
  if (medium.test(text)) return { risk: 'MEDIUM', reason: 'Read-only access — can read or query data' };
  if (low.test(text)) return { risk: 'LOW', reason: 'Computational — transforms data without side effects' };
  return { risk: 'UNKNOWN', reason: 'Unclassified — review manually' };
}

// ─── Main Probe Execution ───────────────────────────────────────────

async function runProbes() {
  const results = {
    scan_id: SCAN_ID,
    timestamp: new Date().toISOString(),
    target_url: TARGET_URL,
    mode: TARGET_URL ? 'REMOTE' : 'STDIO',
    probes: {},
    tool_hash: null,
    tool_risk_matrix: [],
    errors: [],
  };

  // ── Unauthenticated Access Probe (Probe 3.1) ─────────────────────
  if (TARGET_URL) {
    const unauthResp = await sendJsonRpc(TARGET_URL, jsonRpcRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'MCPGuardian Probe', version: '1.0.0' },
    }, 1), {});

    if (!unauthResp) {
      results.probes.unauth_access = {
        status: 'UNREACHABLE',
        severity: 'MEDIUM',
        deduction: 10,
        detail: 'Could not reach server. Cannot verify safety.',
      };
    } else if (unauthResp.status === 401 || unauthResp.status === 403) {
      results.probes.unauth_access = {
        status: 'PASS',
        detail: 'Server correctly rejects unauthenticated requests.',
      };
    } else if (unauthResp.ok) {
      results.probes.unauth_access = {
        status: 'FAIL',
        severity: 'CRITICAL',
        deduction: 35,
        detail: 'Server accepted connection without credentials. Open to entire internet.',
      };
    }

    // ── Authenticated Tool Fetch (Probe 3.2) ───────────────────────
    const hasAuth = TARGET_HEADERS && Object.keys(TARGET_HEADERS).some(k =>
      k.toLowerCase() === 'authorization'
    );
    const authHeaders = hasAuth ? TARGET_HEADERS : {};

    const initResp = await sendJsonRpc(TARGET_URL, jsonRpcRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'MCPGuardian Probe', version: '1.0.0' },
    }, 1), authHeaders);

    if (!initResp || !initResp.ok) {
      results.probes.tool_fetch = {
        status: 'FAIL',
        detail: 'Could not initialize MCP connection with provided credentials.',
      };
    } else {
      const toolsResp = await sendJsonRpc(TARGET_URL, jsonRpcRequest('tools/list', {}, 2), authHeaders);
      if (toolsResp && toolsResp.ok) {
        let body;
        try { body = JSON.parse(toolsResp.body); } catch {}

        const rawTools = body?.result?.tools || [];
        const tools = rawTools.map(t => ({
          name: t.name || 'unknown',
          description: t.description || '',
          inputSchema: t.inputSchema || {},
        }));

        results.probes.tool_fetch = {
          status: 'SUCCESS',
          tools_count: tools.length,
        };

        // ── Layer A: Regex Pattern Scan ──────────────────────────────
        const regexFindings = [];
        for (const tool of tools) {
          const searchText = `${tool.name} ${tool.description} ${JSON.stringify(tool.inputSchema || {})}`;

          for (const { pattern, flag } of CRITICAL_PATTERNS) {
            if (pattern.test(searchText)) {
              regexFindings.push({
                type: 'CRITICAL_PATTERN',
                flag,
                tool: tool.name,
                severity: 'CRITICAL',
                deduction: 40,
                detail: `Confirmed injection pattern: ${flag}`,
                excerpt: tool.description.slice(0, 80),
              });
              break;
            }
          }

          // Only check high patterns if no critical found
          const hasCritical = regexFindings.some(f => f.tool === tool.name);
          if (!hasCritical) {
            for (const { pattern, flag } of HIGH_PATTERNS) {
              if (pattern.test(searchText)) {
                regexFindings.push({
                  type: 'HIGH_PATTERN',
                  flag,
                  tool: tool.name,
                  severity: 'HIGH',
                  deduction: 20,
                  detail: `Suspicious pattern: ${flag}`,
                  excerpt: tool.description.slice(0, 80),
                });
                break;
              }
            }
          }

          // Check obfuscation patterns
          for (const { pattern, flag } of OBFUSCATION_PATTERNS) {
            if (pattern.test(searchText)) {
              regexFindings.push({
                type: 'OBFUSCATION',
                flag,
                tool: tool.name,
                severity: 'HIGH',
                deduction: 30,
                detail: `Obfuscation pattern: ${flag}`,
              });
              break;
            }
          }
        }

        results.probes.injection_scan = {
          status: regexFindings.length === 0 ? 'CLEAN' : 'SUSPICIOUS',
          findings: regexFindings,
        };

        // ── Layer C: Structural Anomalies ──────────────────────────
        const structuralFindings = detectStructuralAnomalies(tools);
        results.probes.structural_anomalies = {
          status: structuralFindings.length === 0 ? 'CLEAN' : 'FLAGS_FOUND',
          findings: structuralFindings,
        };

        // ── Layer D: Source Code Analysis ──────────────────────────
        results.probes.source_analysis = await analyzeSourceCode(tools);

        // ── Layer E: Behavioral Consistency ────────────────────────
        results.probes.consistency_check = await checkBehavioralConsistency(TARGET_URL, authHeaders);

        // ── Tool Risk Matrix ─────────────────────────────────────────
        results.tool_risk_matrix = tools.map(t => ({
          tool: t.name,
          ...classifyToolRisk(t.name, t.description),
        }));

        // ── Tool Hash ────────────────────────────────────────────────
        results.tool_hash = computeToolsHash(tools);
        results.raw_tools = tools;
      } else {
        results.probes.tool_fetch = {
          status: 'FAIL',
          detail: 'tools/list endpoint not available',
        };
      }
    }

    // ── CORS Check (Probe 3.5) ──────────────────────────────────────
    const corsResp = await safeFetch(TARGET_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://mcpguardian.dev',
        'Access-Control-Request-Method': 'POST',
      },
    });

    if (corsResp && corsResp.ok) {
      const acao = corsResp.headers.get('access-control-allow-origin');
      if (acao === '*') {
        results.probes.cors_check = { status: 'FAIL', severity: 'CRITICAL', deduction: 25, detail: 'Wildcard origin (*) allows any website to invoke MCP tools cross-origin' };
      } else if (!acao) {
        results.probes.cors_check = { status: 'FAIL', severity: 'HIGH', deduction: 10, detail: 'No CORS policy — browser clients may be exploitable' };
      } else {
        results.probes.cors_check = { status: 'PASS', detail: `CORS restricted to: ${acao}` };
      }
    } else {
      results.probes.cors_check = { status: 'UNKNOWN', detail: 'Could not check CORS headers' };
    }
  }

  // ── STDIO Mode ──────────────────────────────────────────────────
  if (STDIO_COMMAND) {
    // Connect via stdin/stdout to the STDIO command
    const { spawn } = require('child_process');
    const child = spawn(STDIO_COMMAND, STDIO_ARGS, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: TIMEOUT_MS,
    });

    const stdioResults = await new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let resolved = false;

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (resolved) return;
        resolved = true;
        resolve({ stdout, stderr, code });
      });

      child.on('error', () => {
        if (resolved) return;
        resolved = true;
        resolve({ stdout, stderr, code: -1 });
      });

      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        child.kill();
        resolve({ stdout, stderr, code: -1 });
      }, TIMEOUT_MS);
    });

    results.probes.stdio_execution = {
      status: stdioResults.code === 0 ? 'COMPLETED' : 'FAILED',
      exit_code: stdioResults.code,
      stderr: stdioResults.stderr.slice(0, 1000),
    };

    // Try to parse tool list from STDIOResponse.json if present
    try {
      const lines = stdioResults.stdout.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.method === 'tools/list' || (msg.result && msg.result.tools)) {
            const tools = (msg.result?.tools || []).map(t => ({
              name: t.name || 'unknown',
              description: t.description || '',
              inputSchema: t.inputSchema || {},
            }));
            results.probes.stdio_tool_fetch = {
              status: 'SUCCESS',
              tools_count: tools.length,
            };
            results.tool_risk_matrix = tools.map(t => ({
              tool: t.name,
              ...classifyToolRisk(t.name, t.description),
            }));
            results.tool_hash = computeToolsHash(tools);
            results.raw_tools = tools;
          }
        } catch {}
      }
    } catch {}
  }

  // ── Write results ───────────────────────────────────────────────
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`Results written to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Failed to write results:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

runProbes().catch(err => {
  console.error('Probe worker error:', err.message);
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      scan_id: SCAN_ID,
      timestamp: new Date().toISOString(),
      error: err.message,
      probes: {},
    }), 'utf-8');
  } catch {}
  process.exit(1);
});
