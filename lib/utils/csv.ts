import type { MergedEvent } from "@/lib/types/activity";

const CSV_HEADER = "id,type,title,description,severity,session_id,server_id,created_at";

/**
 * Escapes a CSV field value according to RFC 4180 rules:
 * - If the value contains a comma, double-quote, or newline, wrap it in double-quotes
 * - Any embedded double-quotes are escaped by doubling them ("" → "")
 */
export function escapeCsvField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts an array of MergedEvent objects into CSV content string.
 * - Header row: id,type,title,description,severity,session_id,server_id,created_at
 * - All created_at values formatted as ISO 8601 UTC strings
 * - If events is empty, produces a header-only CSV (1 row)
 */
export function buildCsvContent(events: MergedEvent[]): string {
  const rows = [CSV_HEADER];

  for (const event of events) {
    const createdAtUtc = new Date(event.createdAt).toISOString();
    const fields = [
      escapeCsvField(event.id),
      escapeCsvField(event.type),
      escapeCsvField(event.title),
      escapeCsvField(event.description),
      escapeCsvField(event.severity),
      escapeCsvField(event.session_id ?? ""),
      escapeCsvField(event.server_id ?? ""),
      escapeCsvField(createdAtUtc),
    ];
    rows.push(fields.join(","));
  }

  return rows.join("\n");
}

/**
 * Generates the CSV filename using today's UTC date.
 * Format: threat-log-YYYY-MM-DD.csv
 */
export function getCsvFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `threat-log-${date}.csv`;
}

/**
 * Exports an array of MergedEvent objects as a downloadable CSV file.
 * - Filename: threat-log-{YYYY-MM-DD}.csv using today's UTC date
 * - Blob creation is inside try/finally to ensure URL.revokeObjectURL is always called
 * - If events is empty, produces a header-only CSV (no error)
 */
export function exportCsv(events: MergedEvent[]): void {
  const csvContent = buildCsvContent(events);
  const filename = getCsvFilename();

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
