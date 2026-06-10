// ─── Types ───────────────────────────────────────────────────────────

export interface ToolBaseline {
  toolName: string;
  /** Average calls per minute for this tool */
  avgCallsPerMin: number;
  /** Parameter keys observed in the first 10 invocations */
  observedParamKeys: Set<string>;
  /** Average response size in bytes */
  avgResponseSize: number;
  /** Number of observations used to build this baseline */
  sampleCount: number;
}

export interface BaselineSet {
  /** Per-tool baselines, keyed by tool name */
  tools: Map<string, ToolBaseline>;
  /** Total calls observed */
  totalCalls: number;
  /** When the baseline was established */
  establishedAt: number;
}

export interface AnomalyScore {
  toolName: string;
  type: 'RATE_ANOMALY' | 'NEW_PARAMETER_DETECTED' | 'RESPONSE_SIZE_ANOMALY';
  severity: 'HIGH' | 'MEDIUM';
  detail: string;
  currentValue: number;
  baselineValue: number;
  ratio: number;
}

// ─── Baseline Builder ────────────────────────────────────────────────

/**
 * Build a baseline from a set of recent invocation logs.
 * Uses the first `sampleLimit` entries to establish the norm.
 */
export function buildBaseline(
  invocations: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    responseSize: number;
    timestamp: string;
  }>,
  sampleLimit: number = 10,
): BaselineSet {
  const tools = new Map<string, ToolBaseline>();
  const totalCalls = invocations.length;

  // Group by tool name
  const byTool = new Map<string, Array<{
    parameters: Record<string, unknown>;
    responseSize: number;
    timestamp: string;
  }>>();

  for (const inv of invocations) {
    if (!byTool.has(inv.toolName)) {
      byTool.set(inv.toolName, []);
    }
    byTool.get(inv.toolName)!.push(inv);
  }

  for (const [toolName, calls] of byTool) {
    const sample = calls.slice(0, sampleLimit);
    if (sample.length === 0) continue;

    // Calculate time span in minutes
    let timeSpanMinutes = 1;
    if (sample.length >= 2) {
      const firstTs = new Date(sample[0].timestamp).getTime();
      const lastTs = new Date(sample[sample.length - 1].timestamp).getTime();
      const spanMs = lastTs - firstTs;
      timeSpanMinutes = Math.max(1, spanMs / 60_000);
    }

    const avgCallsPerMin = sample.length / timeSpanMinutes;

    // Collect parameter keys
    const observedParamKeys = new Set<string>();
    for (const call of sample) {
      for (const key of Object.keys(call.parameters || {})) {
        observedParamKeys.add(key);
      }
    }

    // Average response size
    const totalSize = sample.reduce((sum, c) => sum + c.responseSize, 0);
    const avgResponseSize = Math.round(totalSize / sample.length);

    tools.set(toolName, {
      toolName,
      avgCallsPerMin,
      observedParamKeys,
      avgResponseSize,
      sampleCount: sample.length,
    });
  }

  return {
    tools,
    totalCalls,
    establishedAt: Date.now(),
  };
}

// ─── Anomaly Detection ───────────────────────────────────────────────

const RATE_THRESHOLD_MULTIPLIER = 3;
const RESPONSE_SIZE_THRESHOLD_MULTIPLIER = 5; // 500% increase

/**
 * Compare the current invocation against the established baseline.
 * Returns an array of anomaly scores if thresholds are exceeded.
 *
 * @param baseline - The established baseline
 * @param currentInvocations - Recent invocations to check (last 5 min window)
 * @returns Array of anomaly scores (empty if no anomalies)
 */
export function detectAnomalies(
  baseline: BaselineSet,
  currentInvocations: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    responseSize: number;
    timestamp: string;
  }>,
): AnomalyScore[] {
  const anomalies: AnomalyScore[] = [];

  // Group current invocations by tool
  const byTool = new Map<string, Array<{
    parameters: Record<string, unknown>;
    responseSize: number;
    timestamp: string;
  }>>();

  for (const inv of currentInvocations) {
    if (!byTool.has(inv.toolName)) {
      byTool.set(inv.toolName, []);
    }
    byTool.get(inv.toolName)!.push(inv);
  }

  for (const [toolName, calls] of byTool) {
    const toolBaseline = baseline.tools.get(toolName);
    if (!toolBaseline || toolBaseline.sampleCount < 2) continue;

    // ── Rate anomaly ──────────────────────────────────────────────
    let timeSpanMinutes = 1;
    if (calls.length >= 2) {
      const firstTs = new Date(calls[0].timestamp).getTime();
      const lastTs = new Date(calls[calls.length - 1].timestamp).getTime();
      const spanMs = lastTs - firstTs;
      timeSpanMinutes = Math.max(1, spanMs / 60_000);
    }
    const currentRate = calls.length / timeSpanMinutes;

    if (currentRate > toolBaseline.avgCallsPerMin * RATE_THRESHOLD_MULTIPLIER) {
      anomalies.push({
        toolName,
        type: 'RATE_ANOMALY',
        severity: 'HIGH',
        detail: `Call rate ${currentRate.toFixed(1)}/min is ${(currentRate / toolBaseline.avgCallsPerMin).toFixed(1)}x above baseline ${toolBaseline.avgCallsPerMin.toFixed(1)}/min`,
        currentValue: currentRate,
        baselineValue: toolBaseline.avgCallsPerMin,
        ratio: currentRate / toolBaseline.avgCallsPerMin,
      });
    }

    // ── New parameter keys ────────────────────────────────────────
    for (const call of calls) {
      for (const key of Object.keys(call.parameters || {})) {
        if (!toolBaseline.observedParamKeys.has(key)) {
          anomalies.push({
            toolName,
            type: 'NEW_PARAMETER_DETECTED',
            severity: 'HIGH',
            detail: `New parameter '${key}' not seen in baseline for tool '${toolName}'`,
            currentValue: 1,
            baselineValue: 0,
            ratio: Infinity,
          });
          break; // one new param anomaly per tool per window
        }
      }
    }

    // ── Response size anomaly ─────────────────────────────────────
    const currentAvgSize = calls.reduce((sum, c) => sum + c.responseSize, 0) / calls.length;
    if (currentAvgSize > toolBaseline.avgResponseSize * RESPONSE_SIZE_THRESHOLD_MULTIPLIER) {
      anomalies.push({
        toolName,
        type: 'RESPONSE_SIZE_ANOMALY',
        severity: 'MEDIUM',
        detail: `Average response size ${currentAvgSize.toFixed(0)} bytes is ${(currentAvgSize / toolBaseline.avgResponseSize).toFixed(1)}x above baseline ${toolBaseline.avgResponseSize} bytes`,
        currentValue: currentAvgSize,
        baselineValue: toolBaseline.avgResponseSize,
        ratio: currentAvgSize / toolBaseline.avgResponseSize,
      });
    }
  }

  return anomalies;
}
