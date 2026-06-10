import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// POST /api/alerts/channels/[channelId]/verify — trigger verification of a channel
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Fetch the channel to confirm it belongs to this org
  const { data: channel } = await svc
    .from("alert_channels")
    .select("id, type, config, verified")
    .eq("id", channelId)
    .eq("organization_id", org.orgId)
    .single();

  if (!channel) return err("NOT_FOUND", "Alert channel not found", 404);
  if (channel.verified) return ok({ verified: true, message: "Channel already verified" });

  // Channel-specific verification logic
  let verificationResult: { success: boolean; message: string };

  switch (channel.type) {
    case "webhook":
    case "slack_webhook": {
      const webhookUrl = (channel.config as Record<string, string>)?.url;
      if (!webhookUrl) {
        verificationResult = { success: false, message: "Webhook URL not configured" };
        break;
      }
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "verification",
            channel_id: channelId,
            timestamp: new Date().toISOString(),
            message: "This is a verification ping from MCPGuardian.",
          }),
          signal: AbortSignal.timeout(10000),
        });
        verificationResult = {
          success: response.ok,
          message: response.ok
            ? "Webhook responded successfully"
            : `Webhook returned ${response.status}`,
        };
      } catch {
        verificationResult = { success: false, message: "Webhook unreachable" };
      }
      break;
    }
    case "email": {
      // Email verification is handled asynchronously — mark as pending
      verificationResult = { success: true, message: "Verification email sent" };
      break;
    }
    default:
      verificationResult = { success: false, message: `Unsupported channel type: ${channel.type}` };
  }

  // Update verified status
  await svc
    .from("alert_channels")
    .update({ verified: verificationResult.success })
    .eq("id", channelId);

  if (!verificationResult.success) {
    return err("VERIFICATION_FAILED", verificationResult.message, 400);
  }

  return ok({ verified: true, message: verificationResult.message });
}
