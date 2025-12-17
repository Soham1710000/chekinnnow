import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";

const templates = [
  "Where do I even start?",
  "How to pick my optional?",
  "Answer writing struggles",
  "Interview prep help",
  "Feeling overwhelmed",
];

// UPSC-relevant social proof marquee
const logoItems = (
  <>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">IAS Officers</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">LBSNAA Alumni</span>
    <span className="text-[11px] font-bold text-foreground/70 tracking-tight whitespace-nowrap">IIT Delhi</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">Delhi University</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">JNU</span>
    <span className="text-[11px] font-bold text-foreground/70 tracking-tight whitespace-nowrap">SRCC</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">St. Stephen's</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">IIM Alumni</span>
    <span className="text-[11px] font-bold text-foreground/70 tracking-tight whitespace-nowrap">Top 50 Rankers</span>
  </>
);

const UPSC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  const handleTemplateClick = (template: string) => {
    trackEvent("cta_click", { variant: "UPSC", template });
    sessionStorage.setItem("chekinn_initial_message", template);
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  const handleJustTalk = () => {
    trackEvent("cta_click", { variant: "UPSC", template: "just_talk" });
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  return (
    <main className="min-h-[100svh] bg-background flex flex-col">
      {/* Top scrolling logo marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="w-full py-3 bg-muted/40 border-b border-border/50 overflow-hidden"
      >
        <div className="relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-8 px-6">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium whitespace-nowrap">Our members are from</span>
            <span className="text-muted-foreground/30">•</span>
            {logoItems}
          </div>
          <div className="flex shrink-0 animate-marquee items-center gap-8 px-6">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium whitespace-nowrap">Our members are from</span>
            <span className="text-muted-foreground/30">•</span>
            {logoItems}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:py-20">
        <div className="max-w-md w-full space-y-12">
          
          {/* Social proof badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-muted/60 border border-border/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">50+ aspirants connected this week</span>
            </div>
          </motion.div>

          {/* Headline - Apple style typography */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-center space-y-5"
          >
            <h1 className="text-[1.75rem] sm:text-[2rem] md:text-[2.5rem] font-semibold text-foreground leading-[1.15] tracking-[-0.02em]">
              UPSC journey feeling heavy?
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground font-normal leading-relaxed max-w-sm mx-auto">
              Talk it out. We'll connect you with someone who's been exactly where you are.
            </p>
          </motion.div>

          {/* How it works - minimal */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex items-center justify-center gap-3 text-xs text-muted-foreground/70"
          >
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat with us</span>
            </div>
            <span className="text-muted-foreground/30">→</span>
            <span>We find the right person</span>
            <span className="text-muted-foreground/30">→</span>
            <span>Get connected</span>
          </motion.div>

          {/* Templates - refined pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2.5"
          >
            {templates.map((template, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
                onClick={() => handleTemplateClick(template)}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2.5 rounded-full bg-muted/50 hover:bg-muted border border-border/60 hover:border-border transition-all duration-200 text-sm text-foreground/80 hover:text-foreground font-medium shadow-sm hover:shadow"
              >
                {template}
              </motion.button>
            ))}
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="flex items-center gap-4 px-6"
          >
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </motion.div>

          {/* CTA - Apple style button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="text-center space-y-5"
          >
            <motion.button
              onClick={handleJustTalk}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              animate={{ 
                boxShadow: [
                  "0 0 0 0 hsl(var(--foreground) / 0.2)",
                  "0 0 0 12px hsl(var(--foreground) / 0)",
                  "0 0 0 0 hsl(var(--foreground) / 0)"
                ]
              }}
              transition={{ 
                boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeOut" }
              }}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-foreground text-background font-semibold text-base shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              Just talk to me
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <p className="text-sm text-muted-foreground/60">
              No login required • Start with one sentence
            </p>
          </motion.div>
        </div>
      </div>

      {/* Footer tagline */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="py-8 text-center"
      >
        <p className="text-xs text-muted-foreground/40 tracking-wide">
          ChekInn — where aspirants find their people
        </p>
      </motion.footer>
    </main>
  );
};

export default UPSC;