import Link from "next/link";
import { Settings, Shield } from "lucide-react";

import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  email: string;
}

export const DashboardHeader = ({ email }: DashboardHeaderProps) => {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Shield className="size-5 text-blue-500" aria-hidden />
        <span className="text-sm font-bold">
          <span className="text-blue-500">MCP</span>Guardian
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        <Link
          href="/settings"
          className="flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 md:hidden"
        >
          <Settings className="size-5" />
          <span className="sr-only">Settings</span>
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {email}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
};
