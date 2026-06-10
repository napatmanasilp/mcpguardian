/**
 * SANDBOX OUTPUT VALIDATOR
 * =======================
 * Runs BEFORE the controller reads sandbox results.
 * Prevents malicious servers from exploiting the controller
 * through crafted JSON in the results file.
 *
 * SECURITY CHECKS:
 * 1. Is file valid JSON?
 * 2. Is file within size limits? (< 10MB)
 * 3. Does scan_id match what we sent?
 * 4. Are there unexpected fields that could indicate tampering?
 */

export interface SandboxValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  scanIdMatch?: boolean;
  fileSize?: number;
  fieldCount?: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'scan_id',
  'timestamp',
  'target_url',
  'mode',
  'probes',
  'tool_hash',
  'tool_risk_matrix',
  'raw_tools',
  'error',
  'errors',
]);

const ALLOWED_PROBE_FIELDS = new Set([
  'unauth_access',
  'tool_fetch',
  'injection_scan',
  'structural_anomalies',
  'source_analysis',
  'consistency_check',
  'cors_check',
  'stdio_execution',
  'stdio_tool_fetch',
]);

/**
 * Validate sandbox output before controller reads it.
 */
export function validateSandboxOutput(
  rawContent: string,
  expectedScanId: string,
  maxSize: number = MAX_FILE_SIZE,
): SandboxValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: File size
  const fileSize = Buffer.byteLength(rawContent, 'utf-8');
  if (fileSize > maxSize) {
    errors.push(`Output file too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max ${(maxSize / 1024 / 1024).toFixed(0)}MB). Possible data exfiltration attempt.`);
    return { valid: false, errors, warnings, fileSize };
  }

  // Check 2: Valid JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    errors.push('Output is not valid JSON. Possible corrupted output or injection attempt.');
    return { valid: false, errors, warnings, fileSize };
  }

  if (!parsed || typeof parsed !== 'object') {
    errors.push('Output is not a JSON object.');
    return { valid: false, errors, warnings, fileSize };
  }

  const data = parsed as Record<string, unknown>;
  const fieldCount = Object.keys(data).length;

  // Check 3: scan_id match
  if (expectedScanId && data.scan_id !== expectedScanId) {
    errors.push(`Scan ID mismatch: expected "${expectedScanId}", got "${data.scan_id}". Possible tampering.`);
    return { valid: false, errors, warnings, fileSize, scanIdMatch: false, fieldCount };
  }

  // Check 4: Unexpected top-level fields
  for (const key of Object.keys(data)) {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
      warnings.push(`Unexpected top-level field: "${key}". Possible data injection.`);
    }
  }

  // Check 5: Validate probes structure
  if (data.probes && typeof data.probes === 'object') {
    for (const key of Object.keys(data.probes as Record<string, unknown>)) {
      if (!ALLOWED_PROBE_FIELDS.has(key)) {
        warnings.push(`Unexpected probe field: "${key}". Possible tampering.`);
      }
    }
  }

  // Check 6: Warn if error field present
  if (data.error) {
    warnings.push(`Sandbox reported error: ${data.error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    scanIdMatch: true,
    fileSize,
    fieldCount,
  };
}

/**
 * Extract probe results safely from validated output.
 * Type-safe accessor that returns null for missing/malformed fields.
 */
export function extractProbeResult(
  rawOutput: unknown,
  probeName: string,
): Record<string, unknown> | null {
  if (!rawOutput || typeof rawOutput !== 'object') return null;
  const data = rawOutput as Record<string, unknown>;
  const probes = data.probes;
  if (!probes || typeof probes !== 'object') return null;
  const result = (probes as Record<string, unknown>)[probeName];
  if (!result || typeof result !== 'object') return null;
  return result as Record<string, unknown>;
}
