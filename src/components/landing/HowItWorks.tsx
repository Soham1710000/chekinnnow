import { useRef, forwardRef } from "react";
import { motion, useInView } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Tell us who you are",
    description: "Share your interests, skills, and career aspirations",
    icon: "✨",
  },
  {
    number: "02",
    title: "AI learns your context",
    description: "Our AI deeply understands what you're looking for",
    icon: "🧠",
  },
  {
    number: "03",
    title: "ChekInn orchestrates intros",
    description: "We connect you with the right people at the right time",
    icon: "🤝",
  },
];

const StepCard = ({ step, index }: { step: typeof steps[0]; index: number }) => {
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ 
        duration: 0.8, 
        delay: index * 0.2,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className="relative"
    >
      <motion.div
        animate={isInView ? { y: [0, -8, 0] } : {}}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: index * 0.5
        }}
        className="floating-card p-8 md:p-10 text-center"
      >
        <div className="text-4xl mb-6">{step.icon}</div>
        <span className="text-sm font-medium text-muted-foreground tracking-wider">
          {step.number}
        </span>
        <h3 className="text-xl md:text-2xl font-semibold mt-2 mb-4">
          {step.title}
        </h3>
        <p className="text-muted-foreground">
          {step.description}
        </p>
      </motion.div>

      {/* Connection line */}
      {index < steps.length - 1 && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 + index * 0.2 }}
          className="hidden lg:block absolute top-1/2 -right-8 w-16 h-px bg-gradient-to-r from-border to-transparent origin-left"
        />
      )}
    </motion.div>
  );
};

export const HowItWorks = forwardRef<HTMLElement>((_, forwardedRef) => {
  const internalRef = useRef(null);
  const isInView = useInView(internalRef, { once: true, margin: "-100px" });

  return (
    <section 
      ref={(node) => {
        internalRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }} 
      className="py-12 md:py-16 lg:py-20 bg-background"
    >
      <div className="container-apple">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-display-md mb-4">How it works</h2>
          <p className="text-body-md text-muted-foreground max-w-xl mx-auto">
            Three simple steps to your next opportunity
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-16">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
});

HowItWorks.displayName = "HowItWorks";
