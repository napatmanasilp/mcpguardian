/**
 * Usage threshold utility functions.
 */

/**
 * Determines whether a warning badge should be shown for a usage metric.
 *
 * Returns true iff:
 * - The allowance is NOT null (not unlimited), AND
 * - Either: allowance is 0 and used > 0, OR used/allowance >= 0.8
 *
 * Returns false if allowance is null (unlimited — never warn).
 */
export function isWarningThreshold(used: number, allowance: number | null): boolean {
  if (allowance === null) return false; // unlimited — never show warning
  if (allowance === 0) return used > 0;
  return used / allowance >= 0.8;
}
