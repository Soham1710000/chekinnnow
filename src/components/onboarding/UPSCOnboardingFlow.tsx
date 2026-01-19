import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface UPSCOnboardingData {
  // Step 1: Current Stage
  current_stage: string;
  // Step 2: What's happening
  current_struggle: string;
  // Step 3: What they've tried
  tried_before: string[];
  tried_details: string;
  // Step 4: Specific challenge
  specific_challenge: string;
  // Step 5: What help looks like
  help_style: string;
  help_details: string;
  // Step 6: Constraints
  constraints: string[];
}

interface UPSCOnboardingFlowProps {
  onComplete: (data: UPSCOnboardingData) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const CURRENT_STAGES = [
  { id: "just_starting", label: "Just starting out", description: "exploring if UPSC is right for me" },
  { id: "first_attempt", label: "Preparing for first attempt", description: "building foundation" },
  { id: "prelims_focused", label: "Prelims focused", description: "next exam is my target" },
  { id: "mains_prep", label: "Mains preparation", description: "cleared prelims or close" },
  { id: "interview_stage", label: "Interview stage", description: "personality test prep" },
  { id: "re_attempting", label: "Re-attempting", description: "learning from previous attempts" },
  { id: "working_professional", label: "Working + preparing", description: "balancing job and prep" },
];

const CURRENT_STRUGGLES = [
  { id: "where_to_start", label: "Where to even start?", description: "feeling overwhelmed by the vastness" },
  { id: "optional_selection", label: "Optional subject confusion", description: "can't decide what to pick" },
  { id: "answer_writing", label: "Answer writing", description: "know content but can't express" },
  { id: "time_management", label: "Time management", description: "can't cover syllabus in time" },
  { id: "motivation", label: "Motivation dipping", description: "losing steam after months of prep" },
  { id: "prelims_anxiety", label: "Prelims anxiety", description: "mock scores not improving" },
  { id: "mains_depth", label: "Mains depth", description: "don't know how deep to go" },
  { id: "interview_prep", label: "Interview preparation", description: "personality test nerves" },
  { id: "life_balance", label: "Life balance", description: "everything else falling apart" },
];

const TRIED_BEFORE = [
  { id: "coaching", label: "Joined coaching" },
  { id: "self_study", label: "Self-study from books/YouTube" },
  { id: "test_series", label: "Test series" },
  { id: "study_groups", label: "Study groups" },
  { id: "mentors", label: "Talked to mentors/seniors" },
  { id: "answer_writing_practice", label: "Answer writing practice" },
  { id: "current_affairs", label: "Daily current affairs routine" },
  { id: "nothing_yet", label: "Haven't started properly yet" },
];

const HELP_STYLES = [
  { id: "roadmap", label: "Clear roadmap", description: "step by step what to do" },
  { id: "honest_feedback", label: "Honest feedback", description: "brutal truth about where I stand" },
  { id: "emotional_support", label: "Emotional support", description: "someone who gets the pressure" },
  { id: "strategy_tweaks", label: "Strategy tweaks", description: "small changes to what I'm doing" },
  { id: "peer_conversation", label: "Peer conversation", description: "talk to someone at same stage" },
  { id: "insider_perspective", label: "Insider perspective", description: "talk to someone who cleared" },
];

const CONSTRAINTS = [
  { id: "time", label: "Limited time left" },
  { id: "money", label: "Financial constraints" },
  { id: "family_pressure", label: "Family pressure" },
  { id: "no_guidance", label: "No proper guidance" },
  { id: "health", label: "Health/stress issues" },
  { id: "job_balance", label: "Balancing with job" },
  { id: "location", label: "Location disadvantage" },
  { id: "attempts_running_out", label: "Attempts running out" },
];

const UPSCOnboardingFlow = ({ onComplete }: UPSCOnboardingFlowProps) => {
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<UPSCOnboardingData>({
    current_stage: "",
    current_struggle: "",
    tried_before: [],
    tried_details: "",
    specific_challenge: "",
    help_style: "",
    help_details: "",
    constraints: [],
  });

  const totalSteps = 6;
  const getProgressPercent = () => Math.round((step / totalSteps) * 100);

  const handleNext = useCallback(() => {
    if (step < totalSteps) {
      setStep((s) => (s + 1) as Step);
    } else {
      onComplete(data);
    }
  }, [step, data, onComplete]);

  const toggleArrayItem = (field: "tried_before" | "constraints", item: string) => {
    setData((prev) => {
      const arr = prev[field];
      if (arr.includes(item)) {
        return { ...prev, [field]: arr.filter((i) => i !== item) };
      } else {
        return { ...prev, [field]: [...arr, item] };
      }
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!data.current_stage;
      case 2: return !!data.current_struggle;
      case 3: return data.tried_before.length > 0;
      case 4: return data.specific_challenge.trim().length > 10;
      case 5: return !!data.help_style;
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
            className="h-full bg-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${getProgressPercent()}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {step} of {totalSteps}
        </span>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* Step 1 - Current Stage */}
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
                Where are you in your UPSC journey?
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps us connect you with the right people.
              </p>
            </div>

            <RadioGroup
              value={data.current_stage}
              onValueChange={(val) => setData((prev) => ({ ...prev, current_stage: val }))}
              className="space-y-3"
            >
              {CURRENT_STAGES.map((stage) => (
                <div
                  key={stage.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.current_stage === stage.id
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, current_stage: stage.id }))}
                >
                  <RadioGroupItem value={stage.id} id={stage.id} className="text-orange-500" />
                  <Label htmlFor={stage.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{stage.label}</span>
                    <span className="text-muted-foreground"> — {stage.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2 - Current Struggle */}
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
                What's the biggest thing on your mind right now?
              </h2>
            </div>

            <RadioGroup
              value={data.current_struggle}
              onValueChange={(val) => setData((prev) => ({ ...prev, current_struggle: val }))}
              className="space-y-2 max-h-[60vh] overflow-y-auto pr-2"
            >
              {CURRENT_STRUGGLES.map((struggle) => (
                <div
                  key={struggle.id}
                  className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    data.current_struggle === struggle.id
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, current_struggle: struggle.id }))}
                >
                  <RadioGroupItem value={struggle.id} id={struggle.id} className="text-orange-500" />
                  <Label htmlFor={struggle.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{struggle.label}</span>
                    <span className="text-muted-foreground text-sm"> — {struggle.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 3 - What they've tried */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                What have you tried so far?
              </h2>
              <p className="text-sm text-muted-foreground">
                Select all that apply — this helps us understand where you are.
              </p>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {TRIED_BEFORE.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    data.tried_before.includes(item.id)
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => toggleArrayItem("tried_before", item.id)}
                >
                  <Checkbox
                    checked={data.tried_before.includes(item.id)}
                    onCheckedChange={() => toggleArrayItem("tried_before", item.id)}
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label className="flex-1 cursor-pointer font-medium">{item.label}</Label>
                </div>
              ))}
            </div>

            {data.tried_before.length > 0 && !data.tried_before.includes("nothing_yet") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Textarea
                  value={data.tried_details}
                  onChange={(e) => setData((prev) => ({ ...prev, tried_details: e.target.value }))}
                  placeholder="Anything specific that didn't work or felt missing? (optional)"
                  className="min-h-[80px] text-sm rounded-xl border-2 resize-none"
                />
              </motion.div>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 4 - Specific Challenge */}
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
                In your own words — what's the thing you need help with most?
              </h2>
              <p className="text-sm text-muted-foreground">
                Be as specific as you can. This helps us find someone who's been through exactly this.
              </p>
            </div>

            <Textarea
              value={data.specific_challenge}
              onChange={(e) => setData((prev) => ({ ...prev, specific_challenge: e.target.value }))}
              placeholder="e.g., I've been preparing for 8 months but my prelims mock scores are stuck at 80-85. I'm not sure if it's my current affairs or conceptual gaps in economy..."
              className="min-h-[150px] text-sm rounded-xl border-2 resize-none"
            />

            <p className="text-xs text-muted-foreground text-right">
              {data.specific_challenge.length < 20 ? "Keep going..." : "✓ Good detail"}
            </p>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 5 - What help looks like */}
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
                What kind of help would be most useful right now?
              </h2>
            </div>

            <RadioGroup
              value={data.help_style}
              onValueChange={(val) => setData((prev) => ({ ...prev, help_style: val }))}
              className="space-y-3"
            >
              {HELP_STYLES.map((style) => (
                <div
                  key={style.id}
                  className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    data.help_style === style.id
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setData((prev) => ({ ...prev, help_style: style.id }))}
                >
                  <RadioGroupItem value={style.id} id={style.id} className="text-orange-500" />
                  <Label htmlFor={style.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{style.label}</span>
                    <span className="text-muted-foreground"> — {style.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {data.help_style && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Textarea
                  value={data.help_details}
                  onChange={(e) => setData((prev) => ({ ...prev, help_details: e.target.value }))}
                  placeholder="Anything specific you'd want from this conversation? (optional)"
                  className="min-h-[60px] text-sm rounded-xl border-2 resize-none"
                />
              </motion.div>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 6 - Constraints & Close */}
        {step === 6 && (
          <motion.div
            key="step6"
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
                Select if any apply — helps us understand your situation better.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {CONSTRAINTS.map((constraint) => (
                <button
                  key={constraint.id}
                  onClick={() => toggleArrayItem("constraints", constraint.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    data.constraints.includes(constraint.id)
                      ? "bg-orange-500 text-white"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {data.constraints.includes(constraint.id) && (
                    <Check className="w-3 h-3 inline mr-1" />
                  )}
                  {constraint.label}
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-4 text-center">
              <p className="text-muted-foreground">
                We'll use this to find someone who understands your situation.
              </p>
              <p className="text-sm text-muted-foreground/80">
                Real conversations. No generic advice.
              </p>
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-14 text-lg font-semibold rounded-xl bg-orange-500 hover:bg-orange-600"
            >
              Start Conversation
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UPSCOnboardingFlow;
