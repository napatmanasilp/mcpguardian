"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Shield,
  Terminal,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ShieldLogo } from "@/components/auth/shield-logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── Code snippets per language ──────────────────────────────────────────
const CODE_LANGUAGES = ["curl", "node.js", "python"] as const;
type CodeLang = (typeof CODE_LANGUAGES)[number];

function getCodeSnippet(lang: CodeLang, apiKey: string, proxyUrl: string): string {
  const masked = apiKey ? apiKey : "mcpg_sk_••••••••••••••••••••••••••••••••";
  switch (lang) {
    case "curl":
      return `curl -X POST ${proxyUrl} \\
  -H "Authorization: Bearer ${masked}" \\
  -H "Content-Type: application/json" \\
  -d '{"method": "tools/list"}'`;
    case "node.js":
      return `const response = await fetch("${proxyUrl}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${masked}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ method: "tools/list" }),
});

const data = await response.json();
console.log(data);`;
    case "python":
      return `import requests

response = requests.post(
    "${proxyUrl}",
    headers={
        "Authorization": "Bearer ${masked}",
        "Content-Type": "application/json",
    },
    json={"method": "tools/list"},
)

print(response.json())`;
    default:
      return "";
  }
}

// ── MCP client config snippet ───────────────────────────────────────────
function getMcpClientConfig(apiKey: string, proxyUrl: string): string {
  const masked = apiKey ? apiKey : "mcpg_sk_••••••••••••••••••••••••••••••••";
  return JSON.stringify(
    {
      mcpServers: {
        "my-server": {
          url: proxyUrl,
          headers: { Authorization: `Bearer ${masked}` },
        },
      },
    },
    null,
    2,
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [existingKeyPrefix, setExistingKeyPrefix] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);
  const [keyCopied, setKeyCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [selectedLang, setSelectedLang] = useState<CodeLang>("curl");
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOrg, setHasOrg] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const siteOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  const proxyUrl = `${siteOrigin}/api/proxy`;

  // ── On mount: check if user already has org + key ─────────────────
  useEffect(() => {
    const checkExistingState = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Prefill org name from email
        if (user.email) {
          const domain = user.email.split("@")[1] ?? "";
          const name = domain.split(".")[0] ?? "";
          const derived =
            name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
          if (derived) setOrgName(derived);
        }

        // Check if user already has an API key (meaning org already exists)
        const keyRes = await fetch("/api/api-keys");
        if (keyRes.ok) {
          const keyData = await keyRes.json();
          const keys = keyData.keys ?? [];
          if (keys.length > 0) {
            // User already has an org and key — show completed state
            setHasOrg(true);
            setExistingKeyPrefix(keys[0].key_prefix);
          }
        }
      } catch {
        // Silent — will show form
      } finally {
        setIsLoading(false);
      }
    };

    const stored = sessionStorage.getItem("signup-email");
    if (stored) {
      const domain = stored.split("@")[1] ?? "";
      const name = domain.split(".")[0] ?? "";
      const derived =
        name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
      if (derived) setOrgName(derived);
    }

    checkExistingState();
  }, []);

  // Determine if step 1 is complete (either just generated or already had one)
  const step1Complete = !!apiKey || !!existingKeyPrefix;

  // ── Generate API Key ──────────────────────────────────────────────
  const handleGenerateKey = useCallback(async () => {
    if (!orgName.trim()) return;
    setIsCreating(true);
    setError(null);

    try {
      // Step 1: Create org via onboarding endpoint (reuse existing logic)
      const onboardRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          serverName: "default",
          transportType: "http",
          endpointUrl: "https://placeholder.mcpguardian.com",
        }),
      });

      if (!onboardRes.ok) {
        const data = await onboardRes.json();
        // If org already exists, that's fine — continue to key generation
        const msg = data?.error?.message ?? "";
        if (!msg.includes("already") && !msg.includes("duplicate")) {
          throw new Error(msg || "Failed to set up organization");
        }
      }

      // Step 2: Generate API key
      const keyRes = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Onboarding Key" }),
      });

      const keyData = await keyRes.json();

      if (!keyRes.ok) {
        // If max keys reached, user already has one — treat as success
        if (keyRes.status === 403 && keyData?.error?.includes("max")) {
          setHasOrg(true);
          // Fetch existing key prefix
          const existingRes = await fetch("/api/api-keys");
          if (existingRes.ok) {
            const existing = await existingRes.json();
            const keys = existing.keys ?? [];
            if (keys.length > 0) {
              setExistingKeyPrefix(keys[0].key_prefix);
            }
          }
          toast.success("You already have an API key — you're all set!");
          return;
        }
        throw new Error(keyData?.error ?? "Failed to generate API key");
      }

      setApiKey(keyData.key);
      setHasOrg(true);
      toast.success("API key generated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsCreating(false);
    }
  }, [orgName]);

  // ── Copy handlers ─────────────────────────────────────────────────
  const handleCopyKey = useCallback(() => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    toast.success("API key copied");
    setTimeout(() => setKeyCopied(false), 2000);
  }, [apiKey]);

  const handleCopyCode = useCallback(() => {
    const code = getCodeSnippet(selectedLang, apiKey ?? "", proxyUrl);
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCodeCopied(false), 2000);
  }, [apiKey, selectedLang, proxyUrl]);

  const handleCopyConfig = useCallback(() => {
    const config = getMcpClientConfig(apiKey ?? "", proxyUrl);
    navigator.clipboard.writeText(config);
    setConfigCopied(true);
    toast.success("Config copied");
    setTimeout(() => setConfigCopied(false), 2000);
  }, [apiKey, proxyUrl]);

  // ── Loading state ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Loader2 className="size-6 animate-spin text-white/40" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto mb-2">
            <ShieldLogo className="size-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Secure your first MCP server
          </h1>
          <p className="text-sm text-white/50 max-w-md mx-auto">
            Follow the steps to connect your MCP server through MCPGuardian for
            runtime protection.
          </p>
        </div>

        {/* Step 1: Generate API Key */}
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  step1Complete
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-blue-500/20 text-blue-400",
                )}
              >
                {step1Complete ? <Check className="size-3.5" /> : "1"}
              </div>
              <CardTitle className="text-base">Add an API key</CardTitle>
            </div>
            <CardDescription className="ml-10 text-xs">
              Use the generated key to authenticate requests to your protected
              MCP servers.
            </CardDescription>
          </CardHeader>
          <CardContent className="ml-10 space-y-4">
            {!step1Complete ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="text-xs text-white/60">
                    Organization name
                  </Label>
                  <Input
                    id="orgName"
                    placeholder="Your company or project name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="border-white/10 bg-white/5 h-9"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <Button
                  onClick={handleGenerateKey}
                  disabled={!orgName.trim() || isCreating}
                  className="gap-2"
                  size="sm"
                >
                  {isCreating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Key className="size-3.5" />
                  )}
                  Generate API Key
                </Button>
              </>
            ) : apiKey ? (
              /* Just generated — show full key */
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2">
                  <code className="flex-1 text-xs font-mono text-emerald-300 truncate">
                    {showKey ? apiKey : "mcpg_sk_" + "•".repeat(40)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showKey ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-1 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {keyCopied ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-white/40">
                  This key is shown only once. Store it somewhere safe.
                </p>
              </div>
            ) : (
              /* Returning user — show existing key prefix */
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <Key className="size-3.5 text-emerald-400 shrink-0" />
                  <code className="flex-1 text-xs font-mono text-emerald-300">
                    {existingKeyPrefix}••••••••••••
                  </code>
                  <span className="text-[10px] text-emerald-400/70 font-medium">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-white/40">
                  You already have an API key. Manage keys in{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/settings/api-keys")}
                    className="text-blue-400 hover:underline"
                  >
                    Settings → API Keys
                  </button>
                  .
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Connect MCP Server */}
        <Card
          className={cn(
            "border-white/10 transition-opacity duration-300",
            step1Complete ? "opacity-100" : "opacity-40 pointer-events-none",
          )}
          style={{ background: "hsl(222, 47%, 6%)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                2
              </div>
              <CardTitle className="text-base">
                Connect your MCP server
              </CardTitle>
            </div>
            <CardDescription className="ml-10 text-xs">
              Add this config to your MCP client (Claude Desktop, Cursor, etc.)
              or make an API call to verify the connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="ml-10 space-y-4">
            {/* MCP Client Config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/70">
                  MCP client config
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-white/50 hover:text-white"
                  onClick={handleCopyConfig}
                >
                  {configCopied ? (
                    <>
                      <Check className="size-3 mr-1" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 mr-1" /> Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/50 p-3">
                <pre className="font-mono text-[11px] leading-relaxed text-white/80 overflow-x-auto">
                  {getMcpClientConfig(apiKey ?? "", proxyUrl)}
                </pre>
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Code snippet */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white/70">
                  Or verify with a test request
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-white/50 hover:text-white"
                  onClick={handleCopyCode}
                >
                  {codeCopied ? (
                    <>
                      <Check className="size-3 mr-1" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 mr-1" /> Copy
                    </>
                  )}
                </Button>
              </div>
              {/* Language tabs */}
              <div className="flex gap-1 border-b border-white/5 pb-1">
                {CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLang(lang)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      selectedLang === lang
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/70",
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/50 p-3">
                <pre className="font-mono text-[11px] leading-relaxed text-white/80 overflow-x-auto whitespace-pre-wrap">
                  {getCodeSnippet(selectedLang, apiKey ?? "", proxyUrl)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Explore more */}
        <Card
          className={cn(
            "border-white/10 transition-opacity duration-300",
            step1Complete ? "opacity-100" : "opacity-40 pointer-events-none",
          )}
          style={{ background: "hsl(222, 47%, 6%)" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                3
              </div>
              <CardTitle className="text-base">Explore more</CardTitle>
            </div>
            <CardDescription className="ml-10 text-xs">
              Continue unlocking MCPGuardian&apos;s full capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="ml-10 space-y-2">
            <button
              type="button"
              onClick={() => router.push("/servers/new")}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group text-left"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/15">
                <Plus className="size-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">
                  Add an MCP server
                </p>
                <p className="text-xs text-white/40">
                  Register and scan servers for vulnerabilities.
                </p>
              </div>
              <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => router.push("/sessions")}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group text-left"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15">
                <Shield className="size-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">
                  View proxy sessions
                </p>
                <p className="text-xs text-white/40">
                  Monitor runtime tool calls in real time.
                </p>
              </div>
              <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => router.push("/settings/team")}
              className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors group text-left"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-purple-500/15">
                <Terminal className="size-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80">
                  Invite your team
                </p>
                <p className="text-xs text-white/40">
                  Collaborate on MCP server security.
                </p>
              </div>
              <ChevronRight className="size-4 text-white/30 group-hover:text-white/60 transition-colors" />
            </button>
          </CardContent>
        </Card>

        {/* Continue to dashboard */}
        {step1Complete && (
          <div className="flex justify-center pt-2 pb-8">
            <Button
              onClick={() => router.push("/dashboard")}
              className="gap-2"
            >
              Continue to Dashboard
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
