import { lazy, Suspense } from "react";
import { HeroSection } from "@/components/landing/HeroSection";

// Lazy load sections below the fold for faster initial load
const CardCarousel = lazy(() => import("@/components/landing/CardCarousel").then(m => ({ default: m.CardCarousel })));
const WhyChekInn = lazy(() => import("@/components/landing/WhyChekInn").then(m => ({ default: m.WhyChekInn })));
const TrustSection = lazy(() => import("@/components/landing/TrustSection").then(m => ({ default: m.TrustSection })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const BetaCTA = lazy(() => import("@/components/landing/BetaCTA").then(m => ({ default: m.BetaCTA })));
const Testimonials = lazy(() => import("@/components/landing/Testimonials").then(m => ({ default: m.Testimonials })));
const PrivacySection = lazy(() => import("@/components/landing/PrivacySection").then(m => ({ default: m.PrivacySection })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then(m => ({ default: m.FinalCTA })));
const Footer = lazy(() => import("@/components/landing/Footer").then(m => ({ default: m.Footer })));

// Minimal loading placeholder
const SectionLoader = () => (
  <div className="min-h-[200px]" />
);

const Index = () => {
  return (
    <main className="min-h-screen">
      {/* Hero loads immediately */}
      <HeroSection />
      
      {/* Lazy load everything below the fold */}
      <Suspense fallback={<SectionLoader />}>
        <CardCarousel />
      </Suspense>
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
        <BetaCTA />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Testimonials />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <PrivacySection />
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
