import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok } from "@/lib/api-helpers";

const ContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Must be a valid email"),
  company: z.string().min(1, "Company is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
});

// POST /api/contact — receive Enterprise inquiry form submissions
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  }

  const { name, email, company, message } = parsed.data;

  // Log the inquiry for now. In production this would send an email,
  // write to a CRM, or enqueue a notification to the sales team.
  console.log("[POST /api/contact] Enterprise inquiry received:", {
    name,
    email,
    company,
    message: message.slice(0, 100) + (message.length > 100 ? "..." : ""),
    timestamp: new Date().toISOString(),
  });

  return ok({ received: true }, 200);
}
