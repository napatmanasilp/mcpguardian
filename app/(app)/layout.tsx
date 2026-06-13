import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { NavProgressBar } from "@/components/dashboard/nav-progress-bar";
import { UsageProvider } from "@/components/providers/usage-provider";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// Code-split: TopUpModal is a heavy client component (billing dialog with stripe logic)
// that is not needed on initial render — only shown when user explicitly requests it.
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
const TopUpModalProvider = dynamic(
  () =>
    import("@/components/billing/top-up-modal").then(
      (mod) => mod.TopUpModalProvider,
    ),
);

/**
 * App Shell Layout
 *
 * Requirement 20.3: The shell (sidebar + header) renders without waiting for
 * page-level data fetches. This layout only fetches lightweight auth/org context
 * needed for the shell itself. Page content streams in asynchronously via
 * Next.js App Router streaming (each page's loading.tsx shows skeletons while
 * its server component fetches page-specific data).
 */
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const svc = createServiceClient();

  // Fetch org context (organization_members → organizations)
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  let plan = "free";
  let scansThisMonth = 0;
  let checksPurchased = 0;
  let proxyFirstConnected: string | null = null;

  if (membership) {
    const { data: org } = await svc
      .from("organizations")
      .select("plan_id, scans_used_this_period, proxy_first_connected_at")
      .eq("id", membership.organization_id)
      .single();

    if (org) {
      plan = org.plan_id ?? "free";
      scansThisMonth = org.scans_used_this_period ?? 0;
      proxyFirstConnected = org.proxy_first_connected_at;
    }
  }

  // Fetch unread alerts
  const { count: unreadAlerts } = await svc
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", membership?.organization_id ?? "")
    .eq("read", false);

  const showBanner = plan === "free" && scansThisMonth > 0;

  return (
    <RealtimeProvider
      organizationId={membership?.organization_id ?? ""}
      initialAlertCount={unreadAlerts ?? 0}
    >
      <div className="flex min-h-full flex-1">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <NavProgressBar />
        <DashboardSidebar unreadAlerts={unreadAlerts ?? 0} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader email={user.email ?? ""} />
          <UsageProvider>
            {showBanner && (
              <UpgradeBanner
                scansThisMonth={scansThisMonth}
                checksPurchased={checksPurchased}
              />
            )}
            <div
              id="main-content"
              className="flex flex-1 flex-col pb-16 md:pb-0 animate-page-fade-in"
            >
              {children}
            </div>
          </UsageProvider>
        </div>
        <MobileNav unreadAlerts={unreadAlerts ?? 0} />
        <TopUpModalProvider />
      </div>
    </RealtimeProvider>
  );
};

export default AppLayout;
