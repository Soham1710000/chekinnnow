import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import OnboardingOverlay from "@/components/chat/OnboardingOverlay";

export const FinalCTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();
  const [showExplainer, setShowExplainer] = useState(false);

  const handleClick = () => {
    setShowExplainer(true);
  };

  const handleExplainerContinue = () => {
    setShowExplainer(false);
    navigate("/auth");
  };

  return (
    <>
      <section ref={ref} className="py-12 md:py-16 lg:py-20 bg-background">
        <div className="container-apple">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
              className="flex justify-center"
            >
              <Button 
                variant="hero" 
                size="hero"
                onClick={handleClick}
              >
                Let's Talk
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Explainer Overlay */}
      <AnimatePresence>
        {showExplainer && (
          <div className="fixed inset-0 z-50 bg-background">
            <OnboardingOverlay onStart={handleExplainerContinue} />
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
