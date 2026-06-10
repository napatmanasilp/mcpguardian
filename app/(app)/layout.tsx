import { redirect } from "next/navigation";

import { TopUpModalProvider } from "@/components/billing/top-up-modal";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UsageProvider } from "@/components/providers/usage-provider";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

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
    <div className="flex min-h-full flex-1">
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
          <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        </UsageProvider>
      </div>
      <MobileNav unreadAlerts={unreadAlerts ?? 0} />
      <TopUpModalProvider />
    </div>
  );
};

export default AppLayout;
