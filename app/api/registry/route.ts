import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getRegistryForOrg,
  submitForApproval,
  approveServer,
  revokeServer,
  checkAllowlist,
} from '@/lib/registry/allowlist-manager';

// ─── Auth Helper ─────────────────────────────────────────────────────

async function requireUser(request: NextRequest): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as NextResponse;
  }
  return { userId: user.id };
}

function isErrorResponse(resp: unknown): resp is NextResponse {
  return resp instanceof NextResponse;
}

// ─── Schemas ─────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  organization_id: z.string().uuid(),
  server_url: z.string().url(),
  scan_id: z.string().uuid(),
  scan_score: z.number().int().min(0).max(100),
  tool_hash: z.string().min(1),
});

const ApproveSchema = z.object({
  organization_id: z.string().uuid(),
  server_url: z.string().url(),
});

const RevokeSchema = z.object({
  organization_id: z.string().uuid(),
  server_url: z.string().url(),
  reason: z.string().min(1),
});

const CheckSchema = z.object({
  organization_id: z.string().uuid(),
  server_url: z.string().url(),
});

// ─── Routes ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (isErrorResponse(auth)) return auth;

  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/registry/check → checkAllowlist (for agent integrations)
  if (path.endsWith('/check')) {
    const orgId = url.searchParams.get('organization_id');
    const serverUrl = url.searchParams.get('server_url');
    if (!orgId || !serverUrl) {
      return NextResponse.json(
        { error: 'Missing organization_id and/or server_url query parameters' },
        { status: 400 },
      );
    }
    const result = await checkAllowlist(orgId, serverUrl);
    return NextResponse.json({ allowlist_check: result }, { status: 200 });
  }

  // GET /api/registry → list registry entries
  const orgId = url.searchParams.get('organization_id');
  if (!orgId) {
    return NextResponse.json({ error: 'Missing organization_id query parameter' }, { status: 400 });
  }

  const entries = await getRegistryForOrg(orgId);
  return NextResponse.json({ entries }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (isErrorResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { organization_id, server_url, scan_id, scan_score, tool_hash } = parsed.data;

  await submitForApproval(organization_id, server_url, scan_id, scan_score, tool_hash);

  return NextResponse.json({
    message: 'Server submitted for approval',
    organization_id,
    server_url,
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (isErrorResponse(auth)) return auth;

  const action = request.nextUrl.searchParams.get('action');
  if (!action || !['approve', 'revoke'].includes(action)) {
    return NextResponse.json(
      { error: 'Missing or invalid action. Use ?action=approve or ?action=revoke' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (action === 'approve') {
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }
    const { organization_id, server_url } = parsed.data;
    await approveServer(organization_id, server_url, auth.userId);
    return NextResponse.json({ message: 'Server approved', organization_id, server_url }, { status: 200 });
  }

  // revoke
  const parsed = RevokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
  }
  const { organization_id, server_url, reason } = parsed.data;
  await revokeServer(organization_id, server_url, reason);
  return NextResponse.json({ message: 'Server revoked', organization_id, server_url }, { status: 200 });
}
