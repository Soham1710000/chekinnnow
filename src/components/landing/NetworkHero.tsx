import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useLayoutEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

// Lazy load the modal - only needed on click
const WaitlistModal = lazy(() => import("@/components/waitlist/WaitlistModal").then(m => ({ default: m.WaitlistModal })));
// Import profile images
import arnavImg from "@/assets/profiles/arnav.jpg";
import meeraImg from "@/assets/profiles/meera.jpg";
import kushalImg from "@/assets/profiles/kushal.jpg";
import rajatImg from "@/assets/profiles/rajat.jpg";
import siddharthImg from "@/assets/profiles/siddharth.jpg";
import ananyaImg from "@/assets/profiles/ananya.jpg";
import rheaImg from "@/assets/profiles/rhea.jpg";
import devImg from "@/assets/profiles/dev.jpg";
import ishaanImg from "@/assets/profiles/ishaan.jpg";
import pallaviImg from "@/assets/profiles/pallavi.jpg";
import aaravImg from "@/assets/profiles/aarav.jpg";
import nishaImg from "@/assets/profiles/nisha.jpg";

// Preload all profile images for instant switching
const allImages = [arnavImg, meeraImg, kushalImg, rajatImg, siddharthImg, ananyaImg, rheaImg, devImg, ishaanImg, pallaviImg, aaravImg, nishaImg];

const usePreloadImages = (images: string[]) => {
  useLayoutEffect(() => {
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);
};

// Sample profile data that cycles through
const profiles = [
  {
    id: 1,
    name: "Arnav",
    title: "Robotics Student",
    bio: "Working on a **robotics project** and exploring **US research paths**.",
    image: arnavImg,
    replyName: "Dr. Meera Iyer",
    replyTitle: "Research Faculty",
    replyImage: meeraImg,
    reply: "Sounds interesting. Happy to talk."
  },
  {
    id: 2,
    name: "Kushal",
    title: "Founder",
    bio: "I'm building in **quick commerce** and testing **unit economics**.",
    image: kushalImg,
    replyName: "Rajat",
    replyTitle: "Angel Investor",
    replyImage: rajatImg,
    reply: "I've spent time studying this sector."
  },
  {
    id: 3,
    name: "Siddharth",
    title: "College Student",
    bio: "Built **side projects**, trying to break into **gaming** as an SDE.",
    image: siddharthImg,
    replyName: "Ananya",
    replyTitle: "Talent Lead, Gaming Startup",
    replyImage: ananyaImg,
    reply: "That's understandable. Happy to chat."
  },
  {
    id: 4,
    name: "Rhea",
    title: "College Student",
    bio: "I play **indie games** a lot. Not sure what comes **after college**.",
    image: rheaImg,
    replyName: "Dev",
    replyTitle: "Game Studio Team",
    replyImage: devImg,
    reply: "We are looking for beta testers in the team."
  },
  {
    id: 5,
    name: "Ishaan",
    title: "Growth Marketer",
    bio: "Curious how **brand marketing** works at different stages.",
    image: ishaanImg,
    replyName: "Pallavi",
    replyTitle: "Brand Marketer",
    replyImage: pallaviImg,
    reply: "Happy to share notes."
  },
  {
    id: 6,
    name: "Aarav",
    title: "Early Career",
    bio: "I've been trying to meet people who enjoy **long runs**.",
    image: aaravImg,
    replyName: "Nisha",
    replyTitle: "Working Professional",
    replyImage: nishaImg,
    reply: "That sounds like my kind of thing. When?"
  }
];

// Helper to render text with **bold** markers
const renderBoldText = (text: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, index) => 
    index % 2 === 1 ? <strong key={index} className="font-bold">{part}</strong> : part
  );
};

// Floating Profile Card with attached message
const FloatingProfileCard = ({ profile }: { profile: typeof profiles[0] }) => (
  <motion.div
    className="absolute -left-2 sm:-left-4 md:-left-20 top-4 sm:top-8 md:top-16 z-30 w-[120px] sm:w-[140px] md:w-[200px]"
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
        {/* Photo - smaller */}
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
        <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2.5 md:py-1.5 bg-white border-b border-gray-100 flex items-center gap-1">
          <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-gray-900">{profile.name}</p>
          <span className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-400">•</span>
          <p className="text-[7px] sm:text-[8px] md:text-[10px] text-gray-500 truncate">{profile.title}</p>
        </div>
        {/* Attached text message - more space */}
        <div className="p-2 sm:p-2.5 md:p-3 bg-[#E9E9EB]">
          <p className="text-gray-900 text-[9px] sm:text-[10px] md:text-xs font-normal leading-relaxed line-clamp-3 sm:line-clamp-4">
            "{renderBoldText(profile.bio)}"
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.div>
);

