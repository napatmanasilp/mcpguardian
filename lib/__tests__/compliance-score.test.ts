import { describe, it, expect } from "vitest";
import { computeComplianceScore, ComplianceControl } from "../compliance-score";

describe("computeComplianceScore", () => {
  it("returns 0 when there are no controls", () => {
    expect(computeComplianceScore([])).toBe(0);
  });

  it("returns 0 when all controls are roadmap (no non-roadmap controls)", () => {
    const controls: ComplianceControl[] = [
      { defaultStatus: "roadmap", passed: false },
      { defaultStatus: "roadmap", passed: true },
    ];
    expect(computeComplianceScore(controls)).toBe(0);
  });

  it("excludes roadmap controls from the score calculation", () => {
    const controls: ComplianceControl[] = [
      { defaultStatus: "passed", passed: true },
      { defaultStatus: "passed", passed: true },
      { defaultStatus: "passed", passed: false },
      { defaultStatus: "roadmap", passed: false }, // should be excluded
    ];
    // 2 passed out of 3 non-roadmap = 67%
    expect(computeComplianceScore(controls)).toBe(67);
  });

  it("returns 100 when all non-roadmap controls pass", () => {
    const controls: ComplianceControl[] = [
      { defaultStatus: "passed", passed: true },
      { defaultStatus: "passed", passed: true },
      { defaultStatus: "roadmap", passed: false },
    ];
    expect(computeComplianceScore(controls)).toBe(100);
  });

  it("returns 0 when no non-roadmap controls pass", () => {
    const controls: ComplianceControl[] = [
      { defaultStatus: "passed", passed: false },
      { defaultStatus: "passed", passed: false },
      { defaultStatus: "roadmap", passed: true },
    ];
    expect(computeComplianceScore(controls)).toBe(0);
  });

  it("correctly rounds the result", () => {
    // 1 passed out of 3 non-roadmap = 33.33... rounds to 33
    const controls: ComplianceControl[] = [
      { defaultStatus: "passed", passed: true },
      { defaultStatus: "passed", passed: false },
      { defaultStatus: "passed", passed: false },
    ];
    expect(computeComplianceScore(controls)).toBe(33);
  });
});
