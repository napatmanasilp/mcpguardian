"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingSteps } from "@/components/onboarding/onboarding-steps";
import { createClient } from "@/lib/supabase/client";
import { ShieldLogo } from "@/components/auth/shield-logo";

type InitStatus = "loading" | "ready" | "error" | "no_server" | "no_membership";

function highlightJson(json: string): string {
  return json
    .replace(/"([^"]+)":/g, '<span class="text-blue-300">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="text-emerald-300">"$1"</span>')
    .replace(/: (true|false|null)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/: (\d+)/g, ': <span class="text-purple-300">$1</span>');
}

function downloadConfig(configStr: string) {
  const blob = new Blob([configStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ".mcpguardian.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProxySetupPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "waiting" | "detected" | "timeout"
  >("waiting");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const siteOrigin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

  const getConfig = (sid: string | null, token: string | null) => {
    if (sid && token) {
      return JSON.stringify({
        mcpServers: {
          "my-app": {
            url: `${siteOrigin}/api/proxy/${sid}`,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      }, null, 2);
    }
    return JSON.stringify({
      mcpServers: {
        "my-app": {
          url: `${siteOrigin}/api/proxy/YOUR_SERVER_ID`,
          headers: { Authorization: "Bearer YOUR_SESSION_TOKEN" },
        },
      },
    }, null, 2);
  };

  const proxyConfigStr = getConfig(serverId, sessionToken);

  // ── Initialize: find server + create session ──────────────────────
  const init = useCallback(async () => {
    setInitStatus("loading");
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login?redirect=/onboarding/proxy-setup");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("invitation_status", "accepted")
        .maybeSingle();

      if (membershipError) {
        console.error("Failed to fetch membership:", membershipError);
        setInitStatus("error");
        setErrorMessage("Failed to load your organization. Please try again.");
        return;
      }

      if (!membership) {
        setInitStatus("no_membership");
        return;
      }

      const { data: server, error: serverError } = await supabase
        .from("mcp_servers")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (serverError) {
        console.error("Failed to fetch server:", serverError);
        setInitStatus("error");
        setErrorMessage("Failed to load your MCP server. Please try again.");
        return;
      }

      if (!server) {
        setInitStatus("no_server");
        return;
      }

      setServerId(server.id);

      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcpServerId: server.id }),
      });

      const sessionData = await sessionRes.json();

      if (!sessionRes.ok) {
        console.error("Failed to create session:", sessionData);
        setInitStatus("error");
        setErrorMessage(sessionData?.error?.message ?? "Failed to create proxy session.");
        return;
      }

      const token = sessionData?.data?.sessionToken;
      if (token) {
        setSessionToken(token);
        setInitStatus("ready");
      } else {
        console.error("No sessionToken in response:", sessionData);
        setInitStatus("error");
        setErrorMessage("Session created but no token returned.");
      }
    } catch (err) {
      console.error("Init error:", err);
      setInitStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  }, [router]);

  useEffect(() => {
    init();
  }, [init]);

  // ── Poll for first tool call ──────────────────────────────────────
  useEffect(() => {
    if (!serverId || connectionStatus !== "waiting" || initStatus !== "ready") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions?serverId=${serverId}&limit=5`);
        if (!res.ok) return;
        const data = await res.json();
        const sessions = data.data?.sessions ?? [];

        const hasToolCalls = sessions.some(
          (s: { tool_call_count?: number }) => (s.tool_call_count ?? 0) > 0,
        );
        if (hasToolCalls) {
          setConnectionStatus("detected");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // poll continues
      }
    }, 10_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [serverId, connectionStatus, initStatus]);

  // ── Timeout after 3 minutes ───────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (connectionStatus === "waiting") {
        setConnectionStatus("timeout");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 180_000);
    return () => clearTimeout(timer);
  }, [connectionStatus]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCopyConfig = useCallback(() => {
    navigator.clipboard.writeText(proxyConfigStr);
    setConfigCopied(true);
    toast.success("Config copied to clipboard");
    setTimeout(() => setConfigCopied(false), 2000);
  }, [proxyConfigStr]);

  const handleDownload = useCallback(() => {
    downloadConfig(proxyConfigStr);
    toast.success("Config file downloaded");
  }, [proxyConfigStr]);

  const handleContinue = useCallback(() => {
    const param = connectionStatus === "detected" ? "connected" : "skipped";
    router.push(`/onboarding/confirmed?proxy=${param}`);
  }, [router, connectionStatus]);

  const handleSkip = useCallback(() => {
    router.push("/onboarding/confirmed?proxy=skipped");
  }, [router]);

  // ── Connection status label ───────────────────────────────────────
  let statusMessage: string;
  let statusVariant: "loading" | "success" | "waiting";

  if (initStatus === "loading") {
    statusMessage = "Setting up your proxy session...";
    statusVariant = "loading";
  } else if (connectionStatus === "detected") {
    statusMessage = "First tool call intercepted!";
    statusVariant = "success";
  } else if (connectionStatus === "timeout") {
    statusMessage = "Still waiting for a connection? You can skip this step.";
    statusVariant = "waiting";
  } else if (sessionToken) {
    statusMessage = "Waiting for first proxied request...";
    statusVariant = "waiting";
  } else {
    statusMessage = "Preparing configuration...";
    statusVariant = "loading";
  }

  // ── Error/empty states ────────────────────────────────────────────
  if (initStatus === "no_membership") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-bg-surface">
          <CardHeader className="text-center">
            <OnboardingSteps currentStep={2} />
            <ShieldLogo className="mx-auto mb-4" />
            <CardTitle className="text-xl">No Organization Found</CardTitle>
            <CardDescription>
              You need to create an organization and register a server before setting up the proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => router.push("/onboarding")}>
              Go to onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initStatus === "no_server") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-bg-surface">
          <CardHeader className="text-center">
            <OnboardingSteps currentStep={2} />
            <ShieldLogo className="mx-auto mb-4" />
            <CardTitle className="text-xl">No MCP Server Found</CardTitle>
            <CardDescription>
              Register an MCP server first, then come back to set up the proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => router.push("/onboarding")}>
              Register a server
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initStatus === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-white/10 bg-bg-surface">
          <CardHeader className="text-center">
            <OnboardingSteps currentStep={2} />
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-500/20">
              <AlertCircle className="size-6 text-red-400" />
            </div>
            <CardTitle className="text-xl">Something went wrong</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full gap-2" onClick={init}>
              <RefreshCw className="size-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-2xl border-white/10" style={{ background: "var(--bg-surface)" }}>
        <CardHeader className="text-center">
          <OnboardingSteps currentStep={2} />
          <div className="mx-auto mb-4">
            <ShieldLogo className="size-12" />
          </div>
          <CardTitle className="text-xl">
            Connect your AI agent through MCPGuardian
          </CardTitle>
          <CardDescription>
            Route your MCP client through our proxy for real-time runtime protection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Two-column diagram */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-xs font-semibold text-red-400 mb-2">UNPROTECTED</p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Agent</span>
                <span className="text-slate-600">→</span>
                <span>MCP Server</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">No runtime inspection</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <p className="text-xs font-semibold text-emerald-400 mb-2">PROTECTED</p>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Agent</span>
                <span className="text-emerald-500">→</span>
                <span className="font-semibold text-emerald-400">MCPGuardian</span>
                <span className="text-slate-600">→</span>
                <span>MCP Server</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Real-time inspection ✅</p>
            </div>
          </div>

          {/* Client tabs */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Your MCP client</p>
            <div className="flex gap-1 flex-wrap">
              {(["Claude Desktop", "Cursor", "Cline", "Custom"] as const).map((client) => (
                <button
                  key={client}
                  type="button"
                  className="px-3 py-1.5 rounded-md text-xs font-mono border border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-blue-400 hover:bg-blue-500/5 transition-colors"
                >
                  {client}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Paste the config below into your client&apos;s MCP server settings.
              For <span className="text-slate-300">Claude Desktop</span>: open{" "}
              <code className="text-[11px] bg-white/5 px-1 rounded">claude_desktop_config.json</code> and
              replace the <code className="text-[11px] bg-white/5 px-1 rounded">mcpServers</code> block.
            </p>
          </div>

          {/* Config block with syntax highlighting */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">MCP client configuration</p>
            <div className="relative rounded-lg border border-white/10 bg-black/50 p-4">
              <pre
                className="font-mono text-xs leading-relaxed overflow-x-scroll scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/20"
                dangerouslySetInnerHTML={{ __html: highlightJson(proxyConfigStr) }}
              />
            </div>
            {/* Copy + Download buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyConfig}
                className="flex-1 gap-2 border-white/10"
              >
                <Copy className="size-3.5" />
                {configCopied ? "Copied!" : "Copy Config"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex-1 gap-2 border-white/10"
              >
                <Download className="size-3.5" />
                Download .json
              </Button>
            </div>
            {/* Token show/hide */}
            {serverId && sessionToken && (
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 mt-1"
              >
                {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showToken ? "Hide token" : "Show token"}
              </button>
            )}
          </div>

          {/* Status indicator */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            {statusVariant === "loading" && (
              <div className="flex items-center justify-center gap-3">
                <div className="size-8 rounded-full bg-white/10 animate-pulse shrink-0" />
                <div className="space-y-1.5 text-left">
                  <div className="h-4 w-48 rounded bg-white/10 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            )}
            {statusVariant === "waiting" && (
              <div className="flex items-center justify-center gap-3">
                <div className="relative flex size-8 items-center justify-center shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-30" />
                  <span className="relative inline-flex size-3 rounded-full bg-blue-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-300">{statusMessage}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Make one tool call from your MCP client to confirm
                  </p>
                </div>
              </div>
            )}
            {statusVariant === "success" && (
              <div className="flex items-center justify-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="size-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-400">
                    First tool call intercepted!
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your agent is now being protected by MCPGuardian
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Debug checklist on timeout */}
          {connectionStatus === "timeout" && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <p className="text-sm font-medium text-amber-400">
                Troubleshooting checklist
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                <li>Verify the proxy URL in your config matches the URL shown above</li>
                <li>Confirm the Authorization header contains your full bearer token</li>
                <li>Restart your MCP client after saving the config</li>
                <li>Check that your firewall allows outbound HTTPS on port 443</li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            {connectionStatus === "detected" ? (
              <Button className="flex-1 gap-2" onClick={handleContinue}>
                Continue <ChevronRight className="size-4" />
              </Button>
            ) : connectionStatus === "timeout" ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1 border-white/10"
                  onClick={handleSkip}
                >
                  Skip for now
                </Button>
                <Button className="flex-1 gap-2" onClick={handleContinue}>
                  Continue anyway <ChevronRight className="size-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="flex-1 border-white/10"
                onClick={handleContinue}
              >
                Continue anyway
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
