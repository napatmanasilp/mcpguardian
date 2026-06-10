"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  LayoutDashboard,
  Server,
  Shield,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/servers", icon: Server, label: "Servers" },
  { href: "/sessions", icon: Activity, label: "Sessions" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/activity", icon: Shield, label: "Activity" },
];

export function MobileNav({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-[hsl(222,47%,5%)] safe-area-pb md:hidden">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive =
          pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(href));

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-blue-400" : "text-slate-500 hover:text-slate-300",
            )}
          >
            <div className="relative">
              <Icon className="size-5" />
              {label === "Alerts" && unreadAlerts > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </span>
              )}
            </div>
            <span>{label}</span>
            {isActive && (
              <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
