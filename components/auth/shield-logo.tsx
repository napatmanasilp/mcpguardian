import Link from "next/link";
import { Shield } from "lucide-react";

import { cn } from "@/lib/utils";

interface ShieldLogoProps {
  href?: string;
  className?: string;
}

export const ShieldLogo = ({ href = "/", className }: ShieldLogoProps) => {
  return (
    <Link
      href={href}
      className={cn("flex items-center justify-center gap-2 font-bold tracking-tight", className)}
    >
      <div className="relative">
        <Shield className="size-6 text-blue-500" aria-hidden />
      </div>
      <span className="text-xl">
        MCP<span className="text-blue-500">Guardian</span>
      </span>
    </Link>
  );
};
