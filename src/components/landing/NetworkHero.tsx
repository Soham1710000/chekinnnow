import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { WaitlistModal } from "@/components/waitlist/WaitlistModal";

// Sample profile data that cycles through
const profiles = [
  {
    id: 1,
    name: "Rohan Verma",
    title: "Engineer",
    bio: "I'm moving from engineering into UI roles.\nI've built projects but don't know who to talk to without cold DMs.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face",
    reply: "I made the same switch. Happy to help.",
    replyFrom: "Riya Mehta — Product Designer",
    reason: "Both are navigating a career transition"
  },
  {
    id: 2,
    name: "Amit Jain",
    title: "Angel Investor",
    bio: "I'm exploring AI concierge apps.\nI care more about real usage than pitch decks.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&crop=face",
    reply: "We see strong early usage.",
    replyFrom: "Karan Malhotra — Founder",
    reason: "One is investing and the other is building with real traction"
  },
  {
    id: 3,
    name: "Neha Kapoor",
    title: "Consumer Ops",
    bio: "I want to work on consumer AI,\nbut only with founders who ship fast.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&crop=face",
    reply: "That's exactly how we work.",
    replyFrom: "Arjun Mehra — Founder",
    reason: "Intent to collaborate"
  },
  {
    id: 4,
    name: "Aakash Singh",
    title: "Final Year Student",
    bio: "I'm graduating soon and exploring growth or ops roles.\nI don't want to spam recruiters on LinkedIn.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face",
    reply: "Context helps. Let's talk.",
    replyFrom: "Priya Nair — Talent Partner",
    reason: "One is hiring and the other is actively exploring roles"
  }
];

// Floating Profile Card with attached message
const FloatingProfileCard = ({ profile }: { profile: typeof profiles[0] }) => (
  <motion.div
    className="absolute -left-4 md:-left-20 top-8 md:top-16 z-30 w-[140px] md:w-[200px]"
    animate={{ y: [0, -8, 0] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={profile.id}
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        initial={{ opacity: 0, x: -20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        transition={{ duration: 0.5 }}
      >
        {/* Photo */}
        <div className="aspect-[4/5] relative overflow-hidden">
          <img 
            src={profile.image} 
            alt={profile.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] md:text-xs font-semibold px-2 py-1 rounded-lg">
            {profile.name.split(" ")[0]}
          </div>
        </div>
        {/* Attached text message - bigger to fit multi-line bios */}
        <div className="p-2.5 md:p-4 bg-[#E9E9EB]">
          <p className="text-gray-900 text-[11px] md:text-sm font-medium leading-relaxed whitespace-pre-line">
            "{profile.bio}"
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
      <div className="relative w-[220px] md:w-[320px] h-[320px] md:h-[480px] overflow-hidden">
        {/* Phone frame - extended beyond container so bottom is hidden */}
        <div className="absolute inset-x-0 top-0 h-[420px] md:h-[600px] bg-white rounded-t-[32px] md:rounded-t-[45px] border-[6px] md:border-[8px] border-b-0 border-gray-900 shadow-2xl overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-1.5 md:top-2 left-1/2 -translate-x-1/2 w-16 md:w-24 h-4 md:h-6 bg-gray-900 rounded-full z-20" />
          
          {/* Screen content */}
          <div className="absolute inset-0 pt-8 md:pt-12 bg-gradient-to-b from-gray-50 to-white flex flex-col">
            {/* iMessage header */}
            <div className="px-4 py-1.5 md:py-2 border-b border-gray-100">
              <p className="text-[10px] md:text-xs text-gray-500 text-center">iMessage</p>
            </div>

            {/* Spacer to push reply to bottom */}
            <div className="flex-1" />

            {/* Reply message */}
            <div className="px-3 md:px-4 mt-auto mb-20 md:mb-32">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`reply-${currentProfile.id}`}
                  className="flex justify-end"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  <div className="bg-[#007AFF] text-white rounded-2xl rounded-br-md px-3 md:px-4 py-2">
                    <p className="text-xs md:text-sm font-medium">{currentProfile.reply}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex justify-center gap-1.5 md:gap-2 mt-3 md:mt-4">
        {profiles.map((_, index) => (
          <motion.div
            key={index}
            className={`h-1 md:h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? "w-4 md:w-6 bg-gray-900" : "w-1 md:w-1.5 bg-gray-300"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

const NetworkVisualization = ({ currentIndex }: { currentIndex: number }) => {
  return (
    <div className="relative w-full flex justify-center pl-8 md:pl-16">
      <IPhoneMockup currentIndex={currentIndex} />
    </div>
  );
};

// Running reason ticker synced with profiles
const ReasonTicker = ({ currentIndex }: { currentIndex: number }) => {
  const currentProfile = profiles[currentIndex];
  
  return (
    <div className="overflow-hidden mb-4 md:mb-6">
      <AnimatePresence mode="wait">
        <motion.p
          key={`reason-${currentProfile.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-sm md:text-base text-gray-500 italic"
        >
          "{currentProfile.reason}"
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

export const NetworkHero = () => {
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const referralCode = searchParams.get("ref");

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
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen bg-white overflow-hidden flex items-center">
      <div className="container-apple relative z-10 py-12 md:py-20 pb-24 md:pb-32 px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-12 lg:gap-8 items-center">
          {/* Left column - Header with CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center lg:text-left order-2 lg:order-1"
          >
            {/* Reason Ticker */}
            <ReasonTicker currentIndex={currentIndex} />
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight mb-6 md:mb-8"
            >
              The right introduction can change everything.
            </motion.h1>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Button 
                className="bg-gray-900 text-white border-0 px-6 md:px-8 py-5 md:py-6 text-base md:text-lg font-medium rounded-full hover:bg-gray-800 transition-colors w-full sm:w-auto"
                onClick={() => setIsModalOpen(true)}
              >
                Join the Waitlist
              </Button>
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

      {/* Scroll indicator - hidden on mobile */}
      <motion.button
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer hidden md:flex"
      >
        <span className="text-xs font-medium tracking-wider uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.button>

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        referralCode={referralCode}
      />
    </section>
  );
};
