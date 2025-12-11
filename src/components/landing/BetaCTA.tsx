import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";

const campuses = [
  "IITs",
  "BITS",
  "DU",
  "NMIMS",
  "IPU",
  "Tier 2/3 Colleges",
];

export const BetaCTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section 
      ref={ref} 
      className="section-padding relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(220 100% 98%) 0%, hsl(280 100% 99%) 100%)",
      }}
    >
      {/* Subtle gradient orb */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(220 100% 85% / 0.3) 0%, transparent 60%)",
        }}
      />

      <div className="container-apple relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-display-md mb-6"
          >
            ChekInn Beta is now open for select campuses
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            {campuses.map((campus, index) => (
              <motion.span
                key={campus}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="px-5 py-2 rounded-full bg-card border border-border/50 text-sm font-medium"
              >
                {campus}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <Button variant="pill" size="pill" asChild>
              <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                Join Beta
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
