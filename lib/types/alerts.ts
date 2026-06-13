/**
 * Represents an alert record as fetched from the `alerts` table.
 */
export interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  organization_id: string;
  /** UUID of the related proxy session, if any. */
  session_id: string | null;
  /** UUID of the related MCP server, if any. */
  server_id: string | null;
}
