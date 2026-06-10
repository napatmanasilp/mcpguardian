// ─── Agent Directive ──────────────────────────────────────────────────
// This block gives AI agents consuming the scan report explicit security
// policy instructions — what tools are blocked, what requires approval,
// and what session-level guards should be enforced.

export type ConnectionVerdict = 'ALLOW' | 'ALLOW_WITH_CAUTION' | 'BLOCK';

export type RiskThreshold = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface DefaultPermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_execute: boolean;
  can_make_network_requests: boolean;
}

export interface SessionPolicy {
  rescan_interval_minutes: number;
  max_invocations_per_tool_per_hour: number;
  alert_on_new_parameters: boolean;
  alert_on_response_size_change: boolean;
  require_human_approval_above_risk: RiskThreshold;
}

export interface AgentDirective {
  connection_verdict: ConnectionVerdict;
  verdict_reason: string;
  default_permissions: DefaultPermissions;
  tools_blocked: string[];
  tools_requiring_approval: string[];
  tools_auto_approved: string[];
  session_policy: SessionPolicy;
  compliance_notes: string[];
}
