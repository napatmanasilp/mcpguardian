/**
 * Computes the total number of tool calls across all sessions.
 * Treats null/undefined `tool_call_count` values as 0.
 */
export function computeTotalToolCalls(
  sessions: { tool_call_count?: number | null }[]
): number {
  return (sessions ?? []).reduce(
    (sum, s) => sum + (s.tool_call_count ?? 0),
    0
  );
}

/**
 * Determines whether a session falls within the given date range.
 * - `from` is inclusive: startedAt >= from 00:00:00.000Z
 * - `to` is inclusive: startedAt <= to 23:59:59.999Z
 * - If `from` is null, there is no lower bound.
 * - If `to` is null, there is no upper bound.
 */
export function isSessionInDateRange(
  startedAt: string,
  from: string | null,
  to: string | null
): boolean {
  if (from !== null) {
    const lowerBound = `${from}T00:00:00.000Z`;
    if (startedAt < lowerBound) return false;
  }
  if (to !== null) {
    const upperBound = `${to}T23:59:59.999Z`;
    if (startedAt > upperBound) return false;
  }
  return true;
}

/**
 * Filters an array of sessions by an inclusive date range.
 * Uses isSessionInDateRange internally.
 */
export function applyDateFilter<T extends { started_at: string }>(
  sessions: T[],
  from: string | null,
  to: string | null
): T[] {
  return sessions.filter((s) => isSessionInDateRange(s.started_at, from, to));
}

/**
 * Returns true if a session status requires a rug-pull tooltip wrapper.
 */
export function requiresRugPullTooltip(status: string): boolean {
  return status === "terminated_rug_pull";
}
