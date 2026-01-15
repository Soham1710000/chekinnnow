import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, CheckCircle2, Search, Zap } from "lucide-react";

interface FindingMatchCardProps {
  onComplete?: () => void;
  userName?: string;
}

const PROGRESS_STEPS = [
  { id: 1, label: "Analyzing your context", icon: Search, duration: 2000 },
  { id: 2, label: "Scanning our network", icon: Users, duration: 2500 },
  { id: 3, label: "Finding the right match", icon: Sparkles, duration: 2000 },
];

const FindingMatchCard = ({ onComplete, userName }: FindingMatchCardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (currentStep < PROGRESS_STEPS.length) {
      const step = PROGRESS_STEPS[currentStep];
      const startProgress = (currentStep / PROGRESS_STEPS.length) * 100;
      const endProgress = ((currentStep + 1) / PROGRESS_STEPS.length) * 100;
      
      // Animate progress bar
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const increment = (endProgress - startProgress) / (step.duration / 50);
          const next = prev + increment;
          return next >= endProgress ? endProgress : next;
        });
      }, 50);

      // Move to next step
      const timeout = setTimeout(() => {
        clearInterval(progressInterval);
        setProgress(endProgress);
        
        if (currentStep < PROGRESS_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else {
          setIsComplete(true);
          onComplete?.();
        }
      }, step.duration);

      return () => {
        clearTimeout(timeout);
        clearInterval(progressInterval);
      };
    }
  }, [currentStep, onComplete]);

  const currentStepData = PROGRESS_STEPS[currentStep];
  const CurrentIcon = currentStepData?.icon || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-sm mx-auto my-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-5 shadow-lg">
        {/* Animated background effect */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -inset-[100%] opacity-30"
            animate={{
              background: [
                "radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 100% 100%, hsl(var(--primary) / 0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 0% 100%, hsl(var(--primary) / 0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.3) 0%, transparent 50%)",
                "radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.3) 0%, transparent 50%)",
              ],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
              animate={!isComplete ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1.5, repeat: isComplete ? 0 : Infinity }}
            >
              <AnimatePresence mode="wait">
                {isComplete ? (
                  <motion.div
                    key="complete"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </motion.div>
                ) : (
                  <motion.div
                    key={currentStep}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CurrentIcon className="w-5 h-5 text-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {isComplete ? "Match in progress" : "Finding your match"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isComplete 
                  ? "We'll notify you within 12-24 hours"
                  : "This won't take long"
                }
              </p>
            </div>

            {!isComplete && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-4 h-4 text-primary/50" />
              </motion.div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {PROGRESS_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep && !isComplete;
              const isDone = index < currentStep || isComplete;
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 text-xs transition-colors ${
                    isDone 
                      ? "text-primary" 
                      : isActive 
                        ? "text-foreground" 
                        : "text-muted-foreground/50"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    isDone 
                      ? "bg-primary/20" 
                      : isActive 
                        ? "bg-primary/10 ring-2 ring-primary/30" 
                        : "bg-muted"
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <StepIcon className="w-3 h-3" />
                    )}
                  </div>
                  <span className={isDone ? "line-through opacity-70" : ""}>
                    {step.label}
                  </span>
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-muted-foreground"
                    >
                      ...
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Completion message */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="mt-4 pt-4 border-t border-primary/10"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We're reviewing profiles that match your context. 
                  {userName ? ` ${userName}, you'll` : " You'll"} receive an email 
                  when we find the right person.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default FindingMatchCard;
