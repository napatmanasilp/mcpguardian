"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ThreatEntry {
  id: string;
  tool_name: string;
  was_blocked: boolean;
  threat_type: string | null;
  created_at: string;
  mcp_server_id?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function threatColor(type: string | null, blocked: boolean): string {
  if (blocked) return "border-l-red-500/60 bg-red-500/5";
  if (type) return "border-l-amber-400/60 bg-amber-500/5";
  return "border-l-emerald-500/60 bg-emerald-500/5";
}

export function ThreatFeedSection({ threats }: { threats: ThreatEntry[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? threats
    : threats.filter((t) => {
        if (filter === "blocked") return t.was_blocked;
        if (filter === "flagged") return !t.was_blocked && t.threat_type !== null;
        if (filter === "clean") return !t.was_blocked && t.threat_type === null;
        return true;
      });

  return (
    <Card className="border-white/10 bg-bg-surface animate-slide-up">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-threat" />
            <CardTitle className="text-sm font-semibold text-slate-200">Live Threat Feed</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter dropdown */}
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32 h-7 text-xs border-white/10 bg-white/5">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/activity">
              <Button size="xs" variant="link" className="text-[10px] text-blue-400 gap-1">
                View all <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {filtered.slice(0, 10).map((threat, i) => (
          <Link
            key={threat.id}
            href={threat.mcp_server_id ? `/sessions/${threat.mcp_server_id}` : "#"}
            className={cn(
              "group flex items-center justify-between border-l-2 pl-3 pr-2 py-2 rounded-r-md transition-all duration-150 hover:brightness-110",
              threatColor(threat.threat_type, threat.was_blocked),
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-slate-300 truncate">{threat.tool_name}</span>
              {threat.threat_type && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 shrink-0">
                  {threat.threat_type}
                </Badge>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
              {timeAgo(threat.created_at)}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
