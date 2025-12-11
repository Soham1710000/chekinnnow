import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const statements = [
  "Cold emails fail.",
  "Random LinkedIn DMs fail.",
  "Warm intros win.",
];

export const WhyChekInn = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="section-padding bg-background">
      <div className="container-apple">
        <div className="max-w-3xl mx-auto">
          {statements.map((statement, index) => (
            <motion.h2
              key={statement}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ 
                duration: 0.8, 
                delay: index * 0.3,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              className={`text-display-lg mb-8 ${
                index === statements.length - 1 
                  ? "text-foreground" 
                  : "text-muted-foreground/60"
              }`}
            >
              {statement}
            </motion.h2>
          ))}
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ 
              duration: 0.8, 
              delay: 1.2,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            className="text-body-lg text-muted-foreground mt-16"
          >
            ChekInn builds familiarity for you — automatically.
          </motion.p>
        </div>
      </div>
    </section>
  );
};
