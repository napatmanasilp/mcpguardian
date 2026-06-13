import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

import {
  BreadcrumbNav,
  BreadcrumbSegment,
} from "@/components/dashboard/breadcrumb-nav";

describe("BreadcrumbNav", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when segments has only 1 item (top-level route)", () => {
    const segments: BreadcrumbSegment[] = [{ label: "Dashboard" }];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when segments is empty", () => {
    const segments: BreadcrumbSegment[] = [];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a nav with aria-label='Breadcrumb'", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: "My Server" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute("aria-label")).toBe("Breadcrumb");
  });

  it("renders an ordered list (ol) for screen reader support", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: "My Server" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
  });

  it("renders ancestor segments as clickable links", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: "Server Detail" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("/servers");
    expect(links[0].textContent).toBe("Servers");
  });

  it("renders last segment as non-clickable muted text", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: "My Server" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const spans = container.querySelectorAll("span");
    const lastSegment = Array.from(spans).find(
      (s) => s.textContent === "My Server"
    );
    expect(lastSegment).not.toBeNull();
    expect(lastSegment!.getAttribute("aria-current")).toBe("page");
    // Should NOT be a link
    expect(lastSegment!.closest("a")).toBeNull();
  });

  it("renders ChevronRight separators between segments", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Settings", href: "/settings" },
      { label: "Billing", href: "/settings/billing" },
      { label: "Invoices" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    // ChevronRight is rendered as an SVG; there should be 2 separators for 3 segments
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
  });

  it("truncates labels longer than 30 characters with ellipsis", () => {
    const longName = "A".repeat(40);
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: longName },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const spans = container.querySelectorAll("span");
    const lastSegment = Array.from(spans).find(
      (s) => s.getAttribute("aria-current") === "page"
    );
    expect(lastSegment).not.toBeNull();
    expect(lastSegment!.textContent).toBe("A".repeat(30) + "\u2026");
    expect(lastSegment!.textContent!.length).toBe(31); // 30 chars + ellipsis
  });

  it("does not truncate labels of exactly 30 characters", () => {
    const exactName = "B".repeat(30);
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: exactName },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const spans = container.querySelectorAll("span");
    const lastSegment = Array.from(spans).find(
      (s) => s.getAttribute("aria-current") === "page"
    );
    expect(lastSegment).not.toBeNull();
    expect(lastSegment!.textContent).toBe(exactName);
  });

  it("shows title attribute on truncated labels for full text on hover", () => {
    const longName = "C".repeat(35);
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: longName },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const spans = container.querySelectorAll("span");
    const lastSegment = Array.from(spans).find(
      (s) => s.getAttribute("aria-current") === "page"
    );
    expect(lastSegment!.getAttribute("title")).toBe(longName);
  });

  it("renders multiple ancestors as clickable links", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Settings", href: "/settings" },
      { label: "Billing", href: "/settings/billing" },
      { label: "Invoice #123" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("/settings");
    expect(links[1].getAttribute("href")).toBe("/settings/billing");
  });

  it("displays raw identifier as fallback when href is undefined on a non-last segment", () => {
    // Simulates unresolvable entity name - falls back to raw identifier
    const segments: BreadcrumbSegment[] = [
      { label: "Servers", href: "/servers" },
      { label: "abc123-deleted" }, // no href, not the last
      { label: "Details" },
    ];
    const { container } = render(<BreadcrumbNav segments={segments} />);
    // The middle segment without href should render as non-clickable span
    const spans = container.querySelectorAll("span");
    const fallbackSegment = Array.from(spans).find(
      (s) => s.textContent === "abc123-deleted"
    );
    expect(fallbackSegment).not.toBeNull();
    expect(fallbackSegment!.closest("a")).toBeNull();
  });
});
