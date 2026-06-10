import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";
import { createPolarCustomerPortal } from "@/lib/polar-checkout";

// POST /api/billing/portal — create Polar customer portal session
// Body: { returnUrl?: string }
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org } = orgCtx;

  if (!org.polarCustomerId) {
    return err("NO_CUSTOMER_ID", "No Polar customer record found. Subscribe to a plan first.", 400);
  }

  let body: { returnUrl?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const returnUrl =
    body.returnUrl ?? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/billing`;

  try {
    const portalUrl = await createPolarCustomerPortal({
      polarCustomerId: org.polarCustomerId,
      returnUrl,
    });

    return ok({ url: portalUrl });
  } catch (error) {
    console.error("Failed to create Polar portal session:", error);
    return err("PORTAL_ERROR", "Failed to create customer portal session. Please try again.", 500);
  }
}
