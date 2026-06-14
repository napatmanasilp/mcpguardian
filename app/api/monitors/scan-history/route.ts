import { NextResponse } from "next/server";

/**
 * @deprecated Use /api/scans or the server detail page instead.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "deprecated",
      message: "Use GET /api/scans?serverId=<uuid> for scan history.",
    },
    { status: 410 },
  );
}
