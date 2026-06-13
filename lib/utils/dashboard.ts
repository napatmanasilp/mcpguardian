/**
 * Dashboard utility functions for pure logic extraction.
 */

/**
 * Resolves the element type for threat count rendering on the dashboard.
 *
 * For any positive threat count, the element should be a link to the critical alerts page.
 * For zero threats, the element should be a non-interactive span.
 */
export function resolveThreatCountElement(
  threatCount: number
): { tag: "link"; href: string } | { tag: "span" } {
  if (threatCount > 0) {
    return { tag: "link", href: "/alerts?severity=critical" };
  }
  return { tag: "span" };
}
