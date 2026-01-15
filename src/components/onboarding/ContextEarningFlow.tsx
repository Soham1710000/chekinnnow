import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check } from "lucide-react";

interface ContextEarningFlowProps {
  onComplete: (context: ContextData) => void;
}

export interface ContextData {
  contrarianBelief: string;
  careerInflection: string;
  motivation: string;
  motivationExplanation: string;
  constraint: string;
}

const MOTIVATIONS = [
  { id: "building", label: "Building something meaningful" },
  { id: "recognition", label: "Recognition & status" },
  { id: "financial", label: "Financial freedom" },
  { id: "mastery", label: "Mastery & learning" },
  { id: "stability", label: "Stability" },
  { id: "impact", label: "Impact on others" },
];

const CONSTRAINT_EXAMPLES = ["Time", "Money", "Geography", "Confidence", "Information", "Social capital"];

type Step = "intro" | "contrarian" | "inflection" | "motivation" | "constraint" | "complete";

const ContextEarningFlow = ({ onComplete }: ContextEarningFlowProps) => {
  const [step, setStep] = useState<Step>("intro");
  const [context, setContext] = useState<ContextData>({
    contrarianBelief: "",
    careerInflection: "",
    motivation: "",
    motivationExplanation: "",
    constraint: "",
  });

  const getProgressText = () => {
    switch (step) {
      case "intro": return "Context layer: starting...";
      case "contrarian": return "Context layer: 20% complete";
      case "inflection": return "Context layer: 40% complete";
      case "motivation": return "Context layer: 60% complete";
      case "constraint": return "Context layer: 80% complete";
      case "complete": return "Context layer: complete";
      default: return "";
    }
  };

  const handleNext = useCallback(() => {
    switch (step) {
      case "intro": setStep("contrarian"); break;
      case "contrarian": setStep("inflection"); break;
      case "inflection": setStep("motivation"); break;
      case "motivation": setStep("constraint"); break;
      case "constraint": 
        setStep("complete");
        setTimeout(() => onComplete(context), 1500);
        break;
    }
  }, [step, context, onComplete]);

  const handleSkip = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const canProceed = () => {
    switch (step) {
      case "contrarian": return true; // Optional
      case "inflection": return true; // Optional
      case "motivation": return !!context.motivation;
      case "constraint": return true; // Optional
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Progress indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-6 left-1/2 -translate-x-1/2"
      >
        <span className="text-xs font-medium text-muted-foreground tracking-wide">
          {getProgressText()}
        </span>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Intro */}
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">
                Before ChekInn connects you to others,<br />
                it needs to understand how you think.
              </h1>
              <p className="text-muted-foreground">
                "I'll ask you a few things.<br />
                There are no right answers — only context."
              </p>
            </div>

            <div className="space-y-3 text-left bg-muted/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground">
                Earning Your Context Layer
              </h3>
              <p className="text-sm text-muted-foreground">
                Context isn't a profile.<br />
                It's how decisions make sense to you.
              </p>
              <p className="text-xs text-muted-foreground/70 pt-2">
                This takes ~4 minutes.<br />
                You can skip anything — but depth improves matches.
              </p>
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              Begin
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Contrarian Beliefs */}
        {step === "contrarian" && (
          <motion.div
            key="contrarian"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What's a belief you hold that most people around you disagree with?
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps ChekInn understand how you diverge from the crowd.
              </p>
            </div>

            <Textarea
              value={context.contrarianBelief}
              onChange={(e) => setContext(prev => ({ ...prev, contrarianBelief: e.target.value }))}
              placeholder="Type your thoughts..."
              className="min-h-[120px] text-base rounded-xl border-2 resize-none"
            />

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1 h-12 text-muted-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 h-12 font-semibold rounded-xl"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Career Inflection */}
        {step === "inflection" && (
          <motion.div
            key="inflection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What's a moment that quietly changed the direction of your career?
              </h2>
              <p className="text-sm text-muted-foreground">
                Not a milestone. An inflection.
              </p>
            </div>

            <Textarea
              value={context.careerInflection}
              onChange={(e) => setContext(prev => ({ ...prev, careerInflection: e.target.value }))}
              placeholder="Type your thoughts..."
              className="min-h-[120px] text-base rounded-xl border-2 resize-none"
            />

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1 h-12 text-muted-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 h-12 font-semibold rounded-xl"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Motivation */}
        {step === "motivation" && (
          <motion.div
            key="motivation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What currently pulls you forward more?
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose one, then explain if you want.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MOTIVATIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setContext(prev => ({ ...prev, motivation: m.id }))}
                  className={`p-4 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                    context.motivation === m.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {context.motivation === m.id && (
                    <Check className="w-4 h-4 text-primary float-right" />
                  )}
                  {m.label}
                </button>
              ))}
            </div>

            {context.motivation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <Textarea
                  value={context.motivationExplanation}
                  onChange={(e) => setContext(prev => ({ ...prev, motivationExplanation: e.target.value }))}
                  placeholder="Want to say more? (optional)"
                  className="min-h-[80px] text-base rounded-xl border-2 resize-none"
                />
              </motion.div>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Constraints */}
        {step === "constraint" && (
          <motion.div
            key="constraint"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What feels most limiting right now?
              </h2>
              <p className="text-sm text-muted-foreground">
                Constraints help ChekInn avoid naive advice.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {CONSTRAINT_EXAMPLES.map((c) => (
                <button
                  key={c}
                  onClick={() => setContext(prev => ({ ...prev, constraint: c }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    context.constraint === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <Textarea
              value={context.constraint}
              onChange={(e) => setContext(prev => ({ ...prev, constraint: e.target.value }))}
              placeholder="Or describe in your own words..."
              className="min-h-[80px] text-base rounded-xl border-2 resize-none"
            />

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1 h-12 text-muted-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 h-12 font-semibold rounded-xl"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Complete */}
        {step === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-medium">Context layer complete</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContextEarningFlow;
