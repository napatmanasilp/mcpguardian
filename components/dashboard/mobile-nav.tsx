"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  FileText,
  Grid3X3,
  Key,
  LayoutDashboard,
  Radar,
  Server,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/servers", icon: Server, label: "Servers" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/sessions", icon: Activity, label: "Sessions" },
  { href: "#more", icon: Grid3X3, label: "More" },
];

const MORE_ITEMS = [
  { href: "/telemetry", icon: FileText, label: "Telemetry" },
  { href: "/compliance", icon: Shield, label: "Compliance" },
  { href: "/activity", icon: Radar, label: "Activity" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/settings/team", icon: Users, label: "Team" },
  { href: "/settings/api-keys", icon: Key, label: "API Keys" },
];

export function MobileNav({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "#more") return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-bg-void safe-area-pb md:hidden">
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);

          if (href === "#more") {
            return (
              <button
                key="more"
                type="button"
                onClick={() => setSheetOpen(true)}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
                  sheetOpen ? "text-blue-400" : "text-slate-500 hover:text-slate-300",
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
              className={cn(
                "relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
                active ? "text-blue-400" : "text-slate-500 hover:text-slate-300",
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {label === "Alerts" && unreadAlerts && unreadAlerts > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadAlerts > 9 ? "9+" : unreadAlerts}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {active && (
                <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* More drawer — 2x3 grid */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="border-t border-white/10 bg-bg-void rounded-t-xl pb-8">
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
                      ? "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
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
