import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MCPGuardian — MCP Server Security Scanner for AI Agents",
  description:
    "Scan MCP servers for vulnerabilities before your AI agents connect. Detect rug-pulls, CVEs, and tool poisoning. Get the exact fixed config. Free for 50 scans/month.",
  keywords: [
    "MCP security",
    "MCP scanner",
    "MCP server security",
    "AI agent security",
    "Model Context Protocol",
    "MCP vulnerability scanner",
    "rug pull detection",
    "tool poisoning",
    "OWASP MCP",
    "NSA MCP CSI",
  ],
  openGraph: {
    siteName: "MCPGuardian",
    type: "website",
    title: "MCPGuardian — Scan & Protect Every MCP Server Your AI Agents Use",
    description:
      "Security scanner and runtime proxy for MCP servers. Scans your config, tells you what's unsafe, gives you the fix, and blocks attacks. Free tier available.",
    url: "https://mcpguardian.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "MCPGuardian — MCP Server Security for AI Agents",
    description: "Scan MCP servers for vulnerabilities. Get the exact fixed config. Block attacks at runtime.",
  },
  alternates: {
    canonical: "https://mcpguardian.com",
  },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
};

export default RootLayout;
