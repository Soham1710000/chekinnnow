import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";
import { MessageCircle, Users, ArrowRight } from "lucide-react";

const templates = [
  "Where do I even start?",
  "How to pick my optional?",
  "Struggling with answer writing",
  "Interview prep help",
  "Feeling stuck & demotivated",
];

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
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full py-4 px-5 border-b border-border/30"
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground tracking-tight">ChekInn</span>
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">for UPSC aspirants</span>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:py-12">
        <div className="max-w-md w-full space-y-8">
          
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center space-y-3"
          >
            <h1 className="text-xl sm:text-2xl text-foreground leading-relaxed">
              <span className="font-normal text-muted-foreground">UPSC journey feeling heavy?</span>
              <br />
              <span className="font-medium">Talk it out. We'll help.</span>
            </h1>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Share what's on your mind</span>
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground/40 hidden sm:block" />
            <span className="text-muted-foreground/40 sm:hidden">↓</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>We connect you to the right person</span>
            </div>
          </motion.div>

          {/* Templates */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {templates.map((template, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
                onClick={() => handleTemplateClick(template)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-background hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 text-xs text-muted-foreground hover:text-foreground"
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
            className="flex items-center gap-3 px-12"
          >
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border/40" />
          </motion.div>

          {/* CTA */}
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
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
            >
              Just talk to me
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <p className="mt-3 text-[11px] text-muted-foreground/50">
              No login needed • Start with one sentence
            </p>
          </motion.div>

          {/* Social proof */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-center text-[10px] text-muted-foreground/40"
          >
            Talked to 50+ UPSC aspirants this week
          </motion.p>
        </div>
      </div>
    </main>
  );
};

export default UPSC;