import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  email: string;
}

export const DashboardHeader = ({ email }: DashboardHeaderProps) => {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <p className="text-sm text-muted-foreground md:hidden">ShieldMCP</p>

      <div className="ml-auto flex items-center gap-4">
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
