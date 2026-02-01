import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles, ArrowRight } from "lucide-react";

interface OnboardingOverlayProps {
  onStart: () => void;
}

const OnboardingOverlay = ({ onStart }: OnboardingOverlayProps) => {
  const exampleConnections = [
    "Product Manager at Google",
    "Founder who just raised Series A", 
    "UPSC topper from 2023",
    "Engineer at Stripe",
    "Someone who switched from consulting to tech"
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-background flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-md w-full space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            Takes ~2 min
          </div>
          <h1 className="text-2xl font-bold">We'll find the right person for you</h1>
          <p className="text-muted-foreground">Answer a few quick questions so we can connect you with someone who can actually help.</p>
        </div>

        {/* Example connections */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-muted/50 rounded-xl p-4 space-y-3"
        >
          <p className="text-sm font-medium text-muted-foreground">People in our network include:</p>
          <div className="flex flex-wrap gap-2">
            {exampleConnections.map((connection, index) => (
              <motion.span
                key={connection}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                className="text-xs bg-background border border-border px-2.5 py-1.5 rounded-full"
              >
                {connection}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* What we'll ask */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-3 text-sm">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3 h-3 text-primary" />
            </div>
            <span className="text-muted-foreground">What you're working on or looking for</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3 h-3 text-primary" />
            </div>
            <span className="text-muted-foreground">Who would be most helpful to meet</span>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="pt-2"
        >
          <Button
            onClick={onStart}
            className="w-full h-12 text-base font-semibold group"
            size="lg"
          >
            Let's go
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingOverlay;