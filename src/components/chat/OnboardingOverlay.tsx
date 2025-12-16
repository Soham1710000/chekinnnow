import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, User, Sparkles, ArrowRight } from "lucide-react";

interface OnboardingOverlayProps {
  onStart: () => void;
}

const OnboardingOverlay = ({ onStart }: OnboardingOverlayProps) => {
  const steps = [
    {
      icon: MessageCircle,
      title: "Chat with ChekInn",
      description: "Tell us what you're looking for — career advice, co-founders, mentors, anything.",
    },
    {
      icon: User,
      title: "We build your profile",
      description: "No forms. We learn about you through conversation and create your profile.",
    },
    {
      icon: Sparkles,
      title: "Get matched",
      description: "We find the right person and make the introduction. You chat, we connect.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-background/98 backdrop-blur-sm flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">How ChekInn works</h1>
          <p className="text-muted-foreground">3 simple steps to your next connection</p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.15 }}
              className="flex gap-4 items-start"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="font-semibold mt-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="pt-4"
        >
          <Button
            onClick={onStart}
            className="w-full h-12 text-base font-semibold group"
            size="lg"
          >
            Let's go
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            Takes ~2 minutes • No forms to fill
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingOverlay;