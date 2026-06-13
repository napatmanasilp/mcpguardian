/**
 * Pure function to compute the compliance score, excluding roadmap controls.
 *
 * Controls with `defaultStatus === "roadmap"` are filtered out before calculating
 * the percentage of passed controls.
 */

export interface ComplianceControl {
  defaultStatus: "passed" | "roadmap";
  passed: boolean;
}

/**
 * Computes a compliance score as a percentage (0–100) of passed non-roadmap controls.
 *
 * - Filters out controls where `defaultStatus === "roadmap"`
 * - Returns `Math.round((passedNonRoadmapCount / totalNonRoadmapCount) * 100)`
 * - Returns `0` if there are no non-roadmap controls
 */
export function computeComplianceScore(controls: ComplianceControl[]): number {
  const nonRoadmap = controls.filter((c) => c.defaultStatus !== "roadmap");
  if (nonRoadmap.length === 0) return 0;
  const passedCount = nonRoadmap.filter((c) => c.passed).length;
  return Math.round((passedCount / nonRoadmap.length) * 100);
}
