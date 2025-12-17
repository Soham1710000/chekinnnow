import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";

const templates = [
  "CAT didn't go well. What should I do next?",
  "I want to switch jobs but don't know how to start.",
  "I have a job offer and I'm unsure if I should take it.",
  "I want to prepare for UPSC seriously. Where do I begin?",
  "I feel stuck in my career and need clarity.",
];

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

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <h1 className="text-2xl md:text-3xl font-light text-muted-foreground leading-relaxed">
            When your head feels full, but nothing's clear
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground/80">
            You don't need the right words here.
          </p>
          <p className="text-base text-muted-foreground/60">
            Even one sentence is enough to start.
          </p>
        </motion.div>

        {/* Templates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-3"
        >
          {templates.map((template, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
              onClick={() => handleTemplateClick(template)}
              className="w-full text-left px-5 py-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200 group"
            >
              <span className="text-sm md:text-base text-foreground/80 group-hover:text-foreground transition-colors">
                "{template}"
              </span>
            </motion.button>
          ))}
        </motion.div>

        {/* Subtle hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-xs text-muted-foreground/50 pt-4"
        >
          Or just say what's on your mind
        </motion.p>
      </div>
    </main>
  );
};

export default IndexC;
