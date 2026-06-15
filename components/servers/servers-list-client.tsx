"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LayoutGrid, List, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RescanButtonWithRefresh } from "@/components/servers/rescan-button-with-refresh";
import { cn } from "@/lib/utils";

interface ServerData {
  id: string;
  name: string;
  transport_type: string;
  endpoint_url: string | null;
  allowlist_status: string;
  last_scan_result: string | null;
  last_scan_at: string | null;
  risk_score: number | null;
  created_at: string;
}

interface ServersListClientProps {
  servers: ServerData[];
  latencyByServer: Record<string, number | null>;
  sessionCountByServer: Record<string, number>;
  currentView: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ServersListClient({
  servers,
  latencyByServer,
  sessionCountByServer,
  currentView,
}: ServersListClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectionMode = selected.size > 0;

  function toggleServer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === servers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(servers.map((s) => s.id)));
    }
  }

  async function handleBulkDelete() {
    setDeleting(true);
    let deleted = 0;

    for (const id of selected) {
      try {
        const res = await fetch(`/api/servers/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* ignore */ }
    }

    setDeleting(false);
    setShowConfirm(false);
    setSelected(new Set());

    if (deleted > 0) {
      toast.success(`Deleted ${deleted} server${deleted > 1 ? "s" : ""}`);
      router.refresh();
    }
  }

  return (
    <>
      {/* Selection toolbar */}
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selected.size === servers.length && servers.length > 0}
          onCheckedChange={toggleAll}
          className="border-white/20"
          aria-label="Select all servers"
        />
        <span className="text-xs text-slate-500">
          {selected.size > 0 ? `${selected.size} of ${servers.length} selected` : "Select"}
        </span>
        {selected.size > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 h-7 text-xs"
            onClick={() => setShowConfirm(true)}
          >
            <Trash2 className="size-3" />
            Delete ({selected.size})
          </Button>
        )}
      </div>

      {/* Server List */}
      <div className="flex flex-col gap-2">
        {servers.map((server) => {
          const statusColor =
            server.allowlist_status === "approved"
              ? "bg-secure/20 text-secure border-secure/30"
              : server.allowlist_status === "blocked"
                ? "bg-threat/20 text-threat border-threat/30"
                : "bg-caution/20 text-caution border-caution/30";

          return (
            <div key={server.id} className="flex items-center gap-2">
              {/* Checkbox */}
              <div
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleServer(server.id);
                }}
              >
                <Checkbox
                  checked={selected.has(server.id)}
                  className="border-white/20"
                  aria-label={`Select ${server.name}`}
                />
              </div>

              {/* Server card */}
              <Link href={`/servers/${server.id}`} className="flex-1 min-w-0">
                <Card className="border-white/10 bg-bg-surface hover:bg-bg-elevated transition-all duration-150 hover:-translate-y-px hover:border-white/20 cursor-pointer">
                  <CardContent className="p-3 md:p-4">
                    {/* Desktop layout */}
                    <div className="hidden md:flex items-center gap-3">
                      <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-200 truncate">{server.name}</p>
                        <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {server.transport_type === "http" ? "HTTP" : "STDIO"}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColor)}>
                          {server.allowlist_status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                        <span>Risk: {server.risk_score ?? "—"}/100</span>
                        <span>Latency: {latencyByServer[server.id] != null ? `${latencyByServer[server.id]}ms` : "—"}</span>
                        <span>Sessions: {sessionCountByServer[server.id] ?? 0}</span>
                        <span>Scan: {timeAgo(server.last_scan_at)}</span>
                      </div>
                      <RescanButtonWithRefresh serverId={server.id} />
                      <ArrowRight className="size-3.5 text-slate-500 shrink-0" />
                    </div>

                    {/* Mobile layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                        <p className="text-sm font-semibold text-slate-200 truncate flex-1">{server.name}</p>
                        <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {server.transport_type === "http" ? "HTTP" : "STDIO"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 pl-4">
                        <span>Risk: {server.risk_score ?? "—"}/100</span>
                        <span>Scan: {timeAgo(server.last_scan_at)}</span>
                      </div>
                    </div>

                    {server.risk_score != null && (
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", server.risk_score <= 20 ? "bg-secure" : server.risk_score <= 50 ? "bg-caution" : "bg-threat")}
                          style={{ width: `${100 - server.risk_score}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="bg-[hsl(222,47%,8%)] border-white/10">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} Server{selected.size > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected server{selected.size > 1 ? "s" : ""} and all associated scans, sessions, and telemetry. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
