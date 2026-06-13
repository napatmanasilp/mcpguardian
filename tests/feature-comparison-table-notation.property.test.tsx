// Feature: mcpguardian-ux-improvements, Property 26: Feature comparison table notation
// **Validates: Requirements 17.1**

import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import React from "react";

import {
  FEATURES,
  PLAN_HEADERS,
  CellContent,
  FeatureValue,
} from "@/components/upgrade/feature-comparison-table";

const PLAN_KEYS = ["free", "developer", "team", "startup", "enterprise"] as const;
type PlanKey = (typeof PLAN_KEYS)[number];

/**
 * Arbitrary that picks a valid row index from the FEATURES array.
 */
const rowIndexArb = fc.integer({ min: 0, max: FEATURES.length - 1 });

/**
 * Arbitrary that picks a valid plan column index.
 */
const colIndexArb = fc.integer({ min: 0, max: PLAN_KEYS.length - 1 });

describe("Property 26: Feature comparison table uses Check/Minus notation correctly", () => {
  afterEach(() => {
    cleanup();
  });

  it("boolean true renders a Check icon (included)", () => {
    fc.assert(
      fc.property(rowIndexArb, colIndexArb, (rowIdx, colIdx) => {
        const feature = FEATURES[rowIdx];
        const planKey = PLAN_KEYS[colIdx];
        const value: FeatureValue = feature[planKey];

        // Only test cells where value is boolean true
        if (value !== true) return;

        cleanup();
        const { container } = render(<CellContent value={value} />);

        // Should render an SVG element (lucide Check icon)
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();

        // Should have the secure color class (Check icon styling)
        expect(svg!.classList.contains("text-secure")).toBe(true);

        // Should NOT contain a text span
        const span = container.querySelector("span");
        expect(span).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("boolean false renders a Minus icon (not included)", () => {
    fc.assert(
      fc.property(rowIndexArb, colIndexArb, (rowIdx, colIdx) => {
        const feature = FEATURES[rowIdx];
        const planKey = PLAN_KEYS[colIdx];
        const value: FeatureValue = feature[planKey];

        // Only test cells where value is boolean false
        if (value !== false) return;

        cleanup();
        const { container } = render(<CellContent value={value} />);

        // Should render an SVG element (lucide Minus icon)
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();

        // Should have the slate color class (Minus icon styling)
        expect(svg!.classList.contains("text-slate-600")).toBe(true);

        // Should NOT contain a text span
        const span = container.querySelector("span");
        expect(span).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("string values render as text in a span", () => {
    fc.assert(
      fc.property(rowIndexArb, colIndexArb, (rowIdx, colIdx) => {
        const feature = FEATURES[rowIdx];
        const planKey = PLAN_KEYS[colIdx];
        const value: FeatureValue = feature[planKey];

        // Only test cells where value is a string
        if (typeof value !== "string") return;

        cleanup();
        const { container } = render(<CellContent value={value} />);

        // Should render a span containing the text
        const span = container.querySelector("span");
        expect(span).not.toBeNull();
        expect(span!.textContent).toBe(value);

        // Should NOT render an SVG icon
        const svg = container.querySelector("svg");
        expect(svg).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("every cell in the table renders exactly one of: Check, Minus, or text span", () => {
    fc.assert(
      fc.property(rowIndexArb, colIndexArb, (rowIdx, colIdx) => {
        const feature = FEATURES[rowIdx];
        const planKey = PLAN_KEYS[colIdx];
        const value: FeatureValue = feature[planKey];

        cleanup();
        const { container } = render(<CellContent value={value} />);

        const svg = container.querySelector("svg");
        const span = container.querySelector("span");

        if (value === true) {
          // Check icon present, no text span
          expect(svg).not.toBeNull();
          expect(span).toBeNull();
          expect(svg!.classList.contains("text-secure")).toBe(true);
        } else if (value === false) {
          // Minus icon present, no text span
          expect(svg).not.toBeNull();
          expect(span).toBeNull();
          expect(svg!.classList.contains("text-slate-600")).toBe(true);
        } else {
          // String: text span present, no SVG icon
          expect(span).not.toBeNull();
          expect(span!.textContent).toBe(value);
          expect(svg).toBeNull();
        }
      }),
      { numRuns: 200 }
    );
  });
});
