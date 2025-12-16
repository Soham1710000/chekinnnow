import { lazy, Suspense, useEffect } from "react";
import { NetworkHeroB } from "@/components/landing/NetworkHeroB";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

// Lazy load sections below the fold for faster initial load
const WhyChekInn = lazy(() => import("@/components/landing/WhyChekInn").then(m => ({ default: m.WhyChekInn })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then(m => ({ default: m.FinalCTA })));
const Footer = lazy(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));

// Minimal loading placeholder
const SectionLoader = () => (
  <div className="min-h-[200px]" />
);

const IndexB = () => {
  const { trackPageView } = useFunnelTracking();

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  return (
    <main className="min-h-screen">
      {/* Network Hero B variant with simplified animation */}
      <NetworkHeroB />
      
      {/* Lazy load everything below the fold */}
      <Suspense fallback={<SectionLoader />}>
        <WhyChekInn />
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

export default IndexB;
