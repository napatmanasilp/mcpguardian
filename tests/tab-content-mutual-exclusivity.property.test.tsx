// Feature: mcpguardian-ux-improvements, Property 8: Onboarding Step 2 tab content is mutually exclusive
// **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6**

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup, fireEvent, act, screen } from "@testing-library/react";
import React, { useState } from "react";

// Mock sonner toast (used by copy handler)
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientInstructions } from "@/components/onboarding/client-instructions";

const ALL_TABS = ["claude-desktop", "cursor", "cline", "custom"] as const;
type TabValue = (typeof ALL_TABS)[number];

const TAB_LABEL_MAP: Record<TabValue, string> = {
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
  cline: "Cline",
  custom: "Custom",
};

/**
 * Arbitrary that picks one of the four valid tab values.
 */
const tabArbitrary = fc.constantFrom(...ALL_TABS);

/**
 * Controlled wrapper that renders ClientInstructions' Tabs with a forced initial value.
 * This allows us to test the mutual exclusivity property for each tab deterministically
 * without relying on click event propagation in jsdom.
 */
function ControlledClientTabs({ activeTab }: { activeTab: TabValue }) {
  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
        <TabsTrigger value="cursor">Cursor</TabsTrigger>
        <TabsTrigger value="cline">Cline</TabsTrigger>
        <TabsTrigger value="custom">Custom</TabsTrigger>
      </TabsList>
      <TabsContent value="claude-desktop">Claude Desktop Content</TabsContent>
      <TabsContent value="cursor">Cursor Content</TabsContent>
      <TabsContent value="cline">Cline Content</TabsContent>
      <TabsContent value="custom">Custom Content</TabsContent>
    </Tabs>
  );
}

describe("Property 8: Onboarding Step 2 tab content is mutually exclusive", () => {
  afterEach(() => {
    cleanup();
  });

  it("for any tab value, exactly one panel is active and three are inactive", () => {
    fc.assert(
      fc.property(tabArbitrary, (selectedTab) => {
        cleanup();

        const { container } = render(
          <ControlledClientTabs activeTab={selectedTab} />
        );

        // Query all TabsContent panels
        const allPanels = container.querySelectorAll('[role="tabpanel"]');
        const activePanels = container.querySelectorAll(
          '[role="tabpanel"][data-state="active"]'
        );
        const inactivePanels = container.querySelectorAll(
          '[role="tabpanel"][data-state="inactive"]'
        );

        // Total panels = 4
        expect(allPanels.length).toBe(4);

        // Exactly one panel is active
        expect(activePanels.length).toBe(1);

        // The other three are inactive
        expect(inactivePanels.length).toBe(3);

        // The active trigger text matches the selected tab
        const activeTrigger = container.querySelector(
          '[role="tab"][data-state="active"]'
        ) as HTMLElement | null;
        expect(activeTrigger).not.toBeNull();
        expect(activeTrigger!.textContent).toBe(TAB_LABEL_MAP[selectedTab]);
      }),
      { numRuns: 100 }
    );
  });

  it("the ClientInstructions component maintains mutual exclusivity when tabs are clicked", () => {
    fc.assert(
      fc.property(tabArbitrary, (selectedTab) => {
        cleanup();

        const { container } = render(
          <ClientInstructions proxyUrl="https://proxy.example.com/mcp" bearerToken="test-token-123" />
        );

        // Click the target tab trigger
        const triggers = container.querySelectorAll('[role="tab"]');
        const targetTrigger = Array.from(triggers).find(
          (t) => t.textContent === TAB_LABEL_MAP[selectedTab]
        ) as HTMLElement;
        expect(targetTrigger).toBeDefined();

        act(() => {
          fireEvent.click(targetTrigger);
        });

        // After click, verify mutual exclusivity invariant
        const activePanels = container.querySelectorAll(
          '[role="tabpanel"][data-state="active"]'
        );
        const inactivePanels = container.querySelectorAll(
          '[role="tabpanel"][data-state="inactive"]'
        );

        // Exactly one panel is active
        expect(activePanels.length).toBe(1);

        // The other three are inactive
        expect(inactivePanels.length).toBe(3);
      }),
      { numRuns: 100 }
    );
  });
});
