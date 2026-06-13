import { z } from "zod";

// ─── Settings Schemas ─────────────────────────────────────────────────

export const OrgNameSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, "Organization name is required.")
        .max(100, "Organization name must be between 1 and 100 characters."),
    ),
});

export const OrgTimezoneSchema = z.object({
  timezone: z
    .string()
    .min(1, "Timezone is required.")
    .refine(
      (val) => {
        try {
          const validTimezones = Intl.supportedValuesOf("timeZone");
          return validTimezones.includes(val.trim());
        } catch {
          return /^[A-Za-z_/]+$/.test(val.trim());
        }
      },
      { message: "Invalid timezone." },
    ),
});

// ─── Server Schemas ───────────────────────────────────────────────────

export const AddServerSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim())
      .pipe(
        z
          .string()
          .min(1, "Server name is required")
          .max(253, "Server name must be 253 characters or fewer"),
      ),
    transport: z.enum(["http", "stdio"]),
    endpoint: z.string().optional(),
    command: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.transport === "http") {
      if (!data.endpoint || data.endpoint.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Endpoint URL is required for HTTP transport",
          path: ["endpoint"],
        });
      } else {
        try {
          new URL(data.endpoint.trim());
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Must be a valid URL",
            path: ["endpoint"],
          });
        }
      }
    }
    if (data.transport === "stdio") {
      if (!data.command || data.command.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STDIO command is required",
          path: ["command"],
        });
      }
    }
  });

// ─── Alerts Schemas ───────────────────────────────────────────────────

export const MarkAlertReadSchema = z.object({
  alertId: z.string().uuid("Invalid alert ID."),
});

// ─── Validation Helper ────────────────────────────────────────────────

import type { ActionState } from "@/lib/types/settings";

/**
 * Validates input against a Zod schema and returns an ActionState.
 * This mirrors the validation pattern used in all server actions.
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): ActionState | null {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError, fieldErrors };
  }
  return null; // null means validation passed
}
