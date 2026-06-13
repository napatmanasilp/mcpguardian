/**
 * Formats a page title for SEO metadata.
 * Ensures the title follows the pattern "{Page Name} — MCPGuardian"
 * and does not exceed 60 characters.
 *
 * If the full title exceeds 60 characters, it is truncated with an ellipsis.
 */
export function formatPageTitle(pageName: string): string {
  const suffix = " — MCPGuardian";
  const title = `${pageName}${suffix}`;

  if (title.length > 60) {
    return title.slice(0, 57) + "…";
  }

  return title;
}
