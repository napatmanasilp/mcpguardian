"use client";

import { useState } from "react";
import { Bell, Crown, Lock, Loader2, MessageSquare, Mail, Webhook } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AlertChannelsGateProps {
  currentPlan: string;
}

/**
 * Shows a preview of available channel types (Slack, webhook, email)
 * in a locked state with an upgrade prompt for users on plans that
 * don't include webhook forwarding (Team+ required).
 */
export function AlertChannelsGate({ currentPlan }: AlertChannelsGateProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "team", billing: "monthly" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  };

  const channels = [
    {
      type: "Slack",
      icon: MessageSquare,
      description: "Send alerts to a Slack channel via incoming webhook",
      color: "text-purple-400 border-purple-500/30",
    },
    {
      type: "Webhook",
      icon: Webhook,
      description: "POST alert payloads to any HTTP endpoint",
      color: "text-blue-400 border-blue-500/30",
    },
    {
      type: "Email",
      icon: Mail,
      description: "Send formatted alert emails to your team",
      color: "text-emerald-400 border-emerald-500/30",
      available: currentPlan === "developer",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Preview of available channel types */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((ch) => (
          <Card key={ch.type} className="border-white/10 bg-[hsl(222,47%,6%)] opacity-60 relative">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-[10px] ${ch.color}`}>
                  <ch.icon className="size-3 mr-1" />
                  {ch.type}
                </Badge>
                {ch.available ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                    Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-monitor/30 text-monitor">
                    <Lock className="size-2.5 mr-0.5" />
                    Team+
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{ch.type} Notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">{ch.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upgrade prompt */}
      <div className="rounded-lg border border-monitor/30 bg-gradient-to-br from-monitor/5 to-transparent p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="size-12 rounded-full bg-monitor/15 flex items-center justify-center">
            <Bell className="size-6 text-monitor" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-base font-semibold text-slate-200">
              Unlock Webhook &amp; Slack Alert Channels
            </h3>
            <p className="text-sm text-slate-400">
              Route security alerts to Slack, custom webhooks, and PagerDuty with the Team plan ($99/mo).
              Configure severity filters, throttling, and per-channel routing rules.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {["Slack Integration", "Custom Webhooks", "PagerDuty", "Severity Routing", "Throttle Rules"].map((f) => (
                <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-monitor/10 text-monitor border border-monitor/20">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              disabled={loading}
              onClick={handleUpgrade}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
              Upgrade to Team — $99/mo
            </Button>
            <Link href="/upgrade">
              <Button variant="outline" size="sm" className="border-white/10 text-slate-400">
                Compare Plans
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
