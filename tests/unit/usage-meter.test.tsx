import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import React from "react";

import { UsageMeter } from "@/components/billing/usage-meter";

describe("UsageMeter", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the label", () => {
    render(<UsageMeter label="Scans" used={10} allowance={100} />);
    expect(screen.getByText("Scans")).toBeDefined();
  });

  it("displays numeric fraction for finite allowances", () => {
    render(<UsageMeter label="Scans" used={45} allowance={100} />);
    expect(screen.getByText(/45/)).toBeDefined();
    expect(screen.getByText(/100/)).toBeDefined();
  });

  it('shows "Unlimited" when allowance is null', () => {
    render(<UsageMeter label="Tool Calls" used={500} allowance={null} />);
    expect(screen.getByText("Unlimited")).toBeDefined();
  });

  it("applies blue color when usage is below 80%", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={50} allowance={100} />
    );
    const bar = container.querySelector(".bg-monitor");
    expect(bar).not.toBeNull();
  });

  it("applies amber color when usage is between 80% and 99%", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={85} allowance={100} />
    );
    const bar = container.querySelector(".bg-caution");
    expect(bar).not.toBeNull();
  });

  it("applies red color when usage is at 100%", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={100} allowance={100} />
    );
    const bar = container.querySelector(".bg-threat");
    expect(bar).not.toBeNull();
  });

  it("applies red color when usage exceeds 100%", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={150} allowance={100} />
    );
    const bar = container.querySelector(".bg-threat");
    expect(bar).not.toBeNull();
  });

  it("renders progress bar with correct ARIA attributes", () => {
    render(<UsageMeter label="Tool Calls" used={30} allowance={200} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeDefined();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("30");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("200");
    expect(progressbar.getAttribute("aria-label")).toBe("Tool Calls usage");
  });

  it("renders progress bar without aria-valuemax when unlimited", () => {
    render(<UsageMeter label="Scans" used={30} allowance={null} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuemax")).toBeNull();
  });

  it("uses custom warningThreshold", () => {
    // With threshold 0.5, 60% should show caution
    const { container } = render(
      <UsageMeter label="Scans" used={60} allowance={100} warningThreshold={0.5} />
    );
    const bar = container.querySelector(".bg-caution");
    expect(bar).not.toBeNull();
  });

  it("bar width is capped at 100% even when usage exceeds allowance", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={200} allowance={100} />
    );
    const bar = container.querySelector("[class*='bg-threat']") as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("100%");
  });

  it("bar width is 0% when allowance is unlimited", () => {
    const { container } = render(
      <UsageMeter label="Scans" used={500} allowance={null} />
    );
    const bar = container.querySelector("[class*='bg-monitor']") as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar!.style.width).toBe("0%");
  });
});
