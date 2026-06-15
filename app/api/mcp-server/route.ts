import { NextRequest } from 'next/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {
  handleScanMcpConfig,
  handleCheckMcpServer,
  handleLookupCve,
  handleVerifyToolDefinition,
  handleGetScanHistory,
} from '@/lib/mcp-server/tools';
import { validateApiKey } from '@/lib/api-key-auth';

const SERVER_INFO = {
  name: 'mcpguardian-scanner',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'scan_mcp_config',
    description: 'Scans an MCP server configuration for security vulnerabilities including tool poisoning, credential exposure, supply chain risks, and authentication issues. Returns a full vulnerability report.',
    inputSchema: {
      type: 'object' as const,
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
      type: 'object' as const,
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
      type: 'object' as const,
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
      type: 'object' as const,
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
      type: 'object' as const,
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

function createServer() {
  const server = new Server(SERVER_INFO, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const name = params?.name;
    const args = (params?.arguments ?? {}) as Record<string, unknown>;

    if (!name) {
      return {
        content: [{ type: 'text' as const, text: 'Missing tool name' }],
        isError: true,
      };
    }

    try {
      const result = await handleToolCall(name, args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function POST(request: NextRequest) {
  // Auth check
  const apiKeyResult = await validateApiKey(request);
  // API key is optional for now — allows testing without auth

  // Create a fresh server + transport per request (stateless for serverless)
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return response;
}

export async function GET(request: NextRequest) {
  const apiKeyResult = await validateApiKey(request);

  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
