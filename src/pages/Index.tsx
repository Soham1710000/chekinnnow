import { HeroSection } from "@/components/landing/HeroSection";
import { CardCarousel } from "@/components/landing/CardCarousel";
import { WhyChekInn } from "@/components/landing/WhyChekInn";
import { TrustSection } from "@/components/landing/TrustSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { BetaCTA } from "@/components/landing/BetaCTA";
import { Testimonials } from "@/components/landing/Testimonials";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <CardCarousel />
      <WhyChekInn />
      <TrustSection />
      <HowItWorks />
      <BetaCTA />
      <Testimonials />
      <PrivacySection />
      <FinalCTA />
      <Footer />
    </main>
  );
};

export default Index;
