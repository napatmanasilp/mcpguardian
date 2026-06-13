export interface MergedEvent {
  id: string;
  type: "threat" | "alert";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  session_id: string | null;
  server_id: string | null;
  createdAt: string;
}
