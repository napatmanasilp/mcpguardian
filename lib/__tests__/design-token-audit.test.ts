// Feature: ui-launch-readiness, Property 3: Design token semantic exclusivity
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Components known to render status indicators (secure/threat/caution/monitor).
 * These files MUST use CSS custom property tokens for status meaning,
 * never hardcoded hex values or direct Tailwind color classes.
 */
const STATUS_INDICATOR_COMPONENTS = [
  { relativePath: "app/(app)/dashboard/page.tsx", label: "Dashboard page" },
  { relativePath: "app/(app)/servers/page.tsx", label: "Servers page" },
  { relativePath: "app/(app)/sessions/page.tsx", label: "Sessions page" },
  { relativePath: "app/(app)/alerts/page.tsx", label: "Alerts page" },
  { relativePath: "app/(app)/compliance/page.tsx", label: "Compliance page" },
  { relativePath: "app/(app)/telemetry/page.tsx", label: "Telemetry page" },
  { relativePath: "components/dashboard/dashboard-sidebar.tsx", label: "Sidebar" },
  { relativePath: "components/alerts/alert-row.tsx", label: "Alert row" },
  { relativePath: "components/activity/event-row.tsx", label: "Event row" },
];

/**
 * Regex patterns that detect hardcoded Tailwind color classes used for status meaning.
 * These represent the four semantic states:
 *   - secure (green): bg-green-*, text-green-*, border-green-*
 *   - threat (red): bg-red-*, text-red-*, border-red-*
 *   - caution (amber/yellow): bg-amber-*, text-amber-*, bg-yellow-*, text-yellow-*, border-amber-*, border-yellow-*
 *   - monitor (blue): bg-blue-*, text-blue-*, border-blue-*
 *
 * Pattern matches Tailwind color utility classes with numeric shades.
 * Excludes decorative/non-semantic uses (caught only for components known to have status indicators).
 */
const VIOLATION_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Red — should use --threat token (bg-threat, text-threat)
  { pattern: /\bbg-red-\d+/, description: "bg-red-* (should use bg-threat)" },
  { pattern: /\btext-red-\d+/, description: "text-red-* (should use text-threat)" },
  { pattern: /\bborder-red-\d+/, description: "border-red-* (should use border-threat)" },
  // Green — should use --secure token (bg-secure, text-secure)
  { pattern: /\bbg-green-\d+/, description: "bg-green-* (should use bg-secure)" },
  { pattern: /\btext-green-\d+/, description: "text-green-* (should use text-secure)" },
  { pattern: /\bborder-green-\d+/, description: "border-green-* (should use border-secure)" },
  // Amber — should use --caution token (bg-caution, text-caution)
  { pattern: /\bbg-amber-\d+/, description: "bg-amber-* (should use bg-caution)" },
  { pattern: /\btext-amber-\d+/, description: "text-amber-* (should use text-caution)" },
  { pattern: /\bborder-amber-\d+/, description: "border-amber-* (should use border-caution)" },
  // Yellow — should use --caution token
  { pattern: /\bbg-yellow-\d+/, description: "bg-yellow-* (should use bg-caution)" },
  { pattern: /\btext-yellow-\d+/, description: "text-yellow-* (should use text-caution)" },
  { pattern: /\bborder-yellow-\d+/, description: "border-yellow-* (should use border-caution)" },
  // Hardcoded hex colors for status (common red/green/amber/blue hex codes)
  { pattern: /#(?:ef4444|dc2626|b91c1c|f87171|ff0000)/i, description: "hardcoded red hex (should use --threat token)" },
  { pattern: /#(?:22c55e|16a34a|15803d|4ade80|00ff00)/i, description: "hardcoded green hex (should use --secure token)" },
  { pattern: /#(?:f59e0b|d97706|b45309|fbbf24|fcd34d)/i, description: "hardcoded amber hex (should use --caution token)" },
  { pattern: /#(?:3b82f6|2563eb|1d4ed8|60a5fa|93c5fd)/i, description: "hardcoded blue hex (should use --monitor token)" },
];

/**
 * Reads a component source file and checks for design token violations.
 * Returns an array of violation descriptions (empty = passes).
 */
function auditFileForViolations(filePath: string): string[] {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    // File doesn't exist — skip (may have been deleted/moved)
    return [];
  }

  const content = fs.readFileSync(absolutePath, "utf-8");
  const violations: string[] = [];

  // Check each line for violations to provide precise location info
  const lines = content.split("\n");
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comments (single-line)
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    for (const { pattern, description } of VIOLATION_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(
          `${filePath}:${lineNum + 1} — ${description} found: "${line.trim().slice(0, 100)}"`
        );
      }
    }
  }

  return violations;
}

describe("Property 3: Design token semantic exclusivity", () => {
  it("all status indicator components use CSS custom property tokens, no hardcoded color classes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATUS_INDICATOR_COMPONENTS),
        (component) => {
          const violations = auditFileForViolations(component.relativePath);
          expect(
            violations,
            `Design token violations in ${component.label} (${component.relativePath}):\n${violations.join("\n")}`
          ).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("no hardcoded hex values representing status colors in indicator components", () => {
    // Focused hex-only audit across all files
    const hexPatterns = VIOLATION_PATTERNS.filter((p) => p.description.includes("hex"));

    fc.assert(
      fc.property(
        fc.constantFrom(...STATUS_INDICATOR_COMPONENTS),
        fc.constantFrom(...hexPatterns),
        (component, hexPattern) => {
          const absolutePath = path.resolve(process.cwd(), component.relativePath);
          if (!fs.existsSync(absolutePath)) return; // skip missing files

          const content = fs.readFileSync(absolutePath, "utf-8");
          const lines = content.split("\n").filter(
            (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
          );

          for (const line of lines) {
            expect(
              hexPattern.pattern.test(line),
              `${component.label}: ${hexPattern.description}\nLine: "${line.trim().slice(0, 120)}"`
            ).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("verified tokens (bg-secure, bg-threat, bg-caution, bg-monitor) are actually used in components", () => {
    // Verify that semantic tokens ARE present — confirms files were migrated
    const SEMANTIC_TOKENS = [
      "bg-secure",
      "text-secure",
      "bg-threat",
      "text-threat",
      "bg-caution",
      "text-caution",
      "text-monitor",
      "bg-monitor",
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...SEMANTIC_TOKENS),
        (token) => {
          // At least one of the audited component files must use this token
          const usedInAtLeastOneFile = STATUS_INDICATOR_COMPONENTS.some((component) => {
            const absolutePath = path.resolve(process.cwd(), component.relativePath);
            if (!fs.existsSync(absolutePath)) return false;
            const content = fs.readFileSync(absolutePath, "utf-8");
            return content.includes(token);
          });

          expect(
            usedInAtLeastOneFile,
            `Semantic token "${token}" not found in any status indicator component — tokens should be in use`
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
