import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Relatable pain points - reduced for mobile
const painPoints = [
  "Where do I even start?",
  "Stuck in answer writing",
  "Need mentor guidance",
  "Prelims giving anxiety",
];

// Social proof marquee
const logoItems = (
  <>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">IAS Officers</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">LBSNAA Alumni</span>
    <span className="text-[11px] font-bold text-foreground/70 tracking-tight whitespace-nowrap">IIT Delhi</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">Delhi University</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">JNU</span>
    <span className="text-[11px] font-bold text-foreground/70 tracking-tight whitespace-nowrap">SRCC</span>
    <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-tight whitespace-nowrap">Top 50 Rankers</span>
  </>
);

const UPSC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  const handlePainPointClick = (painPoint: string) => {
    trackEvent("cta_click", { variant: "UPSC", template: painPoint });
    sessionStorage.setItem("chekinn_initial_message", painPoint);
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  const handleMainCTA = () => {
    trackEvent("cta_click", { variant: "UPSC", template: "main_cta" });
    sessionStorage.setItem("chekinn_source", "upsc");
    navigate("/chat");
  };

  return (
    <main className="min-h-[100svh] bg-background flex flex-col">
      {/* Scrolling social proof */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full py-2.5 bg-muted/30 border-b border-border/40 overflow-hidden"
      >
        <div className="relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium whitespace-nowrap">Members from</span>
            <span className="text-muted-foreground/20">•</span>
            {logoItems}
          </div>
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium whitespace-nowrap">Members from</span>
            <span className="text-muted-foreground/20">•</span>
            {logoItems}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:py-16">
        <div className="max-w-lg w-full space-y-10">
          
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
              </span>
              <span className="text-[11px] text-muted-foreground">50+ aspirants connected</span>
            </div>
          </motion.div>

          {/* Empathetic headline */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center space-y-4"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground leading-tight tracking-tight">
              UPSC is lonely.
              <br />
              <span className="text-muted-foreground font-normal">It doesn't have to be.</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground/80 max-w-sm mx-auto">
              Tell us what you're struggling with. We'll connect you with someone who's been there.
            </p>
          </motion.div>

          {/* Relatable pain points - highlighted */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <p className="text-center text-xs text-muted-foreground/70 font-medium">
              Sound familiar?
            </p>
            <div className="grid grid-cols-2 gap-2.5 max-w-sm mx-auto">
              {painPoints.map((point, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.25 + index * 0.05 }}
                  onClick={() => handlePainPointClick(point)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all duration-200 text-sm font-medium text-foreground"
                >
                  {point}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Main CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center space-y-4 pt-4"
          >
            <motion.button
              onClick={handleMainCTA}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ 
                boxShadow: [
                  "0 0 0 0 hsl(var(--foreground) / 0.15)",
                  "0 0 0 10px hsl(var(--foreground) / 0)",
                  "0 0 0 0 hsl(var(--foreground) / 0)"
                ]
              }}
              transition={{ 
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeOut" }
              }}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-foreground text-background font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Talk to us
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <p className="text-xs text-muted-foreground/50">
              No signup needed
            </p>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="py-6 text-center"
      >
        <p className="text-[11px] text-muted-foreground/35">
          ChekInn — where aspirants find their people
        </p>
      </motion.footer>
    </main>
  );
};

export default UPSC;
