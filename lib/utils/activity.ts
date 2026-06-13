/**
 * Determines whether the "Load more" button should be visible based on the
 * size of the last fetched batch. If the last batch returned exactly 50 items
 * (the page size), more results may exist on the server. If fewer items were
 * returned, we have reached the end of the list.
 *
 * @param lastBatchSize - The number of events returned by the most recent fetch
 * @returns true when lastBatchSize equals 50 (more data may exist), false otherwise
 */
export function shouldShowLoadMore(lastBatchSize: number): boolean {
  return lastBatchSize === 50;
}
