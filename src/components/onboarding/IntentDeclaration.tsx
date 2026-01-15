import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Target, Lightbulb, Shield, Heart, Check } from "lucide-react";

interface IntentDeclarationProps {
  onComplete: (intent: string) => void;
}

const INTENTS = [
  {
    id: "clarity",
    label: "Clarity",
    description: "I'm confused between multiple right answers",
    icon: Compass,
  },
  {
    id: "direction",
    label: "Direction",
    description: "I need to decide what to do next",
    icon: Target,
  },
  {
    id: "opportunity",
    label: "Opportunity",
    description: "I'm exploring what's possible",
    icon: Lightbulb,
  },
  {
    id: "pressure-testing",
    label: "Pressure Testing",
    description: "I want to validate a decision",
    icon: Shield,
  },
  {
    id: "help-others",
    label: "Help Others",
    description: "I've been here before",
    icon: Heart,
  },
];

const IntentDeclaration = ({ onComplete }: IntentDeclarationProps) => {
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedIntent) {
      onComplete(selectedIntent);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">
            What are you checking in for right now?
          </h1>
          <p className="text-sm text-muted-foreground">
            You can change this anytime.<br />
            ChekInn adapts with you.
          </p>
        </div>

        {/* Intent Cards */}
        <div className="space-y-3">
          {INTENTS.map((intent, index) => {
            const Icon = intent.icon;
            const isSelected = selectedIntent === intent.id;
            
            return (
              <motion.button
                key={intent.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => setSelectedIntent(intent.id)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isSelected ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{intent.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {intent.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* CTA */}
        <Button
          onClick={handleContinue}
          disabled={!selectedIntent}
          className="w-full h-12 text-base font-semibold rounded-xl"
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
};

export default IntentDeclaration;
