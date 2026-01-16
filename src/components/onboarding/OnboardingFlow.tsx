import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface OnboardingData {
  decision_posture: string;
  ask_type: string;
  lived_context: string[];
  followup_context: string[];
  micro_reason: string;
  decision_weight: string;
  stakes_text: string;
  context_chips: string[];
  open_help_text: string;
  help_style: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const DECISION_POSTURES = [
  { id: "talk_to_people", label: "Talk to people who've lived something similar" },
  { id: "deep_research", label: "Go deep on research and comparisons" },
  { id: "move_fast", label: "Move fast based on instinct" },
  { id: "sit_with_it", label: "Sit with it until something forces the call" },
  { id: "help_others_decide", label: "I usually end up helping others decide instead" },
];

const ASK_TYPES = [
  { id: "clarity", label: "Clarity", description: "confused between multiple right answers" },
  { id: "direction", label: "Direction", description: "need to decide what to do next" },
  { id: "opportunity", label: "Opportunity", description: "exploring what's possible" },
  { id: "pressure_testing", label: "Pressure testing", description: "validating a lean" },
  { id: "help_others", label: "Help others", description: "I've been here before" },
];

const LIVED_CONTEXTS = [
  { id: "hired_mid_senior", label: "Getting hired at a mid–senior level" },
  { id: "raising_capital", label: "Raising capital / pitching investors" },
  { id: "job_vs_startup", label: "Choosing between job vs startup" },
  { id: "career_switch", label: "Switching careers or functions" },
  { id: "building_product", label: "Building a product from zero" },
  { id: "hiring_early", label: "Hiring early team members" },
  { id: "decision_paralysis", label: "Navigating long decision paralysis" },
];

const HELP_STYLES = [
  { id: "practical_steps", label: "Practical steps" },
  { id: "big_picture", label: "Big-picture framing" },
  { id: "emotional_grounding", label: "Emotional grounding" },
  { id: "brutal_truth", label: "Brutal truth" },
  { id: "pattern_recognition", label: "Pattern recognition" },
];

const DECISION_WEIGHTS = [
  { id: "light", label: "Light", description: "just exploring" },
  { id: "medium", label: "Medium", description: "affects next few months" },
  { id: "heavy", label: "Heavy", description: "could change my trajectory" },
  { id: "very_heavy", label: "Very heavy", description: "impacts other people too" },
];

const CONTEXT_CONSTRAINTS = [
  { id: "time_pressure", label: "Time pressure" },
  { id: "money_runway", label: "Money / runway" },
  { id: "location", label: "Location constraints" },
  { id: "confidence", label: "Confidence or self-doubt" },
  { id: "missing_info", label: "Missing information" },
  { id: "limited_network", label: "Limited network" },
];

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<OnboardingData>({
    decision_posture: "",
    ask_type: "",
    lived_context: [],
    followup_context: [],
    micro_reason: "",
    decision_weight: "",
    stakes_text: "",
    context_chips: [],
    open_help_text: "",
    help_style: "",
  });

  const getProgressPercent = () => {
    return Math.round((step / 6) * 100);
  };

  const handleNext = useCallback(() => {
    if (step < 6) {
      setStep((s) => (s + 1) as Step);
    } else {
      onComplete(data);
    }
  }, [step, data, onComplete]);

  const toggleArrayItem = (field: "lived_context" | "followup_context" | "context_chips", item: string) => {
    setData((prev) => {
      const arr = prev[field];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter((i) => i !== item) };
      } else {
        return { ...prev, [field]: [...arr, item] };
      }
    });
  };

  const getFollowupPrompt = () => {
    switch (data.ask_type) {
      case "clarity":
        return "Which past fork is bleeding into your current confusion?";
      case "direction":
        return "Which experience are you trying to project forward from?";
      case "opportunity":
        return "Which of these feels like an unfinished thread for you?";
      case "pressure_testing":
        return "Which experience has already shaped your current lean?";
      case "help_others":
        return "Which of these could you speak about without polishing the story?";
      default:
        return "Which of these are relevant to your current situation?";
    }
  };

  const showMicroReason = data.ask_type === "clarity" || data.ask_type === "pressure_testing";
  const getMicroReasonPlaceholder = () => {
    if (data.ask_type === "clarity") return "What makes this hard to decide?";
    if (data.ask_type === "pressure_testing") return "What did you learn the hard way?";
    return "";
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!data.decision_posture;
      case 2: return !!data.ask_type;
      case 3: return data.lived_context.length > 0;
      case 4: return !!data.decision_weight;
      case 5: return true; // Optional
      case 6: return true;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Progress indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${getProgressPercent()}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {step} of 6
        </span>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Screen 1 - Decision Posture */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                When a decision actually matters, what do you tend to do first?
              </h2>
            </div>

            <RadioGroup
              value={data.decision_posture}
              onValueChange={(val) => setData((prev) => ({ ...prev, decision_posture: val }))}
              className="space-y-3"
            >
              {DECISION_POSTURES.map((posture) => (
                <div
                  key={posture.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.decision_posture === posture.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, decision_posture: posture.id }))}
                >
                  <RadioGroupItem value={posture.id} id={posture.id} />
                  <Label htmlFor={posture.id} className="flex-1 cursor-pointer font-medium">
                    {posture.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

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

        {/* Screen 2 - The Ask */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What are you checking in for right now?
              </h2>
              <p className="text-sm text-muted-foreground">
                This doesn't lock you into anything.
              </p>
            </div>

            <RadioGroup
              value={data.ask_type}
              onValueChange={(val) => setData((prev) => ({ ...prev, ask_type: val }))}
              className="space-y-3"
            >
              {ASK_TYPES.map((ask) => (
                <div
                  key={ask.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.ask_type === ask.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, ask_type: ask.id }))}
                >
                  <RadioGroupItem value={ask.id} id={ask.id} />
                  <Label htmlFor={ask.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{ask.label}</span>
                    <span className="text-muted-foreground"> — {ask.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

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

        {/* Screen 3 - Lived Context */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6 max-h-[80vh] overflow-y-auto"
          >
            {/* 3A - Base Question */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                Which of these have you already lived through?
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps us know who you can help — and who can help you.
              </p>
            </div>

            <div className="space-y-2">
              {LIVED_CONTEXTS.map((ctx) => (
                <div
                  key={ctx.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.lived_context.includes(ctx.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => toggleArrayItem("lived_context", ctx.id)}
                >
                  <Checkbox
                    checked={data.lived_context.includes(ctx.id)}
                    onCheckedChange={() => toggleArrayItem("lived_context", ctx.id)}
                  />
                  <Label className="flex-1 cursor-pointer font-medium">{ctx.label}</Label>
                </div>
              ))}
            </div>

            {/* 3B - Conditional Follow-Up */}
            {data.lived_context.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4 pt-4 border-t border-border"
              >
                <h3 className="text-lg font-medium">{getFollowupPrompt()}</h3>
                <div className="space-y-2">
                  {LIVED_CONTEXTS.map((ctx) => (
                    <div
                      key={`followup-${ctx.id}`}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        data.followup_context.includes(ctx.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      onClick={() => toggleArrayItem("followup_context", ctx.id)}
                    >
                      <Checkbox
                        checked={data.followup_context.includes(ctx.id)}
                        onCheckedChange={() => toggleArrayItem("followup_context", ctx.id)}
                      />
                      <Label className="flex-1 cursor-pointer text-sm">{ctx.label}</Label>
                    </div>
                  ))}
                </div>

                {showMicroReason && (
                  <Textarea
                    value={data.micro_reason}
                    onChange={(e) => setData((prev) => ({ ...prev, micro_reason: e.target.value }))}
                    placeholder={getMicroReasonPlaceholder()}
                    className="min-h-[60px] text-sm rounded-xl border-2 resize-none"
                  />
                )}

                {/* Help Style for "Help Others" */}
                {data.ask_type === "help_others" && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      How do you usually help best?
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {HELP_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setData((prev) => ({ ...prev, help_style: style.id }))}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            data.help_style === style.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 3C - Universal Optional */}
            <div className="pt-4 border-t border-border">
              <Textarea
                value={data.open_help_text}
                onChange={(e) => setData((prev) => ({ ...prev, open_help_text: e.target.value }))}
                placeholder="Anything here you'd want to be useful to others about? (optional)"
                className="min-h-[80px] text-sm rounded-xl border-2 resize-none"
              />
            </div>

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

        {/* Screen 4 - Decision Weight */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                How much does this decision change things if you get it wrong?
              </h2>
            </div>

            <RadioGroup
              value={data.decision_weight}
              onValueChange={(val) => setData((prev) => ({ ...prev, decision_weight: val }))}
              className="space-y-3"
            >
              {DECISION_WEIGHTS.map((weight) => (
                <div
                  key={weight.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.decision_weight === weight.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, decision_weight: weight.id }))}
                >
                  <RadioGroupItem value={weight.id} id={weight.id} />
                  <Label htmlFor={weight.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{weight.label}</span>
                    <span className="text-muted-foreground"> — {weight.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {(data.decision_weight === "heavy" || data.decision_weight === "very_heavy") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Textarea
                  value={data.stakes_text}
                  onChange={(e) => setData((prev) => ({ ...prev, stakes_text: e.target.value }))}
                  placeholder="What's at stake if this goes wrong? (optional)"
                  className="min-h-[80px] text-sm rounded-xl border-2 resize-none"
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

        {/* Screen 5 - Context Amplifier */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What constraints might distort advice right now?
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {CONTEXT_CONSTRAINTS.map((constraint) => (
                <button
                  key={constraint.id}
                  onClick={() => toggleArrayItem("context_chips", constraint.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    data.context_chips.includes(constraint.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {data.context_chips.includes(constraint.id) && (
                    <Check className="w-3 h-3 inline mr-1" />
                  )}
                  {constraint.label}
                </button>
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-12 font-semibold rounded-xl"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Screen 6 - Close */}
        {step === 6 && (
          <motion.div
            key="step6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center space-y-8"
          >
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">
                Thanks for checking in.
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p>We don't match on titles.</p>
                <p>We match on forks already crossed.</p>
              </div>
              <div className="pt-4 space-y-2 text-sm text-muted-foreground/80">
                <p>Some conversations are fast.</p>
                <p>Some change how you think.</p>
                <p className="pt-2 font-medium text-foreground">We'll respect both.</p>
              </div>
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-14 text-lg font-semibold rounded-xl"
            >
              Enter ChekInn
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
