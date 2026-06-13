"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Globe, Loader2, Plus, Terminal } from "lucide-react";
import { toast } from "sonner";

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
import { addServer } from "@/lib/actions/servers";
import { type ActionState } from "@/lib/types/settings";

const initialState: ActionState = {};

export function AddServerForm() {
  const [state, formAction, isPending] = useActionState(
    addServer,
    initialState,
  );
  const [transportType, setTransportType] = useState<"http" | "stdio">("http");
  const formRef = useRef<HTMLFormElement>(null);

  // Track previous state to detect changes
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state === prevStateRef.current) return;
    prevStateRef.current = state;

    if (state.success) {
      toast.success("Server added successfully.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card className="w-full max-w-lg border-white/10 bg-bg-base">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Add a new server</CardTitle>
        <CardDescription>
          Register a new MCP server under your organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="space-y-5">
          {/* Hidden transport field for the server action */}
          <input type="hidden" name="transport" value={transportType} />

          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">Server name</Label>
            <Input
              id="serverName"
              name="name"
              placeholder="production-db"
              required
              minLength={1}
              maxLength={253}
              className={cn(
                "border-white/10 bg-white/5",
                state.fieldErrors?.name && "border-red-500/50",
              )}
            />
            {state.fieldErrors?.name ? (
              <p className="text-xs text-threat">{state.fieldErrors.name}</p>
            ) : (
              <p className="text-xs text-white/40">1–253 characters</p>
            )}
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
                    ? "border-monitor bg-monitor/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-monitor" />
                  <span className="font-medium text-sm text-slate-200">HTTP</span>
                  <Badge className="bg-secure/20 text-secure border-secure/30 text-[9px] ml-auto">
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
                    ? "border-caution bg-caution/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-caution" />
                  <span className="font-medium text-sm text-slate-200">STDIO</span>
                  <Badge className="bg-caution/20 text-caution border-caution/30 text-[9px] ml-auto">
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
                name="endpoint"
                placeholder="https://mcp.example.com"
                required
                className={cn(
                  "border-white/10 bg-white/5",
                  state.fieldErrors?.endpoint && "border-red-500/50",
                )}
              />
              {state.fieldErrors?.endpoint && (
                <p className="text-xs text-threat">{state.fieldErrors.endpoint}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stdioCommand">STDIO command</Label>
              <Input
                id="stdioCommand"
                name="command"
                placeholder="npx -y @modelcontextprotocol/server-filesystem"
                required
                className={cn(
                  "border-white/10 bg-white/5",
                  state.fieldErrors?.command && "border-red-500/50",
                )}
              />
              {state.fieldErrors?.command && (
                <p className="text-xs text-threat">{state.fieldErrors.command}</p>
              )}
            </div>
          )}

          {/* Form-level Error Message */}
          {state.error && (
            <p className="text-sm text-threat bg-threat/10 border border-threat/20 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full gap-2"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isPending ? "Adding server..." : "Add Server"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
