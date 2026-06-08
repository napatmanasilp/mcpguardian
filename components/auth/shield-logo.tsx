import Link from "next/link";
import { Shield } from "lucide-react";

interface ShieldLogoProps {
  href?: string;
}

export const ShieldLogo = ({ href = "/" }: ShieldLogoProps) => {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 font-semibold tracking-tight"
    >
      <Shield className="size-6 text-primary" aria-hidden />
      <span className="text-xl">ShieldMCP</span>
    </Link>
  );
};
