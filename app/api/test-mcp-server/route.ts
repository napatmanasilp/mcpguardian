import { NextRequest, NextResponse } from "next/server";

/**
 * Test MCP Server — a minimal JSON-RPC 2.0 endpoint that implements
 * the MCP protocol just enough to test MCPGuardian's proxy.
 *
 * Supports:
 * - initialize
 * - tools/list (returns 2 demo tools)
 * - tools/call (echo and get_time)
 *
 * Deploy alongside the app so you have a real upstream to proxy through.
 * Register this URL as endpoint_url on your MCP server record:
 *   https://mcpauth.vercel.app/api/test-mcp-server
 */
export async function POST(request: NextRequest) {
  let body: { jsonrpc?: string; method?: string; id?: string | number; params?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
      { status: 400 },
    );
  }

  const { method, id, params } = body;

  // ── initialize ────────────────────────────────────────────────────
  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "mcpguardian-test-server",
          version: "1.0.0",
        },
      },
    });
  }

  // ── tools/list ────────────────────────────────────────────────────
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "echo",
            description: "Echoes back the provided message. Useful for testing connectivity.",
            inputSchema: {
              type: "object",
              properties: {
                message: { type: "string", description: "The message to echo back" },
              },
              required: ["message"],
            },
          },
          {
            name: "get_time",
            description: "Returns the current server time in ISO format.",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "add_numbers",
            description: "Adds two numbers together.",
            inputSchema: {
              type: "object",
              properties: {
                a: { type: "number", description: "First number" },
                b: { type: "number", description: "Second number" },
              },
              required: ["a", "b"],
            },
          },
        ],
      },
    });
  }

  // ── tools/call ────────────────────────────────────────────────────
  if (method === "tools/call") {
    const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
    const toolName = p?.name;
    const args = p?.arguments ?? {};

    if (toolName === "echo") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: String(args.message ?? "no message provided") }],
        },
      });
    }

    if (toolName === "get_time") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: new Date().toISOString() }],
        },
      });
    }

    if (toolName === "add_numbers") {
      const sum = Number(args.a ?? 0) + Number(args.b ?? 0);
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `${args.a} + ${args.b} = ${sum}` }],
        },
      });
    }

    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Tool not found: ${toolName}` },
    });
  }

  // ── Unknown method ────────────────────────────────────────────────
  return NextResponse.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}
