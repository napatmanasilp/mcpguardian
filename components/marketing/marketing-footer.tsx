import Link from "next/link";
import { Shield } from "lucide-react";

import { Separator } from "@/components/ui/separator";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
  ],
  Compliance: [
    {
      label: "OWASP MCP Top 10",
      href: "https://owasp.org/www-project-mcp-top-10/",
      external: true,
    },
    {
      label: "OWASP Agentic AI",
      href: "https://genai.owasp.org/",
      external: true,
    },
    {
      label: "NSA MCP Guidance",
      href: "https://www.nsa.gov/",
      external: true,
    },
    { label: "CVE Database", href: "/dashboard" },
  ],
};

export const MarketingFooter = () => {
  return (
    <footer className="bg-[hsl(222,47%,4%)]">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold">
              <Shield className="size-5 text-blue-500" aria-hidden />
              <span>
                MCP<span className="text-blue-500">Guardian</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              Security scanning and continuous monitoring for MCP server
              configurations.
            </p>
          </div>

          {/* Link groups */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-sm font-semibold text-slate-200">{group}</p>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-slate-400 transition-colors hover:text-slate-200"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8 bg-white/10" />

        {/* Bottom bar */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>🛡 10/10 OWASP MCP Categories Covered</span>
          </div>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} MCPGuardian. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
