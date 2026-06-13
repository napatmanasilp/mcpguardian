"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface ClientInstructionsProps {
  proxyUrl: string;
  bearerToken: string;
}

export function ClientInstructions({ proxyUrl, bearerToken }: ClientInstructionsProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "mcpguardian-proxy": {
          url: proxyUrl,
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      },
    },
    null,
    2
  );

  const customJson = JSON.stringify(
    {
      url: proxyUrl,
      headers: { Authorization: `Bearer ${bearerToken}` },
    },
    null,
    2
  );

  return (
    <Tabs defaultValue="claude-desktop" className="w-full">
      <TabsList className="grid w-full grid-cols-4 bg-white/5 border border-white/10">
        <TabsTrigger
          value="claude-desktop"
          className="text-xs data-[state=active]:bg-monitor/20 data-[state=active]:text-monitor"
        >
          Claude Desktop
        </TabsTrigger>
        <TabsTrigger
          value="cursor"
          className="text-xs data-[state=active]:bg-monitor/20 data-[state=active]:text-monitor"
        >
          Cursor
        </TabsTrigger>
        <TabsTrigger
          value="cline"
          className="text-xs data-[state=active]:bg-monitor/20 data-[state=active]:text-monitor"
        >
          Cline
        </TabsTrigger>
        <TabsTrigger
          value="custom"
          className="text-xs data-[state=active]:bg-monitor/20 data-[state=active]:text-monitor"
        >
          Custom
        </TabsTrigger>
      </TabsList>

      {/* Claude Desktop Tab */}
      <TabsContent value="claude-desktop" className="space-y-3 mt-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">
            Edit your Claude Desktop config file:
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium w-16">macOS:</span>
              <code className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-300 font-mono">
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium w-16">Windows:</span>
              <code className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded text-slate-300 font-mono">
                %APPDATA%\Claude\claude_desktop_config.json
              </code>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Add or replace the <code className="bg-white/5 px-1 rounded">mcpServers</code> key
            with the following configuration:
          </p>
          <div className="relative rounded-lg border border-white/10 bg-black/50 p-4">
            <pre className="font-mono text-xs leading-relaxed text-slate-300 overflow-x-auto">
              {claudeDesktopConfig}
            </pre>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
              onClick={() => handleCopy(claudeDesktopConfig, "claude-desktop")}
            >
              {copiedTab === "claude-desktop" ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Save the file and restart Claude Desktop for the changes to take effect.
          </p>
        </div>
      </TabsContent>

      {/* Cursor Tab */}
      <TabsContent value="cursor" className="space-y-3 mt-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">
            Configure Cursor to use MCPGuardian:
          </p>
          <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside">
            <li>
              Open <span className="text-slate-300 font-medium">Cursor Settings</span> → <span className="text-slate-300 font-medium">MCP</span>
            </li>
            <li>
              Click <span className="text-slate-300 font-medium">Add Server</span>
            </li>
            <li>
              Set the server URL to:
              <div className="mt-1 relative rounded-lg border border-white/10 bg-black/50 p-3">
                <code className="font-mono text-xs text-emerald-300 break-all">{proxyUrl}</code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-300"
                  onClick={() => handleCopy(proxyUrl, "cursor-url")}
                >
                  {copiedTab === "cursor-url" ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </li>
            <li>
              Set the Authorization header to:
              <div className="mt-1 relative rounded-lg border border-white/10 bg-black/50 p-3">
                <code className="font-mono text-xs text-emerald-300 break-all">
                  Bearer {bearerToken}
                </code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-300"
                  onClick={() => handleCopy(`Bearer ${bearerToken}`, "cursor-header")}
                >
                  {copiedTab === "cursor-header" ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </li>
            <li>Save and the server should connect automatically.</li>
          </ol>
        </div>
      </TabsContent>

      {/* Cline Tab */}
      <TabsContent value="cline" className="space-y-3 mt-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">
            Configure Cline to use MCPGuardian:
          </p>
          <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside">
            <li>
              Open the <span className="text-slate-300 font-medium">MCP Servers</span> panel in Cline
            </li>
            <li>
              Click <span className="text-slate-300 font-medium">Add Server</span>
            </li>
            <li>
              Set transport to <span className="text-slate-300 font-medium">HTTP</span>
            </li>
            <li>
              Paste the proxy URL:
              <div className="mt-1 relative rounded-lg border border-white/10 bg-black/50 p-3">
                <code className="font-mono text-xs text-emerald-300 break-all">{proxyUrl}</code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-300"
                  onClick={() => handleCopy(proxyUrl, "cline-url")}
                >
                  {copiedTab === "cline-url" ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </li>
            <li>
              Set the bearer token to:
              <div className="mt-1 relative rounded-lg border border-white/10 bg-black/50 p-3">
                <code className="font-mono text-xs text-emerald-300 break-all">{bearerToken}</code>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1.5 right-1.5 text-slate-500 hover:text-slate-300"
                  onClick={() => handleCopy(bearerToken, "cline-token")}
                >
                  {copiedTab === "cline-token" ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </li>
            <li>Save and the connection will be established.</li>
          </ol>
        </div>
      </TabsContent>

      {/* Custom Tab */}
      <TabsContent value="custom" className="space-y-3 mt-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300">
            Generic configuration for any MCP client:
          </p>
          <p className="text-xs text-slate-400">
            Use the following JSON to configure any MCP client that supports HTTP transport
            with Bearer token authentication:
          </p>
          <div className="relative rounded-lg border border-white/10 bg-black/50 p-4">
            <pre className="font-mono text-xs leading-relaxed text-slate-300 overflow-x-auto">
              {customJson}
            </pre>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
              onClick={() => handleCopy(customJson, "custom")}
            >
              {copiedTab === "custom" ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
