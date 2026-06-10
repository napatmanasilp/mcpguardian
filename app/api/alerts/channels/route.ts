import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const CreateChannelSchema = z.object({
  type: z.enum(["email", "webhook", "slack_webhook"]),
  name: z.string().min(1).max(100),
  config: z.record(z.string(), z.unknown()),
});

// GET /api/alerts/channels
export async function GET() {
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;
  const { org, svc } = orgCtx;

  const { data, error } = await svc
    .from("alert_channels")
    .select("*")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false });

  if (error) return err("FETCH_ERROR", "Failed to fetch channels", 500);
  return ok(data ?? []);
}

// POST /api/alerts/channels
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;
  const { org, svc } = orgCtx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = CreateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join(", "), 400);
  }

  const { data: channel, error } = await svc
    .from("alert_channels")
    .insert({
      organization_id: org.orgId,
      type: parsed.data.type,
      name: parsed.data.name,
      config: parsed.data.config,
      verified: false,
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create channel", 500);
  return ok({ channelId: channel.id }, 201);
}

// DELETE /api/alerts/channels?channelId=
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;
  const { org, svc } = orgCtx;

  const channelId = request.nextUrl.searchParams.get("channelId");
  if (!channelId) return err("MISSING_CHANNEL_ID", "channelId query parameter required", 400);

  const { error } = await svc
    .from("alert_channels")
    .delete()
    .eq("id", channelId)
    .eq("organization_id", org.orgId);

  if (error) return err("DELETE_ERROR", "Failed to delete channel", 500);
  return ok({ deleted: true });
}
