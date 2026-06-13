import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Key, Trash2 } from "lucide-react";

export const metadata: Metadata = {
  title: "API Keys — MCPGuardian",
  description: "Create and manage API keys for programmatic access to MCPGuardian.",
};

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import { CreateApiKeyDialog } from "./create-api-key-dialog";

const ApiKeysPage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const svc = createServiceClient();

  const { data: apiKeys } = await svc
    .from("api_keys")
    .select("id, name, key_prefix, scopes, last_used_at, created_at, is_active")
    .eq("user_id", orgContext.userId)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
      </div>

      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-200">Keys</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Manage API keys for programmatic access to MCPGuardian.
            </CardDescription>
          </div>
          <CreateApiKeyDialog />
        </CardHeader>
        <CardContent className="space-y-2">
          {apiKeys && apiKeys.length > 0 ? (
            apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Key className="size-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{key.name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{key.key_prefix}…</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {key.scopes && (
                    <Badge variant="outline" className="text-[9px] border-white/10">
                      {key.scopes}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn("text-[9px]", key.is_active ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400")}
                  >
                    {key.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {key.last_used_at && (
                    <span className="text-[10px] text-slate-500">
                      Used {new Date(key.last_used_at).toLocaleDateString()}
                    </span>
                  )}
                  <button type="button" className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Key className="size-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No API keys created</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ApiKeysPage;
