"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  Key,
  LayoutDashboard,
  PanelRightClose,
  Radar,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  CreditCard,
  Sliders,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UsageSidebarWidget } from "@/components/dashboard/usage-sidebar-widget";
import { useRealtime } from "@/components/providers/realtime-provider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  subItems?: { href: string; label: string; icon: typeof LayoutDashboard }[];
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "MONITOR",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/servers", label: "Servers", icon: Server },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "CONFIGURE",
    items: [
      {
        href: "/settings/general",
        label: "Settings",
        icon: Settings,
        subItems: [
          { href: "/settings/general", label: "General", icon: Sliders },
          { href: "/settings/billing", label: "Billing", icon: CreditCard },
          { href: "/settings/team", label: "Team", icon: Users },
          { href: "/settings/api-keys", label: "API Keys", icon: Key },
        ],
      },
    ],
  },
];

interface DashboardSidebarProps {
  unreadAlerts?: number;
}

export const DashboardSidebar = ({ unreadAlerts = 0 }: DashboardSidebarProps) => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  // Use realtime alert count if available; fall back to server-provided prop
  const realtime = useRealtime();
  const effectiveAlerts = realtime.alertCount > 0 ? realtime.alertCount : unreadAlerts;

  // Auto-expand settings when on a settings page
  useEffect(() => {
    if (pathname.startsWith("/settings")) {
      setSettingsExpanded(true);
    }
  }, [pathname]);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  // Auto-collapse between 768px–1024px, hidden below 768px (handled via CSS)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setCollapsed(true);
      } else if (width >= 1024) {
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
    if (href === "/settings/general") return pathname.startsWith("/settings");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isSettingsSubActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const formatBadge = (count: number): string => {
    if (count > 99) return "99+";
    return String(count);
  };

  const renderNavLink = (item: NavItem, isSubItem = false) => {
    const active = isSubItem ? isSettingsSubActive(item.href) : isActive(item.href);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSettings = hasSubItems;

    const linkContent = (
      <Link
        href={item.href}
        onClick={
          isSettings && !collapsed
            ? (e) => {
                if (!settingsExpanded) {
                  e.preventDefault();
                  setSettingsExpanded(true);
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
          active
            ? "border-l-2 bg-[color:hsl(217_91%_60%/0.1)] text-[color:var(--monitor)] rounded-l-none"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
          active && "border-l-[color:var(--monitor)]",
          collapsed && "justify-center px-2",
          isSubItem && !collapsed && "pl-10 py-1.5 text-xs",
        )}
      >
        <item.icon
          className={cn(
            "size-4 shrink-0 transition-colors duration-150",
            active ? "text-[color:var(--monitor)]" : "text-slate-500",
            isSubItem && "size-3.5",
          )}
          aria-hidden
        />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === "/alerts" && effectiveAlerts > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-[color:var(--threat)] px-1.5 text-[10px] font-bold text-white">
                {formatBadge(effectiveAlerts)}
              </span>
            )}
            {isSettings && (
              <ChevronDown
                className={cn(
                  "size-3.5 text-slate-500 transition-transform duration-200",
                  settingsExpanded && "rotate-180",
                )}
                aria-hidden
              />
            )}
          </>
        )}
      </Link>
    );

    // In collapsed mode, show tooltip and dot indicator for alerts
    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <div className="relative">
              {linkContent}
              {item.href === "/alerts" && effectiveAlerts > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[color:var(--threat)]"
                  aria-label={`${effectiveAlerts} unread alerts`}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
            {item.href === "/alerts" && effectiveAlerts > 0 && (
              <span className="ml-1.5 text-[color:var(--threat)]">
                ({formatBadge(effectiveAlerts)})
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-bg-void transition-all duration-250 ease-out md:flex max-md:hidden",
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
            <Shield className="size-5 text-[color:var(--monitor)]" aria-hidden />
            <span className="font-bold tracking-tight text-sidebar-foreground">
              MCP<span className="text-[color:var(--monitor)]">Guardian</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <Shield className="size-5 text-[color:var(--monitor)]" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className={cn(
            "rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors",
            collapsed &&
              "absolute -right-3 top-6 z-10 bg-sidebar border border-sidebar-border rounded-full",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelRightClose
            className={cn("size-4 transition-transform", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation groups */}
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-2 p-3 overflow-y-auto">
        <TooltipProvider delayDuration={300}>
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && <Separator className="bg-white/7 my-1" />}
              {!collapsed && (
                <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <div key={item.href}>
                    {renderNavLink(item)}
                    {/* Settings sub-links */}
                    {item.subItems &&
                      settingsExpanded &&
                      !collapsed &&
                      item.subItems.map((subItem) => renderNavLink(subItem, true))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TooltipProvider>
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
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-secure opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-secure" />
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
