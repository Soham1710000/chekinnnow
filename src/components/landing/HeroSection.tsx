import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const APP_URL = "https://app.emergent.sh/share?app=voicechat-companion";

export const HeroSection = () => {
  const scrollToNext = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <header className="bg-background">
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-16 md:py-24">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-foreground"
        >
          Your next opportunity starts with the right introduction.
        </motion.h1>

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-4 md:mt-6 text-base md:text-lg text-muted-foreground leading-snug max-w-2xl"
        >
          ChekInn uses AI to understand you deeply and introduce you to the right people — recruiters,
          mentors, founders and collaborators.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4"
        >
          <Button variant="default" size="lg" className="rounded-lg shadow-sm hover:shadow-md" asChild>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer">
              Join the Beta
            </a>
          </Button>

          <Button variant="outline" size="lg" className="rounded-lg" asChild>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer">
              Download the App
            </a>
          </Button>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 md:mt-12 flex justify-center"
        >
          <button 
            onClick={scrollToNext}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Swipe or scroll to explore
          </button>
        </motion.div>
      </div>
    </header>
  );
};
