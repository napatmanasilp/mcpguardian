// Feature: mcpguardian-ux-improvements, Property 16: Sparkline renders data left-to-right
// **Validates: Requirements 13.1**

import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { Sparkline } from "@/components/telemetry/sparkline";

/**
 * Helper: parse the SVG polyline "points" attribute into an array of {x, y} objects.
 */
function parsePoints(pointsAttr: string): { x: number; y: number }[] {
  return pointsAttr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
}

describe("Property 16: Sparkline renders data left-to-right (oldest to newest)", () => {
  afterEach(() => {
    cleanup();
  });

  it("X coordinates in polyline points are monotonically non-decreasing for any data array of length 2+", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 100,
        }),
        (data) => {
          cleanup();

          const { container } = render(<Sparkline data={data} width={120} height={32} />);
          const polyline = container.querySelector("polyline");

          expect(polyline).not.toBeNull();

          const pointsAttr = polyline!.getAttribute("points");
          expect(pointsAttr).not.toBeNull();

          const points = parsePoints(pointsAttr!);
          expect(points.length).toBe(data.length);

          // Verify X coordinates are monotonically non-decreasing (left-to-right)
          for (let i = 1; i < points.length; i++) {
            expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("first point starts at X=0 and last point ends at X=width for arrays with 2+ elements", () => {
    const width = 120;

    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 50,
        }),
        (data) => {
          cleanup();

          const { container } = render(<Sparkline data={data} width={width} height={32} />);
          const polyline = container.querySelector("polyline");
          const pointsAttr = polyline!.getAttribute("points");
          const points = parsePoints(pointsAttr!);

          // First point should be at x=0 (oldest, leftmost)
          expect(points[0].x).toBeCloseTo(0, 5);
          // Last point should be at x=width (newest, rightmost)
          expect(points[points.length - 1].x).toBeCloseTo(width, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("single data point renders at the horizontal center", () => {
    const width = 120;
    cleanup();

    const { container } = render(<Sparkline data={[42]} width={width} height={32} />);
    const polyline = container.querySelector("polyline");
    const pointsAttr = polyline!.getAttribute("points");
    const points = parsePoints(pointsAttr!);

    expect(points.length).toBe(1);
    expect(points[0].x).toBeCloseTo(width / 2, 5);
  });
});
