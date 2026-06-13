/**
 * Pure validation helpers for settings server actions.
 * Extracted for testability.
 */

// --- Logo upload validation ---

const VALID_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml"] as const;
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface LogoFileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a logo file's MIME type and size.
 *
 * Rules:
 * - MIME type must be one of: image/png, image/jpeg, image/svg+xml
 * - File size must be ≤ 2 MB (2 * 1024 * 1024 bytes)
 *
 * @param type - The MIME type of the file
 * @param size - The size of the file in bytes
 * @returns Validation result with optional error message
 */
export function validateLogoFile(type: string, size: number): LogoFileValidationResult {
  if (!VALID_LOGO_MIME_TYPES.includes(type as (typeof VALID_LOGO_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: "File type not supported. Please upload a PNG, JPEG, or SVG file.",
    };
  }

  if (size > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      error: "File is too large. Maximum size is 2 MB.",
    };
  }

  return { valid: true };
}

export interface OrgNameValidationResult {
  valid: boolean;
  trimmedName: string;
  error?: string;
}

/**
 * Validates an organization name input.
 * Rules:
 * - Input must be a string
 * - After trimming, length must be 1–100 characters
 *
 * @param rawName - The raw input value from the form
 * @returns Validation result with trimmed name and optional error
 */
// --- Delete confirmation guard ---

/**
 * Determines whether the "Confirm Delete" button should be enabled.
 * The button is only enabled when the typed string exactly matches the org name
 * (case-sensitive).
 *
 * @param typed - The value typed by the user in the confirmation input
 * @param orgName - The actual organization name that must be matched
 * @returns true if typed === orgName (exact, case-sensitive match)
 */
export function isDeleteConfirmEnabled(typed: string, orgName: string): boolean {
  return typed === orgName;
}

export function validateOrgName(rawName: unknown): OrgNameValidationResult {
  if (typeof rawName !== "string") {
    return { valid: false, trimmedName: "", error: "Organization name is required." };
  }

  const trimmedName = rawName.trim();

  if (trimmedName.length < 1 || trimmedName.length > 100) {
    return {
      valid: false,
      trimmedName,
      error: "Organization name must be between 1 and 100 characters.",
    };
  }

  return { valid: true, trimmedName };
}
