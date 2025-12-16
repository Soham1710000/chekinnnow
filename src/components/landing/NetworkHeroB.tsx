import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

// Lazy load the modal - only needed on click
const WaitlistModal = lazy(() => import("@/components/waitlist/WaitlistModal").then(m => ({ default: m.WaitlistModal })));

// Import profile images
import kushalImg from "@/assets/profiles/kushal.jpg";
import rajatImg from "@/assets/profiles/rajat.jpg";
import siddharthImg from "@/assets/profiles/siddharth.jpg";
import ananyaImg from "@/assets/profiles/ananya.jpg";
import rheaImg from "@/assets/profiles/rhea.jpg";
import devImg from "@/assets/profiles/dev.jpg";
import ishaanImg from "@/assets/profiles/ishaan.jpg";

// Preload images with requestIdleCallback for non-blocking load
const allImages = [kushalImg, rajatImg, siddharthImg, ananyaImg, rheaImg, devImg, ishaanImg];

const usePreloadImages = (images: string[]) => {
  useEffect(() => {
    // Preload first 2 profiles immediately (visible on load)
    const criticalImages = images.slice(0, 4);
    criticalImages.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    
    // Defer remaining images to idle time
    const remaining = images.slice(4);
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        remaining.forEach((src) => {
          const img = new Image();
          img.src = src;
        });
      });
    } else {
      // Fallback: load after 2 seconds
      setTimeout(() => {
        remaining.forEach((src) => {
          const img = new Image();
          img.src = src;
        });
      }, 2000);
    }
  }, []);
};

// Sample profile data - simplified for B variant
const profiles = [
  {
    id: 1,
    name: "Rajat",
    title: "2x Mains Cleared UPSC",
    image: rajatImg,
  },
  {
    id: 2,
    name: "Ananya",
    title: "HR at Microsoft",
    image: ananyaImg,
  },
  {
    id: 3,
    name: "Kushal",
    title: "CAT 99.99 Percentile",
    image: kushalImg,
  },
  {
    id: 4,
    name: "Siddharth",
    title: "Senior Data Analyst at Flipkart",
    image: siddharthImg,
  },
  {
    id: 5,
    name: "Dev",
    title: "Investor",
    image: devImg,
  },
  {
    id: 6,
    name: "Rhea",
    title: "Senior Product Manager at Google",
    image: rheaImg,
  },
  {
    id: 7,
    name: "Ishaan",
    title: "Strategy at Uber",
    image: ishaanImg,
  }
];

