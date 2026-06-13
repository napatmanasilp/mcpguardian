import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

import { PageSkeleton, SkeletonBlock } from "@/components/ui/page-skeleton";

describe("PageSkeleton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a skeleton block for each entry in the blocks prop", () => {
    const blocks: SkeletonBlock[] = [
      { type: "header", height: "3rem" },
      { type: "card", height: "8rem" },
      { type: "table", height: "20rem" },
      { type: "chart", height: "16rem" },
    ];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    // The wrapper div should contain 4 direct children (one per block)
    const wrapper = container.firstElementChild!;
    expect(wrapper.children.length).toBe(4);
  });

  it("applies aria-busy and aria-label for accessibility", () => {
    const blocks: SkeletonBlock[] = [{ type: "card", height: "8rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("aria-busy")).toBe("true");
    expect(wrapper.getAttribute("aria-label")).toBe("Loading page content");
  });

  it("renders card blocks with --bg-surface background", () => {
    const blocks: SkeletonBlock[] = [{ type: "card", height: "10rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const cardElement = container.querySelector(".shimmer") as HTMLElement;
    expect(cardElement).not.toBeNull();
    expect(cardElement.style.backgroundColor).toBe("var(--bg-surface)");
  });

  it("renders card blocks with the specified height", () => {
    const blocks: SkeletonBlock[] = [{ type: "card", height: "12rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const cardElement = container.querySelector(".shimmer") as HTMLElement;
    expect(cardElement.style.height).toBe("12rem");
  });

  it("renders header blocks with two shimmer elements (title + subtitle)", () => {
    const blocks: SkeletonBlock[] = [{ type: "header", height: "3rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const shimmerElements = container.querySelectorAll(".shimmer");
    expect(shimmerElements.length).toBe(2);
  });

  it("renders table blocks with shimmer rows", () => {
    const blocks: SkeletonBlock[] = [{ type: "table", height: "20rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    // 1 header row + 5 data rows = 6 shimmer elements
    const shimmerElements = container.querySelectorAll(".shimmer");
    expect(shimmerElements.length).toBe(6);
  });

  it("renders chart blocks with shimmer class and --bg-surface", () => {
    const blocks: SkeletonBlock[] = [{ type: "chart", height: "16rem" }];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const chartElement = container.querySelector(".shimmer") as HTMLElement;
    expect(chartElement).not.toBeNull();
    expect(chartElement.style.backgroundColor).toBe("var(--bg-surface)");
    expect(chartElement.style.height).toBe("16rem");
  });

  it("renders empty when no blocks are provided", () => {
    const { container } = render(<PageSkeleton blocks={[]} />);
    const wrapper = container.firstElementChild!;
    expect(wrapper.children.length).toBe(0);
  });

  it("all shimmer elements use the shimmer CSS class", () => {
    const blocks: SkeletonBlock[] = [
      { type: "card", height: "8rem" },
      { type: "chart", height: "12rem" },
    ];

    const { container } = render(<PageSkeleton blocks={blocks} />);
    const shimmerElements = container.querySelectorAll(".shimmer");
    // At minimum, one per card/chart block
    expect(shimmerElements.length).toBeGreaterThanOrEqual(2);
  });
});
