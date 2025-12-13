import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

// Profile Card Component
const ProfileCard = ({ 
  name, 
  location, 
  age, 
  image, 
  className,
  delay = 0 
}: { 
  name: string; 
  location: string; 
  age: number; 
  image: string;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay }}
    className={className}
  >
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay }}
      className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-[200px]"
    >
      <div className="aspect-[4/5] bg-gradient-to-br from-green-200 to-green-400 relative overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded">
          {name}
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-gray-600 text-sm">
          <MapPin className="w-3.5 h-3.5" />
          <span>{location}</span>
        </div>
        <span className="text-gray-800 font-semibold text-sm">{age}</span>
      </div>
    </motion.div>
  </motion.div>
);

// Quote Bubble Component
const QuoteBubble = ({ 
  text, 
  reach, 
  time, 
  className,
  delay = 0 
}: { 
  text: string; 
  reach: number; 
  time: string;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5, delay }}
    className={className}
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 }}
      className="bg-[#E9E9EB] rounded-2xl rounded-bl-md p-4 max-w-[280px] shadow-lg"
    >
      <p className="text-gray-900 font-medium text-base leading-snug mb-3">
        "{text}"
      </p>
      <p className="text-gray-500 text-sm font-medium">
        {reach} Reach | {time}
      </p>
    </motion.div>
  </motion.div>
);

// iMessage Bubble Component
const MessageBubble = ({ 
  text, 
  isBlue = false,
  className,
  delay = 0 
}: { 
  text: string; 
  isBlue?: boolean;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: isBlue ? 20 : -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay }}
    className={className}
  >
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay }}
      className={`px-4 py-2.5 rounded-2xl shadow-md max-w-[200px] ${
        isBlue 
          ? "bg-[#007AFF] text-white rounded-br-md" 
          : "bg-[#E9E9EB] text-gray-900 rounded-bl-md"
      }`}
    >
      <p className="text-sm font-medium">{text}</p>
    </motion.div>
  </motion.div>
);

// iPhone Mockup Component
const IPhoneMockup = ({ className }: { className?: string }) => (
  <motion.div
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.8, delay: 0.3 }}
    className={className}
  >
    <div className="relative w-[280px] h-[560px]">
      {/* Phone frame */}
      <div className="absolute inset-0 bg-white rounded-[50px] border-[10px] border-gray-900 shadow-2xl overflow-hidden">
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-8 bg-gray-900 rounded-full z-10" />
        {/* Screen content placeholder */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white" />
      </div>
    </div>
  </motion.div>
);

const NetworkVisualization = () => {
  return (
    <div className="relative w-full h-[500px] md:h-[600px]">
      {/* Profile Card */}
      <ProfileCard
        name="s_"
        location="San Francisco, CA"
        age={20}
        image="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop&crop=face"
        className="absolute left-0 top-0 z-20"
        delay={0}
      />

      {/* Quote Bubble */}
      <QuoteBubble
        text="i'm alan, caltech cs, looking to collab and build with others"
        reach={232}
        time="2hrs ago"
        className="absolute left-0 top-[320px] z-10"
        delay={0.2}
      />

      {/* iPhone Mockup */}
      <IPhoneMockup className="absolute right-0 top-0 z-10" />

      {/* Blue iMessage bubble */}
      <MessageBubble
        text="yooo put us in a gc"
        isBlue
        className="absolute right-8 bottom-20 z-20"
        delay={0.4}
      />

      {/* Connection line from card to phone */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <motion.path
          d="M 200 150 Q 300 200 280 280"
          stroke="#E5E7EB"
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />
      </svg>
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
