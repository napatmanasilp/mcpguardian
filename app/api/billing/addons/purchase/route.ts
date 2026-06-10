import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const ADDON_TYPES = [
  "extra_scan_pack_100",
  "forensic_storage_10gb",
  "compliance_report_bundle",
  "nsa_compliance_report",
  "priority_rescan",
  "llm_semantic_classifier",
  "stdio_sidecar",
] as const;

const PurchaseAddonSchema = z.object({
  addonType: z.enum(ADDON_TYPES),
  quantity: z.number().int().min(1).max(1000).default(1),
});

// Price map in cents per unit
const ADDON_PRICES: Record<string, number> = {
  extra_scan_pack_100: 500, // $5 per pack of 100
  forensic_storage_10gb: 999, // $9.99
  compliance_report_bundle: 1999, // $19.99
  nsa_compliance_report: 4999, // $49.99
  priority_rescan: 999, // $9.99
  llm_semantic_classifier: 2999, // $29.99
  stdio_sidecar: 0, // free (license feature)
};

// POST /api/billing/addons/purchase — purchase an addon
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

  const parsed = PurchaseAddonSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const { addonType, quantity } = parsed.data;
  const unitPriceCents = ADDON_PRICES[addonType];

  if (unitPriceCents === 0) {
    // Free addon — just create the record
    const { data: addon, error } = await svc
      .from("addon_purchases")
      .insert({
        organization_id: org.orgId,
        addon_type: addonType,
        quantity,
        unit_price_cents: 0,
        status: "active",
      })
      .select("id")
      .single();

    if (error) return err("INSERT_ERROR", "Failed to create addon", 500);
    return ok({ addonId: addon.id, addonType, quantity, totalCents: 0 }, 201);
  }

  // Paid addon — create a purchase record; webhook marks it active after payment
  const { data: addon, error } = await svc
    .from("addon_purchases")
    .insert({
      organization_id: org.orgId,
      addon_type: addonType,
      quantity,
      unit_price_cents: unitPriceCents,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create addon purchase", 500);

  // In production, redirect to Polar checkout here.
  // For now, mark as active immediately for simplicity.
  await svc.from("addon_purchases").update({ status: "active" }).eq("id", addon.id);

  return ok(
    {
      addonId: addon.id,
      addonType,
      quantity,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
      status: "active",
    },
    201,
  );
}
