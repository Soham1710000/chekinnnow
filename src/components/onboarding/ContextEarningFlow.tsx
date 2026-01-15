import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check } from "lucide-react";

interface ContextEarningFlowProps {
  onComplete: (context: ContextData) => void;
}

export interface ContextData {
  lookingFor: string;  // What opportunity they're seeking
  whyOpportunity: string;  // Why they want this opportunity
  constraint: string;  // Any constraints
  contrarianBelief: string;
  careerInflection: string;
  motivation: string;
  motivationExplanation: string;
}

const MOTIVATIONS = [
  { id: "building", label: "Building something meaningful" },
  { id: "recognition", label: "Recognition & status" },
  { id: "financial", label: "Financial freedom" },
  { id: "mastery", label: "Mastery & learning" },
  { id: "stability", label: "Stability" },
  { id: "impact", label: "Impact on others" },
];

const OPPORTUNITY_EXAMPLES = [
  "Find a co-founder",
  "Get a job referral",
  "Find investors",
  "Meet mentors",
  "Hire talent",
  "Find business partners",
];

const CONSTRAINT_EXAMPLES = ["Time", "Money", "Location", "Confidence", "Information", "Network"];

type Step = "intro" | "lookingFor" | "whyOpportunity" | "constraint" | "motivation" | "complete";

const ContextEarningFlow = ({ onComplete }: ContextEarningFlowProps) => {
  const [step, setStep] = useState<Step>("intro");
  const [context, setContext] = useState<ContextData>({
    lookingFor: "",
    whyOpportunity: "",
    constraint: "",
    contrarianBelief: "",
    careerInflection: "",
    motivation: "",
    motivationExplanation: "",
  });

  const getProgressText = () => {
    switch (step) {
      case "intro": return "Context layer: starting...";
      case "lookingFor": return "Context layer: 25% complete";
      case "whyOpportunity": return "Context layer: 50% complete";
      case "constraint": return "Context layer: 75% complete";
      case "motivation": return "Context layer: 90% complete";
      case "complete": return "Context layer: complete";
      default: return "";
    }
  };

  const handleNext = useCallback(() => {
    switch (step) {
      case "intro": setStep("lookingFor"); break;
      case "lookingFor": setStep("whyOpportunity"); break;
      case "whyOpportunity": setStep("constraint"); break;
      case "constraint": setStep("motivation"); break;
      case "motivation": 
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
      case "lookingFor": return !!context.lookingFor.trim(); // Required
      case "whyOpportunity": return true; // Optional but encouraged
      case "constraint": return true; // Optional
      case "motivation": return true; // Optional now
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
                Before connecting you to others,<br />
                we learn how you think.
              </h1>
              <p className="text-muted-foreground">
                A few questions.<br />
                Only context — no right answers.
              </p>
            </div>

            <div className="space-y-3 text-left bg-muted/50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-muted-foreground">
                Your context layer
              </h3>
              <p className="text-sm text-muted-foreground">
                Not a profile.<br />
                A thinking map.
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

        {/* Looking For - REQUIRED */}
        {step === "lookingFor" && (
          <motion.div
            key="lookingFor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What kind of connection are you looking for?
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps us find the right people for you.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {OPPORTUNITY_EXAMPLES.map((o) => (
                <button
                  key={o}
                  onClick={() => setContext(prev => ({ ...prev, lookingFor: o }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    context.lookingFor === o
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>

            <Textarea
              value={context.lookingFor}
              onChange={(e) => setContext(prev => ({ ...prev, lookingFor: e.target.value }))}
              placeholder="Or describe in your own words..."
              className="min-h-[80px] text-base rounded-xl border-2 resize-none"
            />

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

        {/* Why Opportunity */}
        {step === "whyOpportunity" && (
          <motion.div
            key="whyOpportunity"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                Why are you looking for this?
              </h2>
              <p className="text-sm text-muted-foreground">
                Understanding your "why" helps us find better matches.
              </p>
            </div>

            <Textarea
              value={context.whyOpportunity}
              onChange={(e) => setContext(prev => ({ ...prev, whyOpportunity: e.target.value }))}
              placeholder="e.g., I'm building a fintech startup and need someone who understands the regulatory landscape..."
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
                Any constraints we should know about?
              </h2>
              <p className="text-sm text-muted-foreground">
                Helps us avoid suggesting connections that won't work for you.
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
                What currently drives you the most?
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps us understand your mindset for better matches.
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