// Half iPhone Mockup with cycling content
const IPhoneMockup = ({ currentIndex }: { currentIndex: number }) => {
  const currentProfile = profiles[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative mx-auto"
    >
      {/* Floating profile card - 30% outside, 70% overlapping phone */}
      <FloatingProfileCard profile={currentProfile} />

      {/* Half iPhone frame - cut off at bottom */}
      <div className="relative w-[180px] sm:w-[220px] md:w-[320px] h-[260px] sm:h-[320px] md:h-[480px] overflow-hidden">
        {/* Phone frame - extended beyond container so bottom is hidden */}
        <div className="absolute inset-x-0 top-0 h-[340px] sm:h-[420px] md:h-[600px] bg-white rounded-t-[24px] sm:rounded-t-[32px] md:rounded-t-[45px] border-[5px] sm:border-[6px] md:border-[8px] border-b-0 border-gray-900 shadow-xl sm:shadow-2xl overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-1 sm:top-1.5 md:top-2 left-1/2 -translate-x-1/2 w-12 sm:w-16 md:w-24 h-3 sm:h-4 md:h-6 bg-gray-900 rounded-full z-20" />
          
          {/* Screen content */}
          <div className="absolute inset-0 pt-6 sm:pt-8 md:pt-12 bg-gradient-to-b from-gray-50 to-white flex flex-col">
            {/* ChekInn header */}
            <div className="px-3 sm:px-4 py-1 sm:py-1.5 md:py-2 border-b border-gray-100">
              <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 text-center">ChekInn</p>
            </div>

            {/* Spacer to push reply to bottom */}
            <div className="flex-1" />

            {/* Reply message with profile */}
            <div className="px-2 sm:px-3 md:px-4 mt-auto mb-20 sm:mb-28 md:mb-40">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`reply-${currentProfile.id}`}
                  className="flex flex-col items-end gap-1 sm:gap-1.5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  {/* Reply profile name, title and photo */}
                  <div className="flex items-center gap-1.5 sm:gap-2 mr-0.5 sm:mr-1">
                    <div className="text-right">
                      <p className="text-[10px] sm:text-[11px] md:text-sm text-gray-900 font-semibold">{currentProfile.replyName}</p>
                      <p className="text-[8px] sm:text-[9px] md:text-xs text-gray-500 font-medium">{currentProfile.replyTitle}</p>
                    </div>
                    <img 
                      src={currentProfile.replyImage} 
                      alt={currentProfile.replyName}
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 rounded-full object-cover object-top border-2 border-gray-200 shadow-sm"
                    />
                  </div>
                  {/* Message bubble */}
                  <div className="bg-[#007AFF] text-white rounded-xl sm:rounded-2xl rounded-br-sm sm:rounded-br-md px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2">
                    <p className="text-[10px] sm:text-xs md:text-sm font-medium">{currentProfile.reply}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
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

export const NetworkHero = () => {
  // Preload all images on mount for instant switching
  usePreloadImages(allImages);
  
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState<number>(BASE_WAITLIST_COUNT);
  const referralCode = searchParams.get("ref");
  const { trackEvent } = useFunnelTracking();

  const handleCTAClick = () => {
    trackEvent("cta_click", { source: "hero", referral: referralCode });
    setIsModalOpen(true);
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

  return (
    <section className="relative min-h-[100svh] bg-white overflow-hidden flex items-center">
      <div className="container-apple relative z-10 py-6 sm:py-12 md:py-20 pb-20 sm:pb-20 md:pb-28 px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-8 md:gap-12 lg:gap-8 items-center">
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
              className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight mb-2 sm:mb-3 md:mb-4"
            >
              When you don't know who to reach out to, we make the introduction.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-gray-600 mb-4 sm:mb-6 md:mb-8"
            >
              An AI social network for context-first introductions
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col items-center lg:items-start gap-4 sm:gap-6 md:gap-8"
            >
              <div className="flex flex-col items-center lg:items-start gap-2 sm:gap-3 w-full">
                <Button 
                  className="bg-gray-900 text-white border-0 px-6 sm:px-6 md:px-8 py-5 sm:py-5 md:py-6 text-base sm:text-base md:text-lg font-semibold rounded-full hover:bg-gray-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg hover:shadow-xl w-full sm:w-auto"
                  onClick={handleCTAClick}
                >
                  Join Now
                </Button>
                
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

      {/* Bottom section with scroll + logos */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-1 sm:bottom-2 md:bottom-4 left-0 right-0 flex flex-col items-center gap-1 sm:gap-2 md:gap-4 px-3 sm:px-4"
      >
        {/* Scroll indicator - visible on all screens */}
        <motion.button
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
          className="flex flex-col items-center gap-0.5 sm:gap-1 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <span className="text-[10px] sm:text-xs font-medium tracking-wider uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.div>
        </motion.button>

        {/* Waitlisted users logos - highlighted */}
        <div className="flex flex-col items-center gap-1.5 sm:gap-2 bg-gray-50/80 backdrop-blur-sm px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-100 w-full sm:w-auto">
          <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 uppercase tracking-wider font-semibold">
            Waitlisted users are from
          </p>
          <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-5 flex-wrap">
            {/* Google */}
            <div className="flex items-center">
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#4285F4' }}>G</span>
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#EA4335' }}>o</span>
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#FBBC05' }}>o</span>
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#4285F4' }}>g</span>
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#34A853' }}>l</span>
              <span className="text-xs sm:text-sm md:text-base font-medium" style={{ color: '#EA4335' }}>e</span>
            </div>
            {/* Netflix */}
            <span className="text-xs sm:text-sm md:text-base font-bold text-[#E50914] tracking-tight">NETFLIX</span>
            {/* BCG */}
            <span className="text-xs sm:text-sm md:text-base font-bold text-gray-800 tracking-tight">BCG</span>
            {/* Stanford */}
            <span className="text-xs sm:text-sm md:text-base font-bold text-[#8C1515] tracking-tight">Stanford</span>
            {/* Tier 1 VC */}
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 tracking-tight">Tier 1 VCs</span>
            {/* CRED */}
            <span className="text-xs sm:text-sm md:text-base font-black text-gray-800 tracking-tight hidden sm:inline">CRED</span>
            {/* Flipkart */}
            <span className="text-xs sm:text-sm md:text-base font-bold text-gray-800 italic hidden sm:inline">flipkart</span>
            {/* IIT Delhi */}
            <span className="text-[10px] sm:text-xs md:text-sm font-bold text-gray-800 tracking-tight hidden md:inline">IIT Delhi</span>
          </div>
        </div>
      </motion.div>

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
