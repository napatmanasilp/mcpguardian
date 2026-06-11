"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  FileText,
  LayoutDashboard,
  PanelRightClose,
  Radar,
  Server,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { UsageSidebarWidget } from "@/components/dashboard/usage-sidebar-widget";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "MONITOR",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity", label: "Activity", icon: Radar },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/telemetry", label: "Telemetry", icon: FileText },
    ],
  },
  {
    label: "PROTECT",
    items: [
      { href: "/servers", label: "Servers", icon: Server },
      { href: "/sessions", label: "Sessions", icon: Activity },
      { href: "/compliance", label: "Compliance", icon: Shield },
    ],
  },
  {
    label: "CONFIGURE",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface DashboardSidebarProps {
  unreadAlerts?: number;
}

export const DashboardSidebar = ({ unreadAlerts = 0 }: DashboardSidebarProps) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapse state + tablet auto-collapse
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && window.innerWidth >= 640) {
        setCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        const saved = localStorage.getItem("sidebar-collapsed");
        setCollapsed(saved === "true");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-bg-void transition-all duration-250 ease-out md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border transition-all",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="size-5 text-blue-500" aria-hidden />
            <span className="font-bold tracking-tight text-sidebar-foreground">
              MCP<span className="text-blue-500">Guardian</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <Shield className="size-5 text-blue-500" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            "rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors",
            collapsed && "absolute -right-3 top-6 z-10 bg-sidebar border border-sidebar-border rounded-full",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelRightClose className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation groups */}
      <nav className="flex flex-1 flex-col gap-2 p-3 overflow-y-auto">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            {groupIndex > 0 && <Separator className="bg-white/7 my-1" />}
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "border-l-2 border-blue-500 bg-blue-500/10 text-blue-400 rounded-r-md"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 transition-colors duration-150",
                        active ? "text-blue-400" : "text-slate-500",
                      )}
                      aria-hidden
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.href === "/alerts" && unreadAlerts > 0 && (
                          <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadAlerts > 9 ? "9+" : unreadAlerts}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <UsageSidebarWidget />

      {/* Active indicator dot */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md text-xs text-muted-foreground",
            collapsed ? "justify-center" : "px-3 py-2",
          )}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          {!collapsed && (
            <>
              <ShieldCheck className="size-3.5" aria-hidden />
              <span>MCPGuardian Active</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
