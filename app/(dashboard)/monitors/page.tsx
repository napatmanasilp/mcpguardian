"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import type { ScanResult } from "@/lib/scanner/types";

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

const MonitorsPage = () => {
  const [profile, setProfile] = useState<{ plan: string } | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // Add monitor form state
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState("");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formJsonError, setFormJsonError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileRes = await fetch("/api/user/profile");
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data);
        }

        const monitorsRes = await fetch("/api/monitors");
        if (monitorsRes.ok) {
          const data = await monitorsRes.json();
          setMonitors(data as Monitor[]);
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
        body: JSON.stringify({
          name: formName,
          config: formConfig,
          frequency: formFrequency,
        }),
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

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

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

  if (profile && profile.plan !== "pro") {
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
              <a href="/pricing">Upgrade to Pro &mdash; $29/mo</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Continuous Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Automatically scan your MCP configurations daily
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
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
                {formJsonError && (
                  <p className="text-sm text-red-500">{formJsonError}</p>
                )}
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
              <Button
                onClick={handleAddMonitor}
                disabled={!formName.trim() || !formConfig.trim() || formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Start Monitoring"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
          {monitors.map((monitor) => (
            <Card key={monitor.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{monitor.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${monitor.is_active ? "bg-green-500" : "bg-gray-400"}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {monitor.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Last score:</span>
                  {monitor.last_score !== null ? (
                    <>
                      <Badge variant={monitor.last_score >= 80 ? "default" : "destructive"}>
                        {monitor.last_score >= 90
                          ? "A"
                          : monitor.last_score >= 80
                            ? "B"
                            : monitor.last_score >= 70
                              ? "C"
                              : monitor.last_score >= 60
                                ? "D"
                                : "F"}
                      </Badge>
                      <span className="font-medium tabular-nums">{monitor.last_score}/100</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not scanned yet</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Last scan:</span>
                  <span>{monitor.last_scan_id ? relativeTime(monitor.created_at) : "Never"}</span>
                </div>
                <div>
                  <Badge variant="outline">
                    {monitor.scan_frequency === "daily" ? "Daily" : "Weekly"}
                  </Badge>
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
                    <Button variant="ghost" size="sm">
                      <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Monitor</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop monitoring &quot;{monitor.name}&quot; and remove it. Your scan history will
                        be preserved.
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
          ))}
        </div>
      )}
    </main>
  );
};

export default MonitorsPage;
