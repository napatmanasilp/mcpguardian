import { redirect } from "next/navigation";

import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { createClient } from "@/lib/supabase/server";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, scans_this_month")
    .eq("id", user.id)
    .single();

  const showBanner = profile && profile.plan === "free" && profile.scans_this_month > 0;

  return (
    <div className="flex min-h-full flex-1">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader email={user.email ?? ""} />
        {showBanner && <UpgradeBanner scansThisMonth={profile.scans_this_month} />}
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
};

export default DashboardLayout;
