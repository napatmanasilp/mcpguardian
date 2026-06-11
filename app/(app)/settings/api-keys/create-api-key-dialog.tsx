"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Key, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "form" | "creating" | "created" | "error";

export function CreateApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setStep("creating");
    setErrorMessage("");

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create key");
      }

      if (!data.key) {
        throw new Error("No key returned from server");
      }

      setCreatedKey(data.key);
      setStep("created");
      toast.success("API key created");
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }, [name]);

  const handleCopy = useCallback(() => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [createdKey]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when dialog closes
      setTimeout(() => {
        setName("");
        setStep("form");
        setCreatedKey(null);
        setErrorMessage("");
        setCopied(false);
      }, 200);
    }
    setOpen(newOpen);
  }, []);

  const handleDone = useCallback(() => {
    router.refresh();
    setOpen(false);
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          Create Key
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[hsl(222,47%,6%)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-200">
            {step === "created" ? "API Key Created" : "Create API Key"}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {step === "created"
              ? "Copy this key now — you won't be able to see it again."
              : "Give your key a name so you can identify it later."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Form step ─────────────────────────────── */}
        {step === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name" className="text-xs text-slate-400">
                Key name
              </Label>
              <Input
                id="key-name"
                placeholder="e.g. Production CI"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    handleCreate();
                  }
                }}
                className="border-white/10 bg-white/5"
                autoFocus
              />
            </div>
            <Button
              className="w-full gap-2"
              disabled={!name.trim()}
              onClick={handleCreate}
            >
              <Key className="size-4" />
              Generate Key
            </Button>
          </div>
        )}

        {/* ── Creating step ──────────────────────────── */}
        {step === "creating" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="size-8 animate-spin text-blue-400" />
            <p className="text-sm text-slate-400">Generating your API key...</p>
          </div>
        )}

        {/* ── Created step ───────────────────────────── */}
        {step === "created" && createdKey && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-3">
              <p className="text-xs text-emerald-400 font-semibold mb-1">
                ⚠ Save this key — it will not be shown again
              </p>
              <div className="relative">
                <pre className="text-xs text-slate-200 font-mono bg-black/50 rounded-md p-3 pr-10 overflow-x-auto break-all select-all">
                  {createdKey}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-2 right-2 rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={handleDone}>
              Done
            </Button>
          </div>
        )}

        {/* ── Error step ──────────────────────────────── */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/8 p-3">
              <p className="text-sm text-red-400">{errorMessage}</p>
            </div>
            <Button
              className="w-full gap-2"
              variant="outline"
              onClick={() => setStep("form")}
            >
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
