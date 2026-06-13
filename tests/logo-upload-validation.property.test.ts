// Feature: mcpguardian-ux-improvements, Property 22: Logo upload file validation
// **Validates: Requirements 15.1, 15.3**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateLogoFile } from "@/lib/utils/settings";

const VALID_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

describe("Property 22: Logo upload rejects invalid files", () => {
  it("accepts any file with a valid MIME type and size ≤ 2MB", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_MIME_TYPES),
        fc.integer({ min: 0, max: MAX_SIZE }),
        (type, size) => {
          const result = validateLogoFile(type, size);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects any file with an invalid MIME type regardless of size", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) => !VALID_MIME_TYPES.includes(s as (typeof VALID_MIME_TYPES)[number])
        ),
        fc.integer({ min: 0, max: MAX_SIZE }),
        (type, size) => {
          const result = validateLogoFile(type, size);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects any file with size > 2MB even if the MIME type is valid", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_MIME_TYPES),
        fc.integer({ min: MAX_SIZE + 1, max: MAX_SIZE * 10 }),
        (type, size) => {
          const result = validateLogoFile(type, size);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects files with both invalid MIME type and size > 2MB", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) => !VALID_MIME_TYPES.includes(s as (typeof VALID_MIME_TYPES)[number])
        ),
        fc.integer({ min: MAX_SIZE + 1, max: MAX_SIZE * 10 }),
        (type, size) => {
          const result = validateLogoFile(type, size);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("validation is a total function: for any type and non-negative size, it returns a valid result object", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: MAX_SIZE * 20 }),
        (type, size) => {
          const result = validateLogoFile(type, size);
          expect(typeof result.valid).toBe("boolean");
          if (!result.valid) {
            expect(typeof result.error).toBe("string");
            expect(result.error!.length).toBeGreaterThan(0);
          } else {
            expect(result.error).toBeUndefined();
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});
