/**
 * Returns the 5 most recent scan objects from an array, sorted by `created_at`
 * in descending order (most recent first).
 *
 * If the input array has fewer than 5 items, all items are returned (still sorted).
 */
export interface ScanRecord {
  id: string;
  created_at: string | Date;
  [key: string]: unknown;
}

export function getRecentScans<T extends ScanRecord>(scans: T[]): T[] {
  return [...scans]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
}
