"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ServerActionsProps {
  serverId: string;
  serverName: string;
  transportType: string;
  endpointUrl?: string | null;
  stdioCommand?: string | null;
}

export function ServerActions({
  serverId,
  serverName,
  transportType,
  endpointUrl,
  stdioCommand,
}: ServerActionsProps) {
  return (
    <div className="flex gap-2">
      <EditServerDialog
        serverId={serverId}
        serverName={serverName}
        transportType={transportType}
        endpointUrl={endpointUrl}
        stdioCommand={stdioCommand}
      />
      <DeleteServerDialog serverId={serverId} serverName={serverName} />
    </div>
  );
}

function EditServerDialog({
  serverId,
  serverName,
  transportType,
  endpointUrl,
  stdioCommand,
}: ServerActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(serverName);
  const [url, setUrl] = useState(endpointUrl ?? "");
  const [command, setCommand] = useState(stdioCommand ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== serverName) body.name = name;
      if (transportType === "http" && url !== (endpointUrl ?? "")) body.endpointUrl = url;
      if (transportType === "stdio" && command !== (stdioCommand ?? "")) body.stdioCommand = command;

      if (Object.keys(body).length === 0) {
        setOpen(false);
        return;
      }

      const res = await fetch(`/api/servers/${serverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Update failed");
      }

      toast.success("Server updated");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-white/10 gap-1.5">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[hsl(222,47%,8%)] border-white/10">
        <DialogHeader>
          <DialogTitle>Edit Server</DialogTitle>
          <DialogDescription>Update the server name or endpoint.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="server-name">Name</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-white/10 bg-white/5"
            />
          </div>
          {transportType === "http" && (
            <div className="space-y-2">
              <Label htmlFor="server-url">Endpoint URL</Label>
              <Input
                id="server-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="border-white/10 bg-white/5"
                placeholder="https://..."
              />
            </div>
          )}
          {transportType === "stdio" && (
            <div className="space-y-2">
              <Label htmlFor="server-command">STDIO Command</Label>
              <Input
                id="server-command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="border-white/10 bg-white/5"
                placeholder="npx @modelcontextprotocol/..."
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteServerDialog({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Delete failed");
      }
      toast.success("Server deleted");
      router.push("/servers");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete server");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[hsl(222,47%,8%)] border-white/10">
        <DialogHeader>
          <DialogTitle>Delete Server</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{serverName}</strong>? This will remove all associated scans, sessions, and telemetry data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="size-4 animate-spin mr-1.5" />}
            Delete Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
