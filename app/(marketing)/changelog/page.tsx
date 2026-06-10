import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  date: string;
  version: string;
  type: "feature" | "improvement" | "fix";
  title: string;
  description: string;
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "June 9, 2026",
    version: "v1.4.0",
    type: "feature",
    title: "NSA MCP Compliance Dashboard",
    description: "Full NSA CSI U/OO/6030316-26 compliance mapping dashboard with control status tracking, score assessment, and downloadable compliance reports.",
  },
  {
    date: "June 2, 2026",
    version: "v1.3.0",
    type: "feature",
    title: "Proxy Watchdog & Session Health Monitoring",
    description: "Automated session watchdog that re-verifies tool manifests every 15 minutes. Server health metrics with latency, error rate, and threat rate tracking.",
  },
  {
    date: "May 26, 2026",
    version: "v1.2.0",
    type: "feature",
    title: "Polar.sh Billing Integration",
    description: "Migrated from Stripe to Polar.sh for subscriptions, metered billing, and add-on purchases. Annual billing now available with 2 months free.",
  },
  {
    date: "May 19, 2026",
    version: "v1.1.0",
    type: "feature",
    title: "Background Scan Pipeline",
    description: "Vercel background function-powered scan pipeline with 4 steps: static analysis, domain verification, sandbox execution, and hash comparison.",
  },
  {
    date: "May 12, 2026",
    version: "v1.0.0",
    type: "feature",
    title: "MCPGuardian Launch",
    description: "Initial release with MCP server scanning, OWASP MCP Top 10 checks, proxy protection, and the complete security dashboard.",
  },
];

export default function ChangelogPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Updates</p>
        <h1 className="text-3xl font-bold tracking-tight">Changelog</h1>
        <p className="text-sm text-slate-400 mt-2">Recent product updates and releases</p>
      </div>

      <div className="space-y-8">
        {CHANGELOG.map((entry, i) => (
          <div key={i}>
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex flex-col items-center">
                <div className={cn(
                  "size-3 rounded-full border-2",
                  entry.type === "feature" ? "border-blue-500 bg-blue-500/20" :
                  entry.type === "improvement" ? "border-emerald-500 bg-emerald-500/20" :
                  "border-amber-500 bg-amber-500/20",
                )} />
                {i < CHANGELOG.length - 1 && <div className="w-px flex-1 bg-white/10 mt-1" />}
              </div>
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      entry.type === "feature" ? "border-blue-500/30 text-blue-400" :
                      entry.type === "improvement" ? "border-emerald-500/30 text-emerald-400" :
                      "border-amber-500/30 text-amber-400",
                    )}
                  >
                    {entry.type === "feature" ? "Feature" : entry.type === "improvement" ? "Improvement" : "Fix"}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">{entry.version}</span>
                  <span className="text-xs text-slate-500 ml-auto">{entry.date}</span>
                </div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{entry.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{entry.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
