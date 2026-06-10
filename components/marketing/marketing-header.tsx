"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MarketingHeader = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-background/80 backdrop-blur-md transition-colors",
        scrolled ? "border-b border-white/10" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Shield className="size-5 text-blue-500" aria-hidden />
          <span>
            MCP<span className="text-blue-500">Guardian</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          <a href="#features" className="transition-colors hover:text-slate-200">
            Features
          </a>
          <Link href="/pricing" className="transition-colors hover:text-slate-200">
            Pricing
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-slate-200">
            CVE Database
          </Link>
          <a
            href="/api/mcp-server"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-slate-200"
          >
            MCP Tool
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button size="sm" className="shadow-lg shadow-blue-500/20" asChild>
            <Link href="/scan">Start Free Scan</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
