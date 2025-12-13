import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

// Sample profile data that cycles through
const profiles = [
  {
    id: 1,
    name: "Sarah Chen",
    bio: "Stanford CS '25 | Building AI tools for creators | Looking to connect with founders",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&crop=face",
    reply: "Would love to connect! ☕️"
  },
  {
    id: 2,
    name: "Marcus Johnson",
    bio: "YC Founder | Previously @Stripe | Angel investing in health-tech",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face",
    reply: "Let's grab coffee this week!"
  },
  {
    id: 3,
    name: "Emma Rodriguez",
    bio: "Product @Figma | Community builder | Always down to help early-stage startups",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop&crop=face",
    reply: "Intro'd you to my network 🙌"
  },
  {
    id: 4,
    name: "Alex Kim",
    bio: "MIT '24 | ML researcher | Open to collabs on robotics projects",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=500&fit=crop&crop=face",
    reply: "This is exactly what I needed!"
  }
];

// Floating Profile Card with attached message
const FloatingProfileCard = ({ profile }: { profile: typeof profiles[0] }) => (
  <motion.div
    className="absolute -left-20 top-16 z-30 w-[200px]"
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
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-lg">
            {profile.name.split(" ")[0]}
          </div>
        </div>
        {/* Attached text message */}
        <div className="p-3 bg-[#E9E9EB]">
          <p className="text-gray-900 text-xs font-medium leading-snug">
            "{profile.bio}"
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  </motion.div>
);

// Half iPhone Mockup with cycling content
const IPhoneMockup = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % profiles.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

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

      {/* Half iPhone frame */}
      <div className="relative w-[320px] h-[480px] overflow-visible">
        {/* Phone frame */}
        <div className="absolute inset-0 bg-white rounded-[45px] rounded-b-3xl border-[8px] border-gray-900 shadow-2xl overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-full z-20" />
          
          {/* Screen content */}
          <div className="absolute inset-0 pt-12 pb-8 bg-gradient-to-b from-gray-50 to-white overflow-hidden flex flex-col">
            {/* iMessage header */}
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 text-center">iMessage</p>
            </div>

            {/* Spacer to push reply to bottom */}
            <div className="flex-1" />

            {/* Reply message - positioned at bottom right */}
            <div className="px-4 pb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`reply-${currentProfile.id}`}
                  className="flex justify-end"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  <div className="bg-[#007AFF] text-white rounded-2xl rounded-br-md px-4 py-2.5">
                    <p className="text-sm font-medium">{currentProfile.reply}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Fade out at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
      </div>

      {/* Progress indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {profiles.map((_, index) => (
          <motion.div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? "w-6 bg-gray-900" : "w-1.5 bg-gray-300"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};

const NetworkVisualization = () => {
  return (
    <div className="relative w-full flex justify-center pl-16">
      <IPhoneMockup />
    </div>
  );
};

export const NetworkHero = () => {
  return (
    <section className="relative min-h-screen bg-white overflow-hidden flex items-center">
      <div className="container-apple relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center lg:text-left"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6"
            >
              Social Network on{" "}
              <span className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">
                iMessage
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 max-w-lg mx-auto lg:mx-0 mb-8"
            >
              Connect with your network through the messaging app you already use. 
              AI-powered introductions, seamless conversations, real relationships.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                className="bg-gray-900 text-white border-0 px-8 py-6 text-lg font-medium rounded-full hover:bg-gray-800 transition-colors"
                asChild
              >
                <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                  Try it out
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-gray-300 text-gray-900 bg-transparent hover:bg-gray-100 px-8 py-6 text-lg font-medium rounded-full"
                asChild
              >
                <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                  Sign in
                </a>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right column - Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="order-first lg:order-last"
          >
            <NetworkVisualization />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
