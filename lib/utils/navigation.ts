/**
 * Navigation resolution utilities for dashboard quick actions.
 */

export interface ServerRef {
  id: string;
  created_at: string;
}

/**
 * Resolves the navigation target for the "Scan Now" quick action.
 *
 * When servers is non-empty, returns `/servers/{id}` where `id` belongs to
 * the server with the most recent `created_at` timestamp.
 * When empty, returns `/servers/new`.
 */
export function resolveScanNowTarget(servers: ServerRef[]): string {
  if (servers.length === 0) {
    return "/servers/new";
  }

  let mostRecent = servers[0];
  for (let i = 1; i < servers.length; i++) {
    if (
      new Date(servers[i].created_at).getTime() >
      new Date(mostRecent.created_at).getTime()
    ) {
      mostRecent = servers[i];
    }
  }

  return `/servers/${mostRecent.id}`;
}
