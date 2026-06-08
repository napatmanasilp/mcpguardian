import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PricingSection } from "@/components/marketing/pricing-section";
import { SocialProofSection } from "@/components/marketing/social-proof-section";

const HomePage = () => {
  return (
    <>
      <MarketingHeader />
      <main>
        <HeroSection />
        <SocialProofSection />
        <FeaturesSection />
        <PricingSection />
      </main>
      <MarketingFooter />
    </>
  );
};

export default HomePage;
