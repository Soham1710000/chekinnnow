import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const templates = [
  "Where do I start?",
  "How to pick optional?",
  "Answer writing tips",
  "Interview prep",
  "Feeling stuck",
];

// UPSC-relevant social proof marquee
const logoItems = (
  <>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">IAS Officers</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">LBSNAA Alumni</span>
    <span className="text-xs font-bold text-gray-800 tracking-tight">IIT Delhi</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">Delhi University</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">JNU</span>
    <span className="text-xs font-bold text-gray-800 tracking-tight">SRCC</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">St. Stephen's</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">IIM Alumni</span>
    <span className="text-xs font-bold text-gray-800 tracking-tight">Top Rankers</span>
    <span className="text-xs font-semibold text-gray-700 tracking-tight">Interview Boards</span>
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
    <main className="min-h-[100svh] bg-white flex flex-col">
      {/* Top scrolling logo marquee - matching A/B */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full py-2.5 bg-gray-50/80 border-b border-gray-100 overflow-hidden"
      >
        <div className="relative flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Members are from</span>
            <span className="text-gray-300">•</span>
            {logoItems}
          </div>
          <div className="flex shrink-0 animate-marquee items-center gap-6 px-4">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium whitespace-nowrap">Members are from</span>
            <span className="text-gray-300">•</span>
            {logoItems}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:py-16">
        <div className="max-w-lg w-full space-y-10">
          
          {/* Social proof badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-gray-600 font-medium">50+ aspirants connected this week</span>
            </div>
          </motion.div>

          {/* Headline - Apple style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center space-y-4"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 leading-tight tracking-tight">
              UPSC journey feeling heavy?
            </h1>
            <p className="text-lg sm:text-xl text-gray-500 font-normal leading-relaxed">
              Talk it out. We'll connect you<br className="hidden sm:block" /> to someone who's been there.
            </p>
          </motion.div>

          {/* Templates - compact pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {templates.map((template, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.25 + index * 0.04 }}
                onClick={() => handleTemplateClick(template)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 transition-all duration-200 text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                {template}
              </motion.button>
            ))}
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="flex items-center gap-4 px-8"
          >
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </motion.div>

          {/* CTA - Apple style with pulse */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center space-y-4"
          >
            <motion.button
              onClick={handleJustTalk}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{ 
                boxShadow: [
                  "0 0 0 0 rgba(0, 0, 0, 0.3)",
                  "0 0 0 10px rgba(0, 0, 0, 0)",
                  "0 0 0 0 rgba(0, 0, 0, 0)"
                ]
              }}
              transition={{ 
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeOut" }
              }}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gray-900 text-white font-semibold text-base shadow-lg hover:bg-gray-800 transition-colors duration-200"
            >
              Just talk to me
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <p className="text-sm text-gray-400">
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
        className="py-6 text-center"
      >
        <p className="text-xs text-gray-400">
          ChekInn — where aspirants find their people
        </p>
      </motion.footer>
    </main>
  );
};

export default UPSC;