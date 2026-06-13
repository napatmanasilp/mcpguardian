import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description: string;
  cta?: { label: string; href: string };
}

function EmptyState({ icon: Icon, heading, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="size-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold">{heading}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {cta && (
        <Button className="mt-6" asChild>
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
