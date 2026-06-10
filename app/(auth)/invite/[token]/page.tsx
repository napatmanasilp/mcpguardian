"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { ShieldLogo } from "@/components/auth/shield-logo";

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [status, setStatus] = useState<"loading" | "valid" | "accepted" | "expired" | "error">("loading");
  const [orgName, setOrgName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const checkInvite = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Invalid invite link");
        return;
      }

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push(`/login?redirect=/invite/${token}`);
          return;
        }

        // Look up the invite by token
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id, invitation_status")
          .eq("user_id", user.id)
          .single();

        if (membership?.invitation_status === "accepted") {
          setStatus("accepted");
          return;
        }

        setStatus("valid");
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to load invite");
      }
    };
    checkInvite();
  }, [token, router]);

  const handleAccept = useCallback(async () => {
    setStatus("loading");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Accept invite by updating the membership status
      const { data: pendingMembership, error: lookupError } = await supabase
        .from("organization_members")
        .select("id, organization_id, invitation_status")
        .eq("user_id", user.id)
        .eq("invitation_status", "pending")
        .single();

      if (lookupError || !pendingMembership) {
        throw new Error("No pending invitation found");
      }

      const { error } = await supabase
        .from("organization_members")
        .update({ invitation_status: "accepted" })
        .eq("id", pendingMembership.id);

      if (error) throw error;
      setStatus("accepted");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to accept invite");
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="py-8 text-center">
            <XCircle className="size-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400">Invalid invite link</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <ShieldLogo />
          </div>
          <CardTitle className="text-xl">
            {status === "loading" && "Checking invite..."}
            {status === "valid" && "Join Organization"}
            {status === "accepted" && "Invite Accepted"}
            {status === "expired" && "Invite Expired"}
            {status === "error" && "Invite Error"}
          </CardTitle>
          {orgName && (
            <CardDescription>
              You&apos;ve been invited to <strong>{orgName}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "loading" && (
            <Loader2 className="size-8 animate-spin text-blue-400 mx-auto" />
          )}

          {status === "valid" && (
            <>
              <p className="text-sm text-slate-400">
                Accept the invitation to join the organization and gain access to shared
                MCP servers, scans, and settings.
              </p>
              <Button className="w-full gap-2" onClick={handleAccept}>
                <Check className="size-4" />
                Accept Invitation
              </Button>
            </>
          )}

          {status === "accepted" && (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
                <Check className="size-6 text-emerald-400" />
              </div>
              <p className="text-sm text-slate-400">You are now a member of this organization.</p>
              <Button className="w-full" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "expired" && (
            <>
              <XCircle className="size-8 text-red-400 mx-auto" />
              <p className="text-sm text-slate-400">This invite link has expired or is no longer valid.</p>
              <Button variant="outline" className="border-white/10" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="size-8 text-red-400 mx-auto" />
              <p className="text-sm text-red-400">{errorMessage}</p>
              <Button variant="outline" className="border-white/10" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
