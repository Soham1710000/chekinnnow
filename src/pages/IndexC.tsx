import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";

const templates = [
  "CAT didn't go well. What now?",
  "Want to switch jobs but stuck",
  "Got an offer, unsure what to do",
  "UPSC — where do I even start?",
  "Feeling stuck in my career",
];

// Logo items for the marquee (same as A/B)
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

const IndexC = () => {
  const { trackPageView, trackEvent } = useFunnelTracking();
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  const handleTemplateClick = (template: string) => {
    trackEvent("cta_click", { variant: "C", template });
    // Store the template to auto-send in chat
    sessionStorage.setItem("chekinn_initial_message", template);
    navigate("/chat");
  };

  const handleJustTalk = () => {
    trackEvent("cta_click", { variant: "C", template: "just_talk" });
    navigate("/chat");
  };

  return (
    <main className="min-h-[100svh] bg-background flex flex-col">
      {/* Top scrolling logo marquee - same as A/B */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
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

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:py-12">
        <div className="max-w-md w-full space-y-8 sm:space-y-10">
          {/* Headline - comforting, light */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center space-y-3"
          >
            <h1 className="text-xl sm:text-2xl font-normal text-muted-foreground leading-snug">
              When your head feels full,
              <br />
              but nothing's clear
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground/70 font-light">
              You don't need the right words.
            </p>
          </motion.div>

          {/* Templates - compact flowing pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {templates.map((template, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                onClick={() => handleTemplateClick(template)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-border/50 bg-background hover:bg-muted/50 hover:border-border transition-all duration-200 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
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
            className="flex items-center gap-3 px-8"
          >
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground/50">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </motion.div>

          {/* CTA - Just talk */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="text-center"
          >
            <motion.button
              onClick={handleJustTalk}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-3.5 rounded-full bg-primary text-primary-foreground font-medium text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200"
            >
              Just say what's on your mind
              <span className="text-primary-foreground/70">→</span>
            </motion.button>
            <p className="mt-3 text-xs text-muted-foreground/50">
              Even one sentence is enough
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
};

export default IndexC;
