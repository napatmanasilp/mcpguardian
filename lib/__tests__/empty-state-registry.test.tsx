import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/lib/ui/empty-states";

/**
 * Feature: ui-launch-readiness, Property 2: Empty state rendering consistency
 *
 * For each page key in the registry, verify the EmptyState renders with the configured heading.
 *
 * **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8**
 */
describe("Property 2: Empty state rendering consistency", () => {
  const pageKeys = Object.keys(EMPTY_STATES) as Array<keyof typeof EMPTY_STATES>;

  // Arbitrary that selects random keys from the EMPTY_STATES registry
  const pageKeyArb = fc.constantFrom(...pageKeys);

  it("renders the configured heading for any page key in the registry", () => {
    fc.assert(
      fc.property(pageKeyArb, (key) => {
        const config = EMPTY_STATES[key];

        const { unmount } = render(
          <EmptyState
            icon={config.icon}
            heading={config.heading}
            description={config.description}
            cta={config.cta}
          />
        );

        // The heading text should be present in the rendered output
        const headingElement = screen.getByRole("heading", { level: 3 });
        expect(headingElement).toHaveTextContent(config.heading);

        // Clean up to avoid DOM pollution between iterations
        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it("renders the configured description for any page key in the registry", () => {
    fc.assert(
      fc.property(pageKeyArb, (key) => {
        const config = EMPTY_STATES[key];

        const { unmount } = render(
          <EmptyState
            icon={config.icon}
            heading={config.heading}
            description={config.description}
            cta={config.cta}
          />
        );

        // The description text should be present
        expect(screen.getByText(config.description)).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it("renders a CTA link when config includes one, for any page key", () => {
    // Filter to keys that have a CTA defined
    const keysWithCta = pageKeys.filter((k) => EMPTY_STATES[k].cta);
    if (keysWithCta.length === 0) return;

    const ctaKeyArb = fc.constantFrom(...keysWithCta);

    fc.assert(
      fc.property(ctaKeyArb, (key) => {
        const config = EMPTY_STATES[key];

        const { unmount } = render(
          <EmptyState
            icon={config.icon}
            heading={config.heading}
            description={config.description}
            cta={config.cta}
          />
        );

        const link = screen.getByRole("link", { name: config.cta!.label });
        expect(link).toHaveAttribute("href", config.cta!.href);

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it("does not render a CTA link when config omits one, for any page key", () => {
    // Filter to keys that do NOT have a CTA defined
    const keysWithoutCta = pageKeys.filter((k) => !EMPTY_STATES[k].cta);
    if (keysWithoutCta.length === 0) return;

    const noCTAKeyArb = fc.constantFrom(...keysWithoutCta);

    fc.assert(
      fc.property(noCTAKeyArb, (key) => {
        const config = EMPTY_STATES[key];

        const { unmount } = render(
          <EmptyState
            icon={config.icon}
            heading={config.heading}
            description={config.description}
          />
        );

        // Should not find any link elements
        const links = screen.queryAllByRole("link");
        expect(links).toHaveLength(0);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
