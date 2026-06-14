import type { Metadata } from "next";

import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SocialProofSection } from "@/components/marketing/social-proof-section";

export const metadata: Metadata = {
  title: "MCPGuardian — MCP Server Security Scanner for AI Agents",
  description:
    "Scan MCP servers for vulnerabilities before your AI agents connect. Detect rug-pulls, CVEs, and tool poisoning. Get the exact fixed config to apply. Free for 50 scans/month.",
  alternates: {
    canonical: "https://mcpguardian.com",
  },
};

const HomePage = () => {
  return (
    <>
      <MarketingHeader />
      <main>
        <HeroSection />
        <SocialProofSection />
        <HowItWorksSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </>
  );
};

export default HomePage;
