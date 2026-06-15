import { NextRequest, NextResponse } from 'next/server';
import {
  handleScanMcpConfig,
  handleCheckMcpServer,
  handleLookupCve,
  handleVerifyToolDefinition,
  handleGetScanHistory,
} from '@/lib/mcp-server/tools';
import { validateApiKey } from '@/lib/api-key-auth';

/**
 * MCPGuardian MCP Server — Stateless JSON-RPC 2.0 implementation
 * 
 * Implements the MCP protocol without session state (suitable for serverless).
 * Supports: initialize, tools/list, tools/call
 */

const SERVER_INFO = {
  name: 'mcpguardian-scanner',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'scan_mcp_config',
    description: 'Scans an MCP server configuration for security vulnerabilities including tool poisoning, credential exposure, supply chain risks, and authentication issues. Returns a full vulnerability report.',
    inputSchema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          description: 'MCP server configuration object (must contain mcpServers key)',
        },
        deep: {
          type: 'boolean',
          description: 'Enable deep scan (includes runtime probing of HTTPS servers)',
        },
      },
      required: ['config'],
    },
  },
  {
    name: 'check_mcp_server',
    description: 'Performs a live security probe of a single MCP server endpoint. Checks authentication, tool definitions for poisoning patterns, and known CVEs.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the MCP server endpoint to probe' },
        transport: { type: 'string', enum: ['http', 'stdio'], description: 'Transport type' },
      },
      required: ['url'],
    },
  },
  {
    name: 'lookup_cve',
    description: 'Looks up known CVEs for an MCP-related package and version. Returns matching vulnerabilities with severity and remediation advice.',
    inputSchema: {
      type: 'object',
      properties: {
        package_name: { type: 'string', description: 'Name of the package to look up' },
        version: { type: 'string', description: 'Optional version string' },
      },
      required: ['package_name'],
    },
  },
  {
    name: 'verify_tool_definition',
    description: 'Checks a single MCP tool definition (name, description, inputSchema) for poisoning patterns, Unicode evasion, and injection risks.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tool name' },
        description: { type: 'string', description: 'Tool description text' },
        inputSchema: { type: 'object', description: 'Tool input schema (JSON Schema)' },
      },
      required: ['description'],
    },
  },
  {
    name: 'get_scan_history',
    description: 'Returns the scan history and rug-pull detection log for a previously scanned MCP server.',
    inputSchema: {
      type: 'object',
      properties: {
        server_url: { type: 'string', description: 'URL of the MCP server to retrieve history for' },
      },
      required: ['server_url'],
    },
  },
];

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'scan_mcp_config':
      return await handleScanMcpConfig(args);
    case 'check_mcp_server':
      return await handleCheckMcpServer(args);
    case 'lookup_cve':
      return await handleLookupCve(args);
    case 'verify_tool_definition':
      return await handleVerifyToolDefinition(args);
    case 'get_scan_history':
      return await handleGetScanHistory(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function jsonRpcResponse(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

export async function POST(request: NextRequest) {
  // Optional auth
  await validateApiKey(request);

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: invalid JSON');
  }

  if (body.jsonrpc !== '2.0' || !body.method) {
    return jsonRpcError(body.id, -32600, 'Invalid JSON-RPC 2.0 request');
  }

  const { method, id, params } = body;

  // ── initialize ─────────────────────────────────────────────────────
  if (method === 'initialize') {
    return jsonRpcResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: `MCPGuardian Security Scanner — MCP server security analysis tools.

Available tools:
- scan_mcp_config: Scan an MCP server configuration for vulnerabilities
- check_mcp_server: Probe a live MCP server endpoint for security issues
- lookup_cve: Look up known CVEs for MCP-related packages
- verify_tool_definition: Check a tool definition for poisoning patterns
- get_scan_history: Retrieve scan history and rug-pull detection logs`,
    });
  }

  // ── notifications/initialized ──────────────────────────────────────
  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 });
  }

  // ── tools/list ─────────────────────────────────────────────────────
  if (method === 'tools/list') {
    return jsonRpcResponse(id, { tools: TOOLS });
  }

  // ── tools/call ─────────────────────────────────────────────────────
  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const toolName = p?.name;
    const args = (p?.arguments ?? {}) as Record<string, unknown>;

    if (!toolName) {
      return jsonRpcResponse(id, {
        content: [{ type: 'text', text: 'Missing tool name' }],
        isError: true,
      });
    }

    const knownTools = TOOLS.map(t => t.name);
    if (!knownTools.includes(toolName)) {
      return jsonRpcResponse(id, {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}. Available: ${knownTools.join(', ')}` }],
        isError: true,
      });
    }

    try {
      const result = await handleToolCall(toolName, args);
      return jsonRpcResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonRpcResponse(id, {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      });
    }
  }

  // ── Unknown method ─────────────────────────────────────────────────
  return jsonRpcError(id, -32601, `Method not found: ${method}`);
}

// GET endpoint for SSE (not used in stateless mode but prevents 405)
export async function GET() {
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description: 'MCPGuardian Security Scanner MCP Server',
    tools: TOOLS.map(t => t.name),
  });
}
