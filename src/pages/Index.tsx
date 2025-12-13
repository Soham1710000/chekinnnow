import { lazy, Suspense } from "react";
import { NetworkHero } from "@/components/landing/NetworkHero";

// Lazy load sections below the fold for faster initial load
const WhyChekInn = lazy(() => import("@/components/landing/WhyChekInn").then(m => ({ default: m.WhyChekInn })));
const TrustSection = lazy(() => import("@/components/landing/TrustSection").then(m => ({ default: m.TrustSection })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then(m => ({ default: m.FinalCTA })));
const Footer = lazy(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));

// Minimal loading placeholder
const SectionLoader = () => (
  <div className="min-h-[200px]" />
);

const Index = () => {
  return (
    <main className="min-h-screen">
      {/* Network Hero with CTA and scroll nudge */}
      <NetworkHero />
      
      {/* Lazy load everything below the fold */}
      <Suspense fallback={<SectionLoader />}>
        <WhyChekInn />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <TrustSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <FinalCTA />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </main>
  );
};

export default Index;
