// Feature: mcpguardian-ux-improvements, Property 7: Onboarding Stepper renders correct state for any step index
// **Validates: Requirements 6.4, 6.5, 6.6**

import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import React from "react";

import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";

/**
 * Arbitrary for valid step indices: 0, 1, 2, or 3
 */
const stepIndexArbitrary = fc.integer({ min: 0, max: 3 }) as fc.Arbitrary<
  0 | 1 | 2 | 3
>;

describe("Property 7: Onboarding Stepper renders correct state for any step index", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders exactly one active step at index i, checkmarks for all < i, and unfilled for all > i", () => {
    fc.assert(
      fc.property(stepIndexArbitrary, (currentStep) => {
        cleanup();

        const { container } = render(
          <OnboardingSteps currentStep={currentStep} />
        );

        // Each step is rendered as a circle indicator (the div with size-8)
        const stepIndicators = container.querySelectorAll(
          ".flex.items-center > .flex.flex-col.items-center > div:first-child"
        );

        // There should be exactly 4 step indicators
        expect(stepIndicators).toHaveLength(4);

        let activeCount = 0;
        let completedCount = 0;
        let pendingCount = 0;

        stepIndicators.forEach((indicator, i) => {
          const hasCheckmark = indicator.querySelector("svg") !== null;
          const hasNumber = indicator.querySelector("span") !== null;
          const style = (indicator as HTMLElement).style;
          const bgColor = style.backgroundColor;
          const borderColor = style.borderColor;

          if (i < currentStep) {
            // Completed steps: should have checkmark icon and use --secure bg
            expect(hasCheckmark).toBe(true);
            expect(bgColor).toContain("var(--secure)");
            completedCount++;
          } else if (i === currentStep) {
            // Active step: should have number (not checkmark), use --secure bg
            expect(hasNumber).toBe(true);
            expect(hasCheckmark).toBe(false);
            expect(bgColor).toContain("var(--secure)");
            activeCount++;
          } else {
            // Pending steps: should have number, use --monitor border, no filled bg
            expect(hasNumber).toBe(true);
            expect(hasCheckmark).toBe(false);
            expect(borderColor).toContain("var(--monitor)");
            // Pending steps should NOT have --secure background
            expect(bgColor).not.toContain("var(--secure)");
            pendingCount++;
          }
        });

        // Exactly one active step
        expect(activeCount).toBe(1);
        // Completed steps = currentStep index
        expect(completedCount).toBe(currentStep);
        // Pending steps = 3 - currentStep
        expect(pendingCount).toBe(3 - currentStep);

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
