import { SupabaseClient } from '@supabase/supabase-js';
import { getTierOrThrow, isUnlimited } from './tier-catalog';

export type QuotaType = 'scan' | 'tool_call';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  allowance: number | null;
  tierName: string;
}

/**
 * Pure function: determines if an operation is within quota.
 * Returns allowed=true if allowance is null (unlimited) or currentUsage < allowance.
 * Blocked otherwise with a descriptive reason string.
 */
export function checkQuota(
  currentUsage: number,
  allowance: number | null,
  tierName: string,
  quotaType: QuotaType
): QuotaCheckResult {
  if (isUnlimited(allowance)) {
    return { allowed: true, currentUsage, allowance, tierName };
  }

  if (currentUsage < allowance!) {
    return { allowed: true, currentUsage, allowance, tierName };
  }

  const typeLabel = quotaType === 'scan' ? 'scan' : 'tool call';
  return {
    allowed: false,
    reason: `${tierName} plan ${typeLabel} quota exceeded: ${currentUsage}/${allowance} used. Upgrade for higher limits.`,
    currentUsage,
    allowance,
    tierName,
  };
}

/**
 * Returns true if the usage is at or above 80% of the allowance.
 * Always returns false for unlimited allowances.
 */
export function shouldShowWarning(currentUsage: number, allowance: number | null): boolean {
  if (isUnlimited(allowance)) return false;
  return currentUsage >= 0.8 * allowance!;
}

/**
 * Formats an allowance for display: "Unlimited" if null, locale-formatted number otherwise.
 */
export function formatAllowanceDisplay(allowance: number | null): string {
  if (isUnlimited(allowance)) return 'Unlimited';
  return allowance!.toLocaleString();
}

/**
 * Server-side helper: loads org data and checks scan quota.
 */
export async function canPerformScan(
  supabase: SupabaseClient,
  orgId: string
): Promise<QuotaCheckResult> {
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_id, scans_used_this_period')
    .eq('id', orgId)
    .single();

  const tier = getTierOrThrow(org?.plan_id ?? 'free');
  return checkQuota(
    org?.scans_used_this_period ?? 0,
    tier.scanAllowance,
    tier.displayName,
    'scan'
  );
}

/**
 * Server-side helper: loads org data and checks tool call quota.
 */
export async function canPerformToolCall(
  supabase: SupabaseClient,
  orgId: string
): Promise<QuotaCheckResult> {
  const { data: org } = await supabase
    .from('organizations')
    .select('plan_id, tool_calls_used_this_period')
    .eq('id', orgId)
    .single();

  const tier = getTierOrThrow(org?.plan_id ?? 'free');
  return checkQuota(
    org?.tool_calls_used_this_period ?? 0,
    tier.toolCallAllowance,
    tier.displayName,
    'tool_call'
  );
}
