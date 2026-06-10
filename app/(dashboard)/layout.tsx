import { redirect } from "next/navigation";

import { TopUpModalProvider } from "@/components/billing/top-up-modal";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UsageProvider } from "@/components/providers/usage-provider";
import { createClient } from "@/lib/supabase/server";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { count: unreadAlerts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan, scans_this_month, checks_purchased")
      .eq("id", user.id)
      .single(),
    supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
  ]);

  // Show upgrade banner for free users who have used checks
  const showBanner = profile && profile.plan === "free" && (profile.scans_this_month ?? 0) > 0;

  return (
    <div className="flex min-h-full flex-1">
      <DashboardSidebar unreadAlerts={unreadAlerts ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader email={user.email ?? ""} />
        <UsageProvider>
          {showBanner && (
            <UpgradeBanner
              scansThisMonth={profile.scans_this_month}
              checksPurchased={profile.checks_purchased ?? 0}
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

export default DashboardLayout;
