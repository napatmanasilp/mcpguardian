"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Radar,
  Server,
  Settings,
  Shield,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRealtime } from "@/components/providers/realtime-provider";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/servers", icon: Server, label: "Servers" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "#more", icon: MoreHorizontal, label: "More" },
];

const MORE_ITEMS = [
  { href: "/settings/general", icon: Settings, label: "Settings" },
  { href: "/settings/billing", icon: Settings, label: "Billing" },
  { href: "/settings/api-keys", icon: Settings, label: "API Keys" },
  { href: "/settings/team", icon: Settings, label: "Team" },
];

export function MobileNav({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Use realtime alert count if available; fall back to server-provided prop
  const realtime = useRealtime();
  const effectiveAlerts = realtime.alertCount > 0 ? realtime.alertCount : unreadAlerts;

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "#more") return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Bottom bar — visible only below md (768px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-bg-void safe-area-pb md:hidden"
        aria-label="Mobile navigation"
      >
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);

          if (href === "#more") {
            return (
              <button
                key="more"
                type="button"
                aria-label="More navigation options"
                onClick={() => setSheetOpen(true)}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
                  sheetOpen
                    ? "text-[color:var(--monitor)]"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                <Icon className="size-5" />
                <span>{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-[color:var(--monitor)]"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {label === "Alerts" && effectiveAlerts != null && effectiveAlerts > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-threat text-[9px] font-bold text-white">
                    {effectiveAlerts > 9 ? "9+" : effectiveAlerts}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {active && (
                <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[color:var(--monitor)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* More drawer — overlays page, dismissible via tap outside or Escape */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="border-t border-white/10 bg-bg-void rounded-t-xl pb-8"
        >
          <SheetTitle className="sr-only">More navigation</SheetTitle>
          <div className="flex items-center justify-center pt-2 pb-4">
            <div className="h-1 w-10 rounded-full bg-slate-600" />
          </div>
          <div className="grid grid-cols-2 gap-3 px-2">
            {MORE_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSheetOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg p-4 transition-all duration-150",
                    active
                      ? "bg-monitor/10 text-[color:var(--monitor)] ring-1 ring-monitor/20"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
                  )}
                >
                  <Icon className="size-6" />
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
