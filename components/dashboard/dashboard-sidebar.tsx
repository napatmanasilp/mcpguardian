"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  FileText,
  LayoutDashboard,
  Radar,
  Server,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";

import { UsageSidebarWidget } from "@/components/dashboard/usage-sidebar-widget";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/sessions", label: "Sessions", icon: Activity },
  { href: "/activity", label: "Activity", icon: Radar },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/telemetry", label: "Telemetry", icon: FileText },
  { href: "/compliance", label: "Compliance", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface DashboardSidebarProps {
  unreadAlerts?: number;
}

export const DashboardSidebar = ({ unreadAlerts = 0 }: DashboardSidebarProps) => {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-[hsl(222,47%,5%)] md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <Shield className="size-5 text-blue-500" aria-hidden />
        <span className="font-bold tracking-tight text-sidebar-foreground">
          MCP<span className="text-blue-500">Guardian</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-blue-500 bg-blue-500/10 text-blue-400 rounded-r-md"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded-md",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
              {item.href === "/alerts" && unreadAlerts > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {unreadAlerts > 9 ? "9+" : unreadAlerts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <UsageSidebarWidget />

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <ShieldCheck className="size-3.5" aria-hidden />
          <span>MCPGuardian Active</span>
        </div>
      </div>
    </aside>
  );
};
