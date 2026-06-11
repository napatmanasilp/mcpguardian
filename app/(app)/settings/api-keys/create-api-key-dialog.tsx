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
  const [hasConfirmed, setHasConfirmed] = useState(false);

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
    setTimeout(() => setCopied(false), 3000);
  }, [createdKey]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setName("");
        setStep("form");
        setCreatedKey(null);
        setErrorMessage("");
        setCopied(false);
        setHasConfirmed(false);
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
      <DialogContent className="border-white/10 bg-bg-base sm:max-w-md">
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
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
              <p className="text-xs text-amber-400 font-semibold mb-2">
                ⚠ Copy this key now — it will never be shown again
              </p>
              <div className="relative">
                <pre className="text-xs text-slate-200 font-mono bg-black/50 rounded-md p-3 overflow-x-scroll break-all select-all scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/20">
                  {createdKey}
                </pre>
              </div>
              {/* Large prominent copy button */}
              <Button onClick={handleCopy} className="w-full mt-3 gap-2" variant="outline">
                <Copy className="size-4" />
                {copied ? "Copied!" : "Copy API Key"}
              </Button>
              {/* Confirmation checkbox */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasConfirmed}
                  onChange={(e) => setHasConfirmed(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 accent-blue-500"
                />
                <span className="text-sm text-white/60">
                  I have saved this key in a secure location
                </span>
              </label>
            </div>
            <Button className="w-full" onClick={handleDone} disabled={!copied && !hasConfirmed}>
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