// Simplified Floating Profile Card - only photo, name, title
const FloatingProfileCard = ({ profile }: { profile: typeof profiles[0] }) => (
  <motion.div
    className="absolute -left-6 sm:-left-10 md:-left-28 -top-4 sm:-top-2 md:top-4 z-30 w-[200px] sm:w-[240px] md:w-[300px]"
    animate={{ y: [0, -6, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={profile.id}
        className="bg-white rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl border border-gray-100 overflow-hidden"
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ duration: 0.5 }}
      >
        {/* Photo - larger */}
        <div className="aspect-[4/3] relative overflow-hidden bg-gray-100">
          <img 
            src={profile.image} 
            alt={profile.name}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-cover object-top"
          />
        </div>
        {/* Name and title - compact inline */}
        <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 bg-white">
          <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">{profile.name}</p>
          <p className="text-xs sm:text-sm md:text-base text-gray-500">{profile.title}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.div>
);

// Half iPhone Mockup - simplified without reply
const IPhoneMockup = ({ currentIndex }: { currentIndex: number }) => {
  const currentProfile = profiles[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative mx-auto"
    >
      {/* Floating profile card */}
      <FloatingProfileCard profile={currentProfile} />

      {/* Half iPhone frame - cut off at bottom */}
      <div className="relative w-[220px] sm:w-[280px] md:w-[380px] h-[320px] sm:h-[400px] md:h-[560px] overflow-hidden">
        {/* Phone frame - extended beyond container so bottom is hidden */}
        <div className="absolute inset-x-0 top-0 h-[420px] sm:h-[520px] md:h-[700px] bg-white rounded-t-[28px] sm:rounded-t-[36px] md:rounded-t-[50px] border-[6px] sm:border-[7px] md:border-[10px] border-b-0 border-gray-900 shadow-xl sm:shadow-2xl overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-1 sm:top-1.5 md:top-2 left-1/2 -translate-x-1/2 w-12 sm:w-16 md:w-24 h-3 sm:h-4 md:h-6 bg-gray-900 rounded-full z-20" />
          
          {/* Screen content */}
          <div className="absolute inset-0 pt-6 sm:pt-8 md:pt-12 bg-gradient-to-b from-gray-50 to-white flex flex-col">
            {/* ChekInn header */}
            <div className="px-3 sm:px-4 py-1 sm:py-1.5 md:py-2 border-b border-gray-100">
              <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 text-center">ChekInn</p>
            </div>

            {/* Empty content area */}
            <div className="flex-1" />
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex justify-center gap-1 sm:gap-1.5 md:gap-2 mt-2 sm:mt-3 md:mt-4">
        {profiles.map((_, index) => (
          <motion.div
            key={index}
            className={`h-0.5 sm:h-1 md:h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? "w-3 sm:w-4 md:w-6 bg-gray-900" : "w-0.5 sm:w-1 md:w-1.5 bg-gray-300"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

const NetworkVisualization = ({ currentIndex }: { currentIndex: number }) => {
  return (
    <div className="relative w-full flex justify-center pl-4 sm:pl-8 md:pl-16">
      <IPhoneMockup currentIndex={currentIndex} />
    </div>
  );
};

const BASE_WAITLIST_COUNT = 7912; // Base offset for display

export const NetworkHeroB = () => {
  // Preload all images on mount for instant switching
  usePreloadImages(allImages);
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState<number>(BASE_WAITLIST_COUNT);
  const referralCode = searchParams.get("ref");
  const { trackEvent } = useFunnelTracking();

  const handleCTAClick = () => {
    trackEvent("cta_click", { source: "hero_b", referral: referralCode });
    navigate("/chat");
  };

  // Fetch waitlist count and subscribe to real-time updates
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true });
      setWaitlistCount(BASE_WAITLIST_COUNT + (count ?? 0));
    };
    
    fetchCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('waitlist-count')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waitlist' },
        () => {
          setWaitlistCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Store referral code silently
  useEffect(() => {
    if (referralCode) {
      sessionStorage.setItem("waitlist_ref", referralCode);
    }
  }, [referralCode]);

  // Cycle through profiles
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % profiles.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Logo items for the marquee
  const logoItems = (
    <>
      <div className="flex items-center">
        <span className="text-sm font-medium" style={{ color: '#4285F4' }}>G</span>
        <span className="text-sm font-medium" style={{ color: '#EA4335' }}>o</span>
        <span className="text-sm font-medium" style={{ color: '#FBBC05' }}>o</span>
        <span className="text-sm font-medium" style={{ color: '#4285F4' }}>g</span>
        <span className="text-sm font-medium" style={{ color: '#34A853' }}>l</span>
        <span className="text-sm font-medium" style={{ color: '#EA4335' }}>e</span>
      </div>
      <span className="text-sm font-bold text-[#E50914] tracking-tight">NETFLIX</span>
      <span className="text-sm font-bold text-gray-800 tracking-tight">BCG</span>
      <span className="text-sm font-bold text-[#8C1515] tracking-tight">Stanford</span>
      <span className="text-sm font-bold text-[#00A1E0] tracking-tight">Salesforce</span>
      <span className="text-xs font-semibold text-gray-700 tracking-tight">Tier 1 VCs</span>
      <span className="text-sm font-black text-gray-800 tracking-tight">CRED</span>
      <span className="text-sm font-bold text-[#A31F34] tracking-tight">MIT</span>
      <span className="text-sm font-bold text-gray-800 italic">flipkart</span>
      <span className="text-sm font-bold text-[#00356B] tracking-tight">Yale</span>
      <span className="text-sm font-bold text-gray-800 tracking-tight">McKinsey</span>
      <span className="text-xs font-bold text-gray-800 tracking-tight">IIT Delhi</span>
      <span className="text-sm font-bold text-[#0077B5] tracking-tight">LinkedIn</span>
      <span className="text-sm font-bold text-[#1DB954] tracking-tight">Spotify</span>
    </>
  );

  return (
    <section className="relative min-h-[100svh] bg-white overflow-hidden flex flex-col">
      {/* Top scrolling logo marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full py-2.5 bg-gray-50/80 border-b border-gray-100 overflow-hidden"
      >
        <div className="relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Users are from</span>
            <span className="text-gray-300">•</span>
            {logoItems}
          </div>
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Users are from</span>
            <span className="text-gray-300">•</span>
            {logoItems}
          </div>
        </div>
      </motion.div>

      {/* Main content - flex grow to fill remaining space */}
      <div className="flex-1 flex items-end">
        <div className="container-apple relative z-10 py-6 sm:py-8 md:py-12 pb-8 sm:pb-12 md:pb-16 px-4 md:px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 lg:gap-8 items-end">
          {/* Left column - Header with CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center lg:text-left order-2 lg:order-1"
          >
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-medium text-foreground leading-tight mb-6 sm:mb-8 md:mb-10"
            >
              <span className="font-semibold">ChekInn knows everyone.</span>
              <br />
              <span className="font-normal text-muted-foreground">You just talk. We figure out who can help.</span>
            </motion.h1>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col items-center lg:items-start gap-2 sm:gap-3 md:gap-4"
            >
              {/* Urgency badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-amber-200"
              >
                <span className="text-amber-500">⚡</span>
                Only 12 spots left this week
              </motion.div>

              <div className="flex flex-col items-center lg:items-start gap-2 sm:gap-3 w-full">
                <motion.div
                  animate={{ 
                    boxShadow: [
                      "0 0 0 0 rgba(0, 0, 0, 0.4)",
                      "0 0 0 12px rgba(0, 0, 0, 0)",
                      "0 0 0 0 rgba(0, 0, 0, 0)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  className="rounded-full"
                >
                  <Button 
                    className="bg-gray-900 text-white border-0 px-8 sm:px-10 md:px-12 py-6 sm:py-7 md:py-8 text-lg sm:text-xl md:text-2xl font-bold rounded-full hover:bg-gray-800 hover:scale-[1.03] active:scale-[0.98] transition-all shadow-2xl hover:shadow-3xl w-full sm:w-auto"
                    onClick={handleCTAClick}
                  >
                    Let's start →
                  </Button>
                </motion.div>
                
                {/* Waitlist counter with live indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center lg:justify-start gap-2 text-gray-500 w-full"
                >
                  {/* Pulsing live dot */}
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="text-[11px] sm:text-xs md:text-sm font-medium">
                    {waitlistCount.toLocaleString()}+ people in beta
                  </span>
                </motion.div>
              </div>
              
            </motion.div>
          </motion.div>

          {/* Right column - Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="order-1 lg:order-2"
          >
            <NetworkVisualization currentIndex={currentIndex} />
          </motion.div>
        </div>
      </div>
    </div>

      {/* Waitlist Modal - lazy loaded */}
      {isModalOpen && (
        <Suspense fallback={null}>
          <WaitlistModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            referralCode={referralCode}
          />
        </Suspense>
      )}
    </section>
  );
};
