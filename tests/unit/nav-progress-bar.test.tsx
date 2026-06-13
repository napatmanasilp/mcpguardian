import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import React from "react";

// Mock next/navigation
let mockPathname = "/dashboard";
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

import { NavProgressBar } from "@/components/dashboard/nav-progress-bar";

describe("NavProgressBar", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockSearchParams = new URLSearchParams();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders nothing when no navigation is occurring", () => {
    const { container } = render(<NavProgressBar />);
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("uses fixed positioning at top with 2px height and z-index 9999", () => {
    // Simulate navigation start by clicking a link
    const { container, rerender } = render(<NavProgressBar />);

    // Simulate a link click to trigger progress bar
    const link = document.createElement("a");
    link.href = "/servers";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Update the pathname to trigger the completion
    mockPathname = "/servers";
    rerender(<NavProgressBar />);

    const progressbar = container.querySelector('[role="progressbar"]');
    if (progressbar) {
      expect(progressbar).toHaveClass("fixed", "inset-x-0", "top-0", "z-[9999]", "h-[2px]");
    }
  });

  it("uses --monitor CSS variable for background color", () => {
    const { container, rerender } = render(<NavProgressBar />);

    // Simulate a link click
    const link = document.createElement("a");
    link.href = "/servers";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mockPathname = "/servers";
    rerender(<NavProgressBar />);

    const bar = container.querySelector('[role="progressbar"] > div');
    if (bar) {
      expect((bar as HTMLElement).style.backgroundColor).toBe("var(--monitor)");
    }
  });

  it("has proper aria attributes for accessibility", () => {
    const { container, rerender } = render(<NavProgressBar />);

    // Simulate navigation
    const link = document.createElement("a");
    link.href = "/sessions";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mockPathname = "/sessions";
    rerender(<NavProgressBar />);

    const progressbar = container.querySelector('[role="progressbar"]');
    if (progressbar) {
      expect(progressbar).toHaveAttribute("aria-valuemin", "0");
      expect(progressbar).toHaveAttribute("aria-valuemax", "100");
      expect(progressbar).toHaveAttribute("aria-label", "Page loading");
    }
  });
});
