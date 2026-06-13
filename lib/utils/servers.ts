/**
 * Pure utility functions for server-related UI logic.
 */

/**
 * Returns the number of RescanButton instances that should be rendered
 * for a given number of server rows. Each server row gets exactly one
 * Rescan button, so the count equals the server count.
 *
 * @param serverCount - The number of servers displayed in the list
 * @returns The number of RescanButton elements to render
 */
export function getRescanButtonCount(serverCount: number): number {
  return serverCount;
}
