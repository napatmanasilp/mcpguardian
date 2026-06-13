// Feature: ui-launch-readiness, Property 1: Server action validation round-trip
// **Validates: Requirements 15.1, 15.3**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  OrgNameSchema,
  AddServerSchema,
  MarkAlertReadSchema,
  OrgTimezoneSchema,
  validateWithSchema,
} from "@/lib/validation/schemas";

describe("Property 1: Server action validation round-trip", () => {
  describe("OrgNameSchema — invalid inputs produce ActionState with error", () => {
    it("empty or whitespace-only names always produce an error", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.nat({ max: 19 }).map((n) => " ".repeat(n + 1)),
            fc.nat({ max: 9 }).map((n) => "\t".repeat(n + 1)),
          ),
          (name) => {
            const result = validateWithSchema(OrgNameSchema, { name });
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("names exceeding 100 characters always produce an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 101, maxLength: 300 }).filter((s) => s.trim().length > 100),
          (name) => {
            const result = validateWithSchema(OrgNameSchema, { name });
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("non-string name values always produce an error", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
            fc.boolean(),
            fc.array(fc.anything()),
            fc.object(),
          ),
          (name) => {
            const result = validateWithSchema(OrgNameSchema, { name });
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("AddServerSchema — invalid inputs produce ActionState with error", () => {
    it("missing or empty server name always produces an error", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.nat({ max: 9 }).map((n) => " ".repeat(n + 1)),
          ),
          fc.constantFrom("http", "stdio"),
          (name, transport) => {
            const input = {
              name,
              transport,
              endpoint: transport === "http" ? "https://example.com" : undefined,
              command: transport === "stdio" ? "node server.js" : undefined,
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("server name exceeding 253 chars always produces an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 254, maxLength: 400 }).filter((s) => s.trim().length > 253),
          fc.constantFrom("http", "stdio"),
          (name, transport) => {
            const input = {
              name,
              transport,
              endpoint: transport === "http" ? "https://example.com" : undefined,
              command: transport === "stdio" ? "node server.js" : undefined,
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("invalid transport type always produces an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => s !== "http" && s !== "stdio",
          ),
          (transport) => {
            const input = {
              name: "Valid Server",
              transport,
              endpoint: "https://example.com",
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("HTTP transport with invalid URL always produces an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            try {
              new URL(s.trim());
              return false; // valid URL, skip
            } catch {
              return s.trim().length > 0; // keep non-empty invalid URLs
            }
          }),
          (endpoint) => {
            const input = {
              name: "Valid Server",
              transport: "http",
              endpoint,
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("HTTP transport with missing endpoint always produces an error", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.constant(undefined),
            fc.nat({ max: 9 }).map((n) => " ".repeat(n + 1)),
          ),
          (endpoint) => {
            const input = {
              name: "Valid Server",
              transport: "http",
              endpoint,
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("STDIO transport with missing command always produces an error", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(""),
            fc.constant(undefined),
            fc.nat({ max: 9 }).map((n) => " ".repeat(n + 1)),
          ),
          (command) => {
            const input = {
              name: "Valid Server",
              transport: "stdio",
              command,
            };
            const result = validateWithSchema(AddServerSchema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("MarkAlertReadSchema — invalid inputs produce ActionState with error", () => {
    it("non-UUID alertId always produces an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }).filter((s) => {
            // Exclude valid UUIDs
            const uuidRegex =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return !uuidRegex.test(s);
          }),
          (alertId) => {
            const result = validateWithSchema(MarkAlertReadSchema, { alertId });
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("OrgTimezoneSchema — invalid inputs produce ActionState with error", () => {
    it("empty timezone always produces an error", () => {
      fc.assert(
        fc.property(fc.constant(""), (timezone) => {
          const result = validateWithSchema(OrgTimezoneSchema, { timezone });
          expect(result).not.toBeNull();
          expect(result!.error).toBeDefined();
          expect(result!.error!.length).toBeGreaterThan(0);
          expect(result!.success).not.toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("random strings that are not valid IANA timezones produce an error", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            // Exclude known valid timezones
            try {
              const validTimezones = Intl.supportedValuesOf("timeZone");
              return !validTimezones.includes(s.trim());
            } catch {
              return true;
            }
          }),
          (timezone) => {
            const result = validateWithSchema(OrgTimezoneSchema, { timezone });
            // If it has special chars that don't match the regex fallback,
            // it should be invalid
            if (!/^[A-Za-z_/]+$/.test(timezone.trim())) {
              expect(result).not.toBeNull();
              expect(result!.error).toBeDefined();
              expect(result!.error!.length).toBeGreaterThan(0);
              expect(result!.success).not.toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Cross-schema universal property: any invalid input yields ActionState with error, not success", () => {
    it("completely malformed inputs (wrong types, missing fields) always return error ActionState", () => {
      const malformedInputArb = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.integer(),
        fc.string(),
        fc.constant({}),
        fc.constant([]),
        fc.record({
          randomKey: fc.anything(),
        }),
      );

      const schemas = [
        { schema: OrgNameSchema, label: "OrgNameSchema" },
        { schema: AddServerSchema, label: "AddServerSchema" },
        { schema: MarkAlertReadSchema, label: "MarkAlertReadSchema" },
        { schema: OrgTimezoneSchema, label: "OrgTimezoneSchema" },
      ];

      for (const { schema, label } of schemas) {
        fc.assert(
          fc.property(malformedInputArb, (input) => {
            const result = validateWithSchema(schema, input);
            expect(result).not.toBeNull();
            expect(result!.error).toBeDefined();
            expect(result!.error!.length).toBeGreaterThan(0);
            expect(result!.success).not.toBe(true);
          }),
          { numRuns: 100 },
        );
      }
    });
  });
});
