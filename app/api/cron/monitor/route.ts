import { NextRequest, NextResponse } from "next/server";
import { scanMcpConfig } from "@/lib/scanner";
import { sendAlertEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";

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

    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const monitor of monitors) {
      try {
        const row = monitor as unknown as MonitorRow;

        if (row.scan_frequency === "weekly" && row.last_scan_id) {
          const { data: lastScan } = await supabase
            .from("scans")
            .select("created_at")
            .eq("id", row.last_scan_id)
            .single();

          if (lastScan && new Date(lastScan.created_at) > sevenDaysAgo) {
            continue;
          }
        }

        const configStr = JSON.stringify(row.config_json);
        let scanResult;

        try {
          scanResult = scanMcpConfig(configStr);
        } catch {
          errors++;
          continue;
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

          const { error: alertError } = await supabase.from("alerts").insert({
            user_id: row.user_id,
            monitored_config_id: row.id,
            alert_type: "score_drop",
            severity,
            title: `Security score dropped by ${drop} points`,
            message: `${row.name} dropped from ${previousScore} to ${newScore} (Grade: ${newGrade}). ${criticalCount} critical and ${highCount} high issues found.`,
          });

          if (!alertError) {
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
            const { error: alertError } = await supabase.from("alerts").insert({
              user_id: row.user_id,
              monitored_config_id: row.id,
              alert_type: "new_critical",
              severity: "critical",
              title: `${criticalCount} critical vulnerabilities found`,
              message: `${row.name} has ${criticalCount} critical security issues that require immediate attention.`,
            });

            if (!alertError) {
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
          const { error: alertError } = await supabase.from("alerts").insert({
            user_id: row.user_id,
            monitored_config_id: row.id,
            alert_type: "failing_grade",
            severity: "high",
            title: "Failing security grade: F",
            message: `${row.name} received a failing grade of F with a score of ${newScore}/100.`,
          });

          if (!alertError) {
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
