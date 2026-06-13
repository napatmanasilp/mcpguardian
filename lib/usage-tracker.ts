import { SupabaseClient } from "@supabase/supabase-js";

export interface UsageSnapshot {
  scansUsed: number;
  toolCallsUsed: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export async function getUsageSnapshot(
  supabase: SupabaseClient,
  orgId: string
): Promise<UsageSnapshot> {
  const { data } = await supabase
    .from("organizations")
    .select(
      "scans_used_this_period, tool_calls_used_this_period, current_period_start, current_period_end"
    )
    .eq("id", orgId)
    .single();

  return {
    scansUsed: data?.scans_used_this_period ?? 0,
    toolCallsUsed: data?.tool_calls_used_this_period ?? 0,
    currentPeriodStart: data?.current_period_start ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
  };
}

export async function incrementScans(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  await supabase.rpc("increment_scans", { org_id: orgId });
}

export async function incrementToolCalls(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  await supabase.rpc("increment_tool_calls", { org_id: orgId });
}

export async function resetUsageCounters(
  supabase: SupabaseClient,
  orgId: string,
  newPeriodStart: string,
  newPeriodEnd: string
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      scans_used_this_period: 0,
      tool_calls_used_this_period: 0,
      current_period_start: newPeriodStart,
      current_period_end: newPeriodEnd,
    })
    .eq("id", orgId);
}
