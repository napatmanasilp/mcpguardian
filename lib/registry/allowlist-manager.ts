import { createServiceClient } from '@/lib/supabase/service';

// ─── Types ───────────────────────────────────────────────────────────

export type EnforcementMode = 'strict' | 'warn' | 'off';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface ServerRegistryEntry {
  id: string;
  organizationId: string;
  serverUrl: string;
  serverName?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  scanId?: string;
  scanScore?: number;
  toolHash?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllowlistConfigRow {
  organizationId: string;
  enforcementMode: EnforcementMode;
  autoApproveAboveScore: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface AllowlistCheckResult {
  allowed: boolean;
  status: ApprovalStatus | 'not_registered';
  enforcementMode: EnforcementMode;
  message: string;
  requiresApproval?: boolean;
}

// ─── Row Mapping ─────────────────────────────────────────────────────

function mapRegistryRow(row: Record<string, unknown>): ServerRegistryEntry {
  return {
    id: String(row.id ?? ''),
    organizationId: String(row.organization_id ?? ''),
    serverUrl: String(row.server_url ?? ''),
    serverName: row.server_name ? String(row.server_name) : undefined,
    approvalStatus: row.approval_status as ApprovalStatus,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    scanId: row.scan_id ? String(row.scan_id) : undefined,
    scanScore: row.scan_score ? Number(row.scan_score) : undefined,
    toolHash: row.tool_hash ? String(row.tool_hash) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapConfigRow(row: Record<string, unknown>): AllowlistConfigRow {
  return {
    organizationId: String(row.organization_id ?? ''),
    enforcementMode: row.enforcement_mode as EnforcementMode,
    autoApproveAboveScore: Number(row.auto_approve_above_score ?? 85),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    updatedAt: String(row.updated_at ?? ''),
  };
}

// ─── Config Helpers ──────────────────────────────────────────────────

async function getAllowlistConfig(organizationId: string): Promise<AllowlistConfigRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('allowlist_config')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      organizationId,
      enforcementMode: 'warn',
      autoApproveAboveScore: 85,
      updatedAt: new Date().toISOString(),
    };
  }

  return mapConfigRow(data as Record<string, unknown>);
}

// ─── Enforcement Logic ───────────────────────────────────────────────

/**
 * Check whether a server is allowed to be connected based on the
 * organization's allowlist configuration.
 */
export async function checkAllowlist(
  organizationId: string,
  serverUrl: string,
): Promise<AllowlistCheckResult> {
  const config = await getAllowlistConfig(organizationId);

  // Mode: off — always allow
  if (config.enforcementMode === 'off') {
    return {
      allowed: true,
      status: 'not_registered',
      enforcementMode: 'off',
      message: 'Allowlist enforcement disabled',
    };
  }

  // Look up the server in the registry
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('server_registry')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('server_url', serverUrl)
    .maybeSingle();

  const status = error || !data ? 'not_registered' : (data.approval_status as ApprovalStatus);

  switch (config.enforcementMode) {
    case 'strict': {
      if (status === 'not_registered') {
        return {
          allowed: false,
          status: 'not_registered',
          enforcementMode: 'strict',
          message: 'Server not in approved registry. Submit for approval first.',
          requiresApproval: true,
        };
      }
      if (status === 'pending') {
        return {
          allowed: false,
          status: 'pending',
          enforcementMode: 'strict',
          message: 'Server approval is pending. Waiting for admin approval.',
          requiresApproval: true,
        };
      }
      if (status === 'rejected' || status === 'revoked') {
        return {
          allowed: false,
          status,
          enforcementMode: 'strict',
          message: status === 'rejected'
            ? 'Server was rejected from the registry.'
            : 'Server approval has been revoked.',
        };
      }
      // approved
      return {
        allowed: true,
        status: 'approved',
        enforcementMode: 'strict',
        message: 'Server is approved in the registry.',
      };
    }

    case 'warn': {
      if (status === 'rejected' || status === 'revoked') {
        return {
          allowed: false,
          status,
          enforcementMode: 'warn',
          message: status === 'rejected'
            ? 'Server was rejected from the registry.'
            : 'Server approval has been revoked.',
        };
      }
      if (status === 'not_registered') {
        return {
          allowed: true,
          status: 'not_registered',
          enforcementMode: 'warn',
          message: 'WARNING: Server not in approved registry — proceeding with caution',
        };
      }
      // pending or approved
      return {
        allowed: true,
        status,
        enforcementMode: 'warn',
        message: status === 'pending'
          ? 'Server is pending approval — proceeding with caution'
          : 'Server is approved — proceeding',
      };
    }

    default:
      return {
        allowed: true,
        status: 'not_registered',
        enforcementMode: 'off',
        message: 'Allowlist enforcement disabled',
      };
  }
}

// ─── Submission & Approval ───────────────────────────────────────────

/**
 * Submit a server for approval. If the organization has auto-approval
 * configured and the scan score is high enough, the server is
 * automatically approved.
 */
export async function submitForApproval(
  organizationId: string,
  serverUrl: string,
  scanId: string,
  scanScore: number,
  toolHash: string,
): Promise<void> {
  const supabase = createServiceClient();

  // Upsert as 'pending' first
  const { error: upsertError } = await supabase
    .from('server_registry')
    .upsert({
      organization_id: organizationId,
      server_url: serverUrl,
      approval_status: 'pending',
      scan_id: scanId,
      scan_score: scanScore,
      tool_hash: toolHash,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id, server_url',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    console.error('[allowlist] Failed to submit for approval:', upsertError.message);
    return;
  }

  // Check auto-approval
  const config = await getAllowlistConfig(organizationId);
  if (scanScore >= config.autoApproveAboveScore) {
    const { error: approveError } = await supabase
      .from('server_registry')
      .update({
        approval_status: 'approved',
        approved_by: 'system',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
      .eq('server_url', serverUrl);

    if (approveError) {
      console.error('[allowlist] Auto-approval failed:', approveError.message);
    }
  }
}

/**
 * Approve a server manually (admin action).
 */
export async function approveServer(
  organizationId: string,
  serverUrl: string,
  approvedBy: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('server_registry')
    .update({
      approval_status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('server_url', serverUrl);

  if (error) {
    console.error('[allowlist] Failed to approve server:', error.message);
    throw new Error(`Failed to approve server: ${error.message}`);
  }
}

/**
 * Revoke a server's approval (admin action).
 */
export async function revokeServer(
  organizationId: string,
  serverUrl: string,
  reason: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('server_registry')
    .update({
      approval_status: 'revoked',
      notes: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('server_url', serverUrl);

  if (error) {
    console.error('[allowlist] Failed to revoke server:', error.message);
    throw new Error(`Failed to revoke server: ${error.message}`);
  }
}

/**
 * Get the full registry for an organization.
 */
export async function getRegistryForOrg(
  organizationId: string,
): Promise<ServerRegistryEntry[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('server_registry')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[allowlist] Failed to get registry:', error.message);
    return [];
  }

  return (data ?? []).map(row => mapRegistryRow(row as Record<string, unknown>));
}
