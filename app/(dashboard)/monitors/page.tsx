"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  GitBranch,
  Loader2,
  Minus,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ScanResult } from "@/lib/scanner/types";

// ─── Types ─────────────────────────────────────────────────────────────

interface Monitor {
  id: string;
  name: string;
  config_json: Record<string, unknown>;
  scan_frequency: string;
  is_active: boolean;
  last_scan_id: string | null;
  last_score: number | null;
  created_at: string;
  initialScan?: ScanResult;
}

interface RugPullSnapshot {
  id: string;
  config_hash: string;
  server_url: string;
  tools_hash: string;
  change_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface ScanHistoryEntry {
  id: string;
  overall_score: number;
  created_at: string;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#a8557f", "#f59e0b", "#06b6d4", "#ef4444"];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeUntil(target: string): string {
  const [h, m] = target.split(":").map(Number);
  const now = new Date();
  const targetTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));

  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const diffMs = targetTime.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Component ─────────────────────────────────────────────────────────

const MonitorsPage = () => {
  const [profile, setProfile] = useState<{ plan: string } | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<Record<string, ScanHistoryEntry[]>>({});
  const [rugPulls, setRugPulls] = useState<RugPullSnapshot[]>([]);

  // Add monitor form state
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState("");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formJsonError, setFormJsonError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, monitorsRes, rugPullsRes, scanHistoryRes] = await Promise.all([
          fetch("/api/user/profile"),
          fetch("/api/monitors"),
          fetch("/api/monitors/rug-pulls"),
          fetch("/api/monitors/scan-history"),
        ]);

        if (profileRes.ok) {
          setProfile(await profileRes.json());
        }
        if (monitorsRes.ok) {
          const data = await monitorsRes.json();
          setMonitors(data as Monitor[]);
        }
        if (rugPullsRes.ok) {
          setRugPulls(await rugPullsRes.json());
        }
        if (scanHistoryRes.ok) {
          setScanHistory(await scanHistoryRes.json());
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddMonitor = useCallback(async () => {
    setFormJsonError(null);
    try {
      JSON.parse(formConfig);
    } catch {
      setFormJsonError("Invalid JSON format. Please check your configuration.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, config: formConfig, frequency: formFrequency }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create monitor");
        return;
      }
      setMonitors((prev) => [data as Monitor, ...prev]);
      setAddOpen(false);
      setFormName("");
      setFormConfig("");
      setFormFrequency("daily");
      toast.success("Monitor created and initial scan complete");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setFormSubmitting(false);
    }
  }, [formName, formConfig, formFrequency]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/monitors?monitor_id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to delete monitor");
        return;
      }
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      toast.success("Monitor deleted");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleteId(null);
    }
  }, []);

  const handleToggleActive = useCallback(async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/monitors?monitor_id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!res.ok) {
        toast.error("Failed to toggle monitor");
        return;
      }
      const updated = await res.json();
      setMonitors((prev) => prev.map((m) => (m.id === id ? (updated as Monitor) : m)));
      toast.success(current ? "Monitor paused" : "Monitor resumed");
    } catch {
      toast.error("An unexpected error occurred");
    }
  }, []);

  const handleScanNow = useCallback(async (monitor: Monitor) => {
    setScanningId(monitor.id);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: JSON.stringify(monitor.config_json) }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Scan failed");
        return;
      }
      const result = (await res.json()) as ScanResult;
      setMonitors((prev) =>
        prev.map((m) => (m.id === monitor.id ? { ...m, last_score: result.score } : m)),
      );
      toast.success(`Scan complete — Grade: ${result.grade}`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanningId(null);
    }
  }, []);

  // ── Derived data ────────────────────────────────────────────────────

  const activeCount = monitors.filter((m) => m.is_active).length;

  // Build chart data from scan history
  const chartData: Record<string, string | number>[] = [];
  if (monitors.length > 1) {
    const dateMap = new Map<string, Record<string, number>>();
    for (const monitorId of Object.keys(scanHistory)) {
      const monitor = monitors.find((m) => m.id === monitorId);
      if (!monitor) continue;
      const entries = scanHistory[monitorId] ?? [];
      for (const entry of entries) {
        const dateKey = formatChartDate(entry.created_at);
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
        dateMap.get(dateKey)![monitor.name] = entry.overall_score;
      }
    }
    chartData.push(
      ...Array.from(dateMap.entries())
        .map(([date, scores]) => ({ date, ...scores }))
        .slice(-30),
    );
  }

  const rugPullCount = rugPulls.length;

  const avgScore =
    monitors.length > 0
      ? Math.round(
          monitors.reduce((sum, m) => sum + (m.last_score ?? 0), 0) / monitors.length,
        )
      : null;

  // ── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-8 p-8">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-card p-6" />
          ))}
        </div>
      </main>
    );
  }

  // ── Plan gating — available on Developer, Team, Startup, Enterprise ──

  const blockedPlans = ["free", "payg"];
  if (profile && blockedPlans.includes(profile.plan)) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Shield className="size-12 text-muted-foreground/40" />
            <div>
              <h2 className="text-lg font-semibold">Continuous Monitoring</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Automatically scan your MCP configurations daily and get instant alerts when new vulnerabilities are found.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-left w-full">
              {[
                "Daily automated security scans",
                "Instant email alerts for critical issues",
                "Score drop detection",
                "New CVE monitoring",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-2 w-full" asChild>
              <a href="/pricing">Upgrade Plan — starting at $19/mo</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security Monitoring</h1>
          <p className="text-xs text-slate-400 mt-1">
            {activeCount} active monitor{activeCount !== 1 ? "s" : ""}
            {activeCount > 0 && ` — next scan in ~${formatTimeUntil("06:00")}`}
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Monitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Monitor</DialogTitle>
              <DialogDescription>
                Save an MCP configuration for automated daily scanning
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Monitor Name</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Production Config"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config">MCP Configuration</Label>
                <Textarea
                  id="config"
                  value={formConfig}
                  onChange={(e) => {
                    setFormConfig(e.target.value);
                    setFormJsonError(null);
                  }}
                  placeholder='{"mcpServers": {"server": {"command": "npx"}}}'
                  rows={10}
                  className="min-h-[200px] font-mono text-sm"
                  spellCheck={false}
                />
                {formJsonError && <p className="text-sm text-red-500">{formJsonError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Scan Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMonitor} disabled={!formName.trim() || !formConfig.trim() || formSubmitting}>
                {formSubmitting ? (
                  <><Loader2 className="size-4 animate-spin" />Creating...</>
                ) : (
                  "Start Monitoring"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Summary Metric Cards ──────────────────────────────────────── */}
      {monitors.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="size-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Eye className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono tabular-nums">{activeCount}</p>
                <p className="text-xs text-slate-400">Monitors Active</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="size-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <GitBranch className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono tabular-nums">{rugPullCount}</p>
                <p className="text-xs text-slate-400">Rug Pulls Detected</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className={cn(
                  "size-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  avgScore !== null && avgScore >= 80 && "bg-emerald-500/15",
                  avgScore !== null && avgScore >= 60 && avgScore < 80 && "bg-amber-500/15",
                  avgScore !== null && avgScore < 60 && "bg-red-500/15",
                  avgScore === null && "bg-slate-500/15",
                )}
              >
                <Shield
                  className={cn(
                    "size-5",
                    avgScore !== null && avgScore >= 80 && "text-emerald-400",
                    avgScore !== null && avgScore >= 60 && avgScore < 80 && "text-amber-400",
                    avgScore !== null && avgScore < 60 && "text-red-400",
                    avgScore === null && "text-slate-400",
                  )}
                />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono tabular-nums">
                  {avgScore !== null ? avgScore : "—"}
                  {avgScore !== null && <span className="text-sm text-slate-400 font-normal">/100</span>}
                </p>
                <p className="text-xs text-slate-400">Avg Score</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Score History Chart ────────────────────────────────────────── */}
      {monitors.length > 1 && chartData.length > 0 && (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Security Score History (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(217,33%,14%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748b", fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222,47%,8%)",
                    border: "1px solid hsl(217,33%,17%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                {monitors.map((m, i) => (
                  <Line
                    key={m.id}
                    type="monotone"
                    dataKey={m.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Monitor Cards ──────────────────────────────────────────────── */}
      {monitors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Eye className="size-12 text-muted-foreground/40" />
            <div>
              <h3 className="text-lg font-medium">No monitors configured</h3>
              <p className="text-sm text-muted-foreground">
                Add your first MCP configuration to start automated scanning
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add Monitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {monitors.map((monitor) => {
            // Score trend (compare last 2 scans)
            const history = scanHistory[monitor.id] ?? [];
            const sortedHistory = [...history].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );
            const lastScore = sortedHistory[0]?.overall_score;
            const prevScore = sortedHistory[1]?.overall_score;
            const trend =
              prevScore !== undefined && lastScore !== undefined
                ? lastScore > prevScore
                  ? ("up" as const)
                  : lastScore < prevScore
                    ? ("down" as const)
                    : ("stable" as const)
                : null;

            return (
              <Card key={monitor.id} className="border-white/10 bg-[hsl(222,47%,6%)]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-200">
                      {monitor.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${monitor.is_active ? "bg-emerald-500" : "bg-slate-500"}`}
                      />
                      <span className="text-xs text-slate-400">
                        {monitor.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Last score:</span>
                    {monitor.last_score !== null ? (
                      <>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-mono font-bold px-1.5 py-0 border",
                            monitor.last_score >= 90 && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                            monitor.last_score >= 80 && monitor.last_score < 90 && "bg-blue-500/20 text-blue-400 border-blue-500/30",
                            monitor.last_score >= 70 && monitor.last_score < 80 && "bg-amber-500/20 text-amber-400 border-amber-500/30",
                            monitor.last_score >= 60 && monitor.last_score < 70 && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                            monitor.last_score < 60 && "bg-red-500/20 text-red-400 border-red-500/30",
                          )}
                        >
                          {monitor.last_score >= 90 ? "A" : monitor.last_score >= 80 ? "B" : monitor.last_score >= 70 ? "C" : monitor.last_score >= 60 ? "D" : "F"}
                        </Badge>
                        <span className="font-medium tabular-nums text-slate-200">{monitor.last_score}/100</span>
                        {trend === "up" && <TrendingUp className="size-4 text-emerald-400" />}
                        {trend === "down" && <TrendingDown className="size-4 text-red-400" />}
                        {trend === "stable" && <Minus className="size-4 text-slate-400" />}
                      </>
                    ) : (
                      <span className="text-slate-500">Not scanned yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span>Last scan:</span>
                    <span>{monitor.last_scan_id ? formatRelativeTime(monitor.created_at) : "Never"}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-white/10 text-slate-400">
                      {monitor.scan_frequency === "daily" ? "Daily" : "Weekly"}
                    </Badge>
                    {/* Rug pull indicator */}
                    {rugPulls.some((rp) =>
                      JSON.stringify(monitor.config_json).includes(rp.server_url),
                    ) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        🔄 Rug Pull Detected
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2 pt-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={monitor.is_active}
                      onCheckedChange={() => handleToggleActive(monitor.id, monitor.is_active)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScanNow(monitor)}
                      disabled={scanningId === monitor.id}
                      className="border-white/10 text-slate-300 hover:bg-white/5"
                    >
                      {scanningId === monitor.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Scan Now"
                      )}
                    </Button>
                  </div>
                  <AlertDialog
                    open={deleteId === monitor.id}
                    onOpenChange={(open) => setDeleteId(open ? monitor.id : null)}
                  >
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-400">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Monitor</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop monitoring &quot;{monitor.name}&quot; and remove it. Your scan
                          history will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => handleDelete(monitor.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Rug Pull History Section ────────────────────────────────────── */}
      <div className="space-y-3">
        {rugPulls.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <GitBranch className="size-4 text-amber-400" />
              Tool Definition Changes
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono">
                {rugPulls.length}
              </span>
            </h3>
            {rugPulls.map((rp) => (
              <div
                key={rp.id}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3"
              >
                <div className="size-8 rounded bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                  <GitBranch className="size-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-slate-200 truncate">{rp.server_url}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Changed {rp.change_count} time{rp.change_count !== 1 ? "s" : ""} — last{" "}
                    {formatRelativeTime(rp.last_seen_at)}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0">
                  &times;{rp.change_count} mutations
                </span>
              </div>
            ))}
          </>
        ) : monitors.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center">
            <ShieldCheck className="size-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-300">All tool definitions stable</p>
            <p className="text-xs text-slate-400 mt-1">No mutations detected across monitored servers</p>
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default MonitorsPage;
