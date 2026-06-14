import { NextResponse } from "next/server";

/**
 * @deprecated The /api/monitors endpoint is deprecated.
 *
 * Continuous monitoring is now handled automatically via the org-based
 * MCP server registry at /api/servers. Each registered server is scanned
 * on a schedule and results are stored in the `scans` table.
 *
 * Use:
 *   - POST /api/servers   — register a server for monitoring
 *   - GET  /api/sessions  — view active proxy sessions
 *   - GET  /api/alerts    — view alerts triggered by scans
 */

const DEPRECATION_RESPONSE = {
  error: "deprecated",
  message:
    "The /api/monitors endpoint is deprecated. Server monitoring is now managed via /api/servers. " +
    "Register your MCP servers at /servers in the dashboard for automatic monitoring.",
  migration_guide: {
    register_server: "POST /api/servers",
    view_scans: "GET /api/scans?serverId=<uuid>",
    view_alerts: "GET /api/alerts",
  },
};

export async function GET() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json(DEPRECATION_RESPONSE, { status: 410 });
}
