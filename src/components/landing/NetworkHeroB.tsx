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

// Simple Profile Card - no phone mockup
const ProfileCard = ({ profile }: { profile: typeof profiles[0] }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={profile.id}
      className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden w-[280px] sm:w-[340px] md:w-[400px]"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.5 }}
    >
      {/* Photo */}
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
      {/* Name and title */}
      <div className="px-5 py-4 sm:px-6 sm:py-5 bg-white">
        <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{profile.name}</p>
        <p className="text-base sm:text-lg md:text-xl text-gray-500">{profile.title}</p>
      </div>
    </motion.div>
  </AnimatePresence>
);

// Profile Cards Display
const ProfileCardsDisplay = ({ currentIndex }: { currentIndex: number }) => {
  const currentProfile = profiles[currentIndex];

  return (
    <div className="flex justify-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <ProfileCard profile={currentProfile} />
      </motion.div>
      
      {/* Progress indicators */}
      <div className="absolute -bottom-12 sm:-bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
        {profiles.map((_, index) => (
          <motion.div
            key={index}
            className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? "w-4 sm:w-6 bg-gray-900" : "w-1.5 sm:w-2 bg-gray-300"
            }`}
          />
        ))}
      </div>
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

      {/* Main content - centered with better spacing */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container-apple relative z-10 py-8 sm:py-12 md:py-16 px-4 md:px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 md:gap-16 lg:gap-20 items-center">
          {/* Left column - Header with CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center lg:text-left order-2 lg:order-1 space-y-6 sm:space-y-8"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-medium text-foreground leading-tight mb-4 sm:mb-6 md:mb-8"
            >
              <span className="font-semibold">ChekInn knows everyone.</span>
              <br />
              <span className="font-normal text-muted-foreground">You talk. We connect.</span>
            </motion.h1>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col items-center lg:items-start gap-2 sm:gap-3 md:gap-4"
            >
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

          {/* Right column - Profile Cards */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="order-1 lg:order-2 relative pb-16 sm:pb-20"
          >
            <ProfileCardsDisplay currentIndex={currentIndex} />
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
