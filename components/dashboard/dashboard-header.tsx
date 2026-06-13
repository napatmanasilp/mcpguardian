import Link from "next/link";
import { Settings, Shield, User } from "lucide-react";

import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  email: string;
}

export const DashboardHeader = ({ email }: DashboardHeaderProps) => {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Shield className="size-5 text-blue-500" aria-hidden />
        <span className="text-sm font-bold">
          <span className="text-blue-500">MCP</span>Guardian
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {/* Desktop: show email and logout button */}
        <span className="hidden md:inline text-sm text-muted-foreground">
          {email}
        </span>
        <form action={signOut} className="hidden md:block">
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>

        {/* Mobile (<768px): avatar dropdown with email and actions */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-slate-300 transition-colors hover:bg-white/20"
                aria-label="User menu"
              >
                <User className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action={signOut} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2 text-left">
                    Log out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
