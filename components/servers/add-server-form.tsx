"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Plus, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AddServerForm() {
  const router = useRouter();
  const [serverName, setServerName] = useState("");
  const [transportType, setTransportType] = useState<"http" | "stdio">("http");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [stdioCommand, setStdioCommand] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    serverName.trim().length >= 1 &&
    serverName.trim().length <= 253 &&
    (transportType === "http" ? endpointUrl.trim() : stdioCommand.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serverName.trim(),
          transportType,
          endpointUrl: transportType === "http" ? endpointUrl.trim() : undefined,
          stdioCommand: transportType === "stdio" ? stdioCommand.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to add server. Please try again.");
        return;
      }

      router.push("/servers");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-lg border-white/10 bg-bg-base">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Add a new server</CardTitle>
        <CardDescription>
          Register a new MCP server under your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">Server name</Label>
            <Input
              id="serverName"
              placeholder="production-db"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              required
              minLength={1}
              maxLength={253}
              className="border-white/10 bg-white/5"
            />
            <p className="text-xs text-white/40">1–253 characters</p>
          </div>

          {/* Transport Type Toggle */}
          <div className="space-y-2">
            <Label>Transport type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransportType("http")}
                className={cn(
                  "flex flex-col gap-2 p-4 rounded-lg border-2 text-left transition-all duration-150",
                  transportType === "http"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-blue-400" />
                  <span className="font-medium text-sm text-slate-200">HTTP</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] ml-auto">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs text-white/50">Full coverage · All scan modules</p>
              </button>
              <button
                type="button"
                onClick={() => setTransportType("stdio")}
                className={cn(
                  "flex flex-col gap-2 p-4 rounded-lg border-2 text-left transition-all duration-150",
                  transportType === "stdio"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-amber-400" />
                  <span className="font-medium text-sm text-slate-200">STDIO</span>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] ml-auto">
                    ⚠ Limited
                  </Badge>
                </div>
                <p className="text-xs text-white/50">Local only · Reduced scan scope</p>
              </button>
            </div>
          </div>

          {/* Endpoint URL (HTTP) or STDIO Command */}
          {transportType === "http" ? (
            <div className="space-y-2">
              <Label htmlFor="endpointUrl">Endpoint URL</Label>
              <Input
                id="endpointUrl"
                placeholder="https://mcp.example.com"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                required
                className="border-white/10 bg-white/5"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stdioCommand">STDIO command</Label>
              <Input
                id="stdioCommand"
                placeholder="npx -y @modelcontextprotocol/server-filesystem"
                value={stdioCommand}
                onChange={(e) => setStdioCommand(e.target.value)}
                required
                className="border-white/10 bg-white/5"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isSubmitting ? "Adding server..." : "Add Server"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
