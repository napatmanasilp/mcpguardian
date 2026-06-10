import { NextRequest, NextResponse } from "next/server";
import { scanMcpConfig } from "@/lib/scanner";
import { sendAlertEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";
import { computeConfigHash, computeToolDiff, generateRugPullIssue } from "@/lib/scanner/rug-pull";

const ALERT_DEDUP_WINDOW_DAYS = 7;

interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  config_json: Record<string, unknown>;
  scan_frequency: string;
  is_active: boolean;
  last_scan_id: string | null;
  last_score: number | null;
  email: string;
}

interface UpsertResult {
  created: boolean;
  alertId?: string;
}

async function upsertOrSkipAlert(
  supabase: ReturnType<typeof createServiceClient>,
  monitorId: string,
  alertType: string,
  issueKey: string,
  severity: string,
  title: string,
  message: string,
  userId: string,
): Promise<UpsertResult> {
  const { data: existing } = await supabase
    .from("alerts")
    .select("id, recurrence_count")
    .eq("monitored_config_id", monitorId)
    .eq("alert_type", alertType)
    .eq("issue_key", issueKey)
    .eq("read", false)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("alerts")
      .update({
        recurrence_count: (existing.recurrence_count ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error(`Failed to update alert ${existing.id}:`, error);
    }

    return { created: false, alertId: existing.id };
  }

  const { data: newAlert, error } = await supabase
    .from("alerts")
    .insert({
      user_id: userId,
      monitored_config_id: monitorId,
      alert_type: alertType,
      issue_key: issueKey,
      severity,
      title,
      message,
      recurrence_count: 1,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { created: false };
    }
    console.error("Failed to insert alert:", error);
    return { created: false };
  }

  return { created: true, alertId: newAlert?.id };
}

export const GET = async (request: NextRequest) => {
  const startTime = Date.now();
  let monitorsScanned = 0;
  let alertsCreated = 0;
  let emailsSent = 0;
  let errors = 0;

  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET || ""}`;

    if (!authHeader || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data: monitors } = await supabase
      .from("monitored_configs")
      .select("*, profiles!inner(email)")
      .eq("is_active", true);

    if (!monitors || monitors.length === 0) {
      return NextResponse.json(
        { success: true, monitorsScanned: 0, alertsCreated: 0, emailsSent: 0, errors: 0, executionTimeMs: Date.now() - startTime },
        { status: 200 },
      );
    }

    const cutoffDate = new Date(Date.now() - ALERT_DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    for (const monitor of monitors) {
      try {
        const row = monitor as unknown as MonitorRow;

        if (row.scan_frequency === "weekly" && row.last_scan_id) {
          const { data: lastScan } = await supabase
            .from("scans")
            .select("created_at")
            .eq("id", row.last_scan_id)
            .single();

          if (lastScan && new Date(lastScan.created_at) > cutoffDate) {
            continue;
          }
        }

        const configStr = JSON.stringify(row.config_json);
        let scanResult;

        try {
          scanResult = await scanMcpConfig(configStr);
        } catch {
          errors++;
          continue;
        }

        const configHash = await computeConfigHash(configStr);
        for (const server of scanResult.servers) {
          if (!server.toolsHash || !server.serverUrl) continue;
          const { data: snapshot } = await supabase
            .from("tool_definition_snapshots")
            .select("*")
            .eq("config_hash", configHash)
            .eq("server_url", server.serverUrl)
            .maybeSingle();

          if (snapshot) {
            if (snapshot.tools_hash !== server.toolsHash) {
              const priorTools = snapshot.tools_snapshot as unknown[];
              const diff = computeToolDiff(priorTools, server.rawTools ?? []);
              const issue = generateRugPullIssue(server.serverUrl, diff, snapshot.tools_hash, server.toolsHash);
              server.issues.push(issue);
              const totalDeduction = server.issues.reduce((sum: number, i) => sum + i.deduction, 0);
              server.score = Math.max(0, 100 - totalDeduction);
            }
            await supabase.from("tool_definition_snapshots").update({
              tools_hash: server.toolsHash,
              tools_snapshot: server.rawTools ?? [],
              last_seen_at: new Date().toISOString(),
              change_count: snapshot.change_count + (snapshot.tools_hash !== server.toolsHash ? 1 : 0),
            }).eq("id", snapshot.id);
          } else {
            await supabase.from("tool_definition_snapshots").insert({
              config_hash: configHash,
              server_url: server.serverUrl,
              tools_hash: server.toolsHash,
              tools_snapshot: server.rawTools ?? [],
              first_seen_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              change_count: 0,
            });
          }
        }

        monitorsScanned++;

        const { data: newScan } = await supabase
          .from("scans")
          .insert({
            user_id: row.user_id,
            overall_grade: scanResult.grade,
            overall_score: scanResult.score,
            servers_scanned: scanResult.serversScanned,
            critical_issues: scanResult.criticalIssues,
            high_issues: scanResult.highIssues,
            results: JSON.parse(JSON.stringify(scanResult)),
          })
          .select()
          .single();

        if (!newScan) continue;

        const previousScore = row.last_score;

        await supabase
          .from("monitored_configs")
          .update({
            last_scan_id: newScan.id,
            last_score: scanResult.score,
          })
          .eq("id", row.id);

        const newScore = scanResult.score;
        const newGrade = scanResult.grade;
        const criticalCount = scanResult.criticalIssues;
        const highCount = scanResult.highIssues;

        // CONDITION 1: Score Drop
        if (previousScore !== null && newScore < previousScore) {
          const drop = previousScore - newScore;
          let severity: string;
          if (drop > 20) severity = "critical";
          else if (drop > 10) severity = "high";
          else severity = "medium";

          const result = await upsertOrSkipAlert(
            supabase,
            row.id,
            "score_drop",
            "score-drop",
            severity,
            `Security score dropped by ${drop} points`,
            `${row.name} dropped from ${previousScore} to ${newScore} (Grade: ${newGrade}). ${criticalCount} critical and ${highCount} high issues found.`,
            row.user_id,
          );

          if (result.created) {
            alertsCreated++;
            if (severity === "critical") {
              await sendAlertEmail({
                to: row.email,
                monitorName: row.name,
                alertType: "score_drop",
                severity: "critical",
                grade: newGrade,
                score: newScore,
                issuesSummary: `${criticalCount} critical and ${highCount} high issues found. Score dropped from ${previousScore} to ${newScore}.`,
              });
              emailsSent++;
            }
          }
        }

        // CONDITION 2: New Critical Issues
        if (criticalCount > 0) {
          let shouldAlert = true;

          if (row.last_scan_id) {
            const { data: prevScan } = await supabase
              .from("scans")
              .select("critical_issues")
              .eq("id", row.last_scan_id)
              .single();

            if (prevScan && prevScan.critical_issues >= criticalCount) {
              shouldAlert = false;
            }
          }

          if (shouldAlert) {
            const result = await upsertOrSkipAlert(
              supabase,
              row.id,
              "new_critical",
              "critical-issues",
              "critical",
              `${criticalCount} critical vulnerabilities found`,
              `${row.name} has ${criticalCount} critical security issues that require immediate attention.`,
              row.user_id,
            );

            if (result.created) {
              alertsCreated++;
              await sendAlertEmail({
                to: row.email,
                monitorName: row.name,
                alertType: "new_critical",
                severity: "critical",
                grade: newGrade,
                score: newScore,
                issuesSummary: `${criticalCount} critical vulnerabilities found in ${row.name}.`,
              });
              emailsSent++;
            }
          }
        }

        // CONDITION 3: Failing Grade
        if (newGrade === "F") {
          const result = await upsertOrSkipAlert(
            supabase,
            row.id,
            "failing_grade",
            "failing-grade",
            "high",
            "Failing security grade: F",
            `${row.name} received a failing grade of F with a score of ${newScore}/100.`,
            row.user_id,
          );

          if (result.created) {
            alertsCreated++;
          }
        }
      } catch {
        errors++;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(
      `Cron monitor: scanned=${monitorsScanned} alerts=${alertsCreated} emails=${emailsSent} errors=${errors} time=${executionTimeMs}ms`,
    );

    return NextResponse.json(
      { success: true, monitorsScanned, alertsCreated, emailsSent, errors, executionTimeMs },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};
