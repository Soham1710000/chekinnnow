import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const FloatingCard = ({ 
  className, 
  delay = 0,
  children 
}: { 
  className?: string; 
  delay?: number;
  children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1, delay: delay + 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={className}
  >
    <motion.div
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
      className="floating-card p-6 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  </motion.div>
);

export const HeroSection = () => {
  const scrollToNext = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <section className="relative min-h-[85vh] md:min-h-screen flex items-center justify-center overflow-hidden py-16 md:py-0">
      {/* Gradient glow background */}
      <div className="absolute inset-0 hero-glow" />
      
      {/* Subtle animated gradient orb - smaller on mobile */}
      <motion.div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(220 100% 70% / 0.2) 0%, transparent 70%)",
        }}
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.3, 0.2]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container-apple relative z-10 px-5 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-3xl md:text-4xl lg:text-display-xl font-semibold tracking-tight mb-4 md:mb-8"
          >
            Your next opportunity starts with the right introduction.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-base md:text-lg text-muted-foreground max-w-xl md:max-w-2xl mx-auto mb-8 md:mb-12"
          >
            ChekInn uses AI to understand you deeply and introduce you to the right people — recruiters, mentors, founders and collaborators.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button variant="hero" size="default" className="md:px-8 md:py-6 md:text-base" asChild>
              <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                Join the Beta
              </a>
            </Button>
            <Button variant="hero-secondary" size="default" className="md:px-8 md:py-6 md:text-base" asChild>
              <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                Download the App
              </a>
            </Button>
          </motion.div>
        </div>

        {/* Floating cards */}
        <FloatingCard 
          className="absolute left-4 md:left-8 lg:left-16 bottom-8 md:bottom-12 hidden md:block"
          delay={0}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-chekinn-accent/20 to-chekinn-glow/20 flex items-center justify-center">
              <span className="text-sm font-medium">👋</span>
            </div>
            <div>
              <p className="text-sm font-medium">New intro from</p>
              <p className="text-xs text-muted-foreground">Google Recruiter</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard 
          className="absolute right-4 md:right-8 lg:right-16 top-4 md:top-6 hidden md:block"
          delay={1.5}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <span className="text-sm">✓</span>
            </div>
            <div>
              <p className="text-sm font-medium">Mentor matched</p>
              <p className="text-xs text-muted-foreground">Bain & Company</p>
            </div>
          </div>
        </FloatingCard>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={scrollToNext}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <span className="text-xs font-medium tracking-wider uppercase">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.button>
    </section>
  );
};
