import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";

export const FinalCTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="section-padding bg-background">
      <div className="container-apple">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-display-xl mb-8"
          >
            ChekInn — where ambition finds its people.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button variant="hero" size="hero" asChild>
              <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                Join Beta
              </a>
            </Button>
            <Button variant="hero-secondary" size="hero" asChild>
              <a href="https://app.emergent.sh/share?app=voicechat-companion" target="_blank" rel="noopener noreferrer">
                Download the App
              </a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
