import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Sparkles, Heart, Zap, Target, Users, Lightbulb, Shield, Clock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import confetti from "canvas-confetti";

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
  // Ask-Specific Depth Inputs
  depth_input_1: string;
  depth_input_2: string;
  depth_input_3: string;
}

interface OnboardingFlowProps {
  onComplete: (data: OnboardingData) => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// Step configuration for progress display
const STEP_CONFIG = [
  { id: 1, icon: Lightbulb, label: "Mindset" },
  { id: 2, icon: Target, label: "Intent" },
  { id: 3, icon: Users, label: "Experience" },
  { id: 4, icon: Zap, label: "Details" },
  { id: 5, icon: Heart, label: "Stakes" },
  { id: 6, icon: Shield, label: "Context" },
  { id: 7, icon: Sparkles, label: "Ready" },
];

// Celebration messages for transitions
const CELEBRATION_MESSAGES = [
  "Nice! You think things through 🧠",
  "Got it! Let's find your people ✨",
  "Love that honesty 💪",
  "Perfect, almost there! 🎯",
  "This is helpful 🙌",
  "Last one, you're doing great! 🚀",
];

const DECISION_POSTURES = [
  { id: "talk_to_people", label: "Talk to people who've been there", emoji: "🗣️" },
  { id: "deep_research", label: "Go deep on research first", emoji: "📚" },
  { id: "move_fast", label: "Trust my gut and move fast", emoji: "⚡" },
  { id: "sit_with_it", label: "Let it marinate until clarity hits", emoji: "🧘" },
  { id: "help_others_decide", label: "Help others before deciding for myself", emoji: "🤝" },
];

const ASK_TYPES = [
  { id: "clarity", label: "Clarity", description: "too many good options, brain is stuck", emoji: "🌀" },
  { id: "direction", label: "Direction", description: "what should I actually do next?", emoji: "🧭" },
  { id: "opportunity", label: "Opportunity", description: "exploring what's even possible", emoji: "🔮" },
  { id: "pressure_testing", label: "Pressure testing", description: "I have a lean, poke holes in it", emoji: "🎯" },
  { id: "help_others", label: "Here to give back", description: "I've lived this, happy to share", emoji: "💫" },
];

const LIVED_CONTEXTS = [
  { id: "hired_mid_senior", label: "Getting hired at a mid–senior level", emoji: "💼" },
  { id: "raising_capital", label: "Raising capital / pitching investors", emoji: "💰" },
  { id: "job_vs_startup", label: "Choosing between job vs startup", emoji: "🔀" },
  { id: "career_switch", label: "Switching careers or functions", emoji: "🔄" },
  { id: "building_product", label: "Building a product from zero", emoji: "🛠️" },
  { id: "hiring_early", label: "Hiring early team members", emoji: "👥" },
  { id: "decision_paralysis", label: "Navigating long decision paralysis", emoji: "😵‍💫" },
];

const HELP_STYLES = [
  { id: "practical_steps", label: "Practical steps", emoji: "📋" },
  { id: "big_picture", label: "Big-picture framing", emoji: "🖼️" },
  { id: "emotional_grounding", label: "Emotional grounding", emoji: "🫂" },
  { id: "brutal_truth", label: "Brutal truth", emoji: "💊" },
  { id: "pattern_recognition", label: "Pattern recognition", emoji: "🔍" },
];

const DECISION_WEIGHTS = [
  { id: "light", label: "Light", description: "just poking around", emoji: "🍃" },
  { id: "medium", label: "Medium", description: "affects the next few months", emoji: "⚖️" },
  { id: "heavy", label: "Heavy", description: "could shift my whole trajectory", emoji: "🏔️" },
  { id: "very_heavy", label: "Very heavy", description: "impacts people beyond me", emoji: "🌊" },
];

const CONTEXT_CONSTRAINTS = [
  { id: "time_pressure", label: "Time pressure", emoji: "⏰" },
  { id: "money_runway", label: "Money / runway", emoji: "💸" },
  { id: "location", label: "Location constraints", emoji: "📍" },
  { id: "confidence", label: "Confidence or self-doubt", emoji: "🎭" },
  { id: "missing_info", label: "Missing information", emoji: "❓" },
  { id: "limited_network", label: "Limited network", emoji: "🔗" },
];

// Ask-Specific Depth Input configurations
interface DepthInputConfig {
  trigger: (askType: string, livedContext: string[]) => boolean;
  title: string;
  subtitle: string;
  prompts: {
    prompt: string;
    placeholder: string;
    required: boolean;
  }[];
}

const DEPTH_INPUT_CONFIGS: DepthInputConfig[] = [
  {
    trigger: (askType, livedContext) =>
      ["clarity", "direction", "pressure_testing"].includes(askType) &&
      livedContext.includes("hired_mid_senior"),
    title: "Let's get specific about your search 🎯",
    subtitle: "A few words is enough — this helps us find the right people.",
    prompts: [
      {
        prompt: "What kind of role are you eyeing?",
        placeholder: "e.g. Growth, Product, Ops, GM, Founding team",
        required: true,
      },
      {
        prompt: "What's non-negotiable this time around?",
        placeholder: "e.g. ownership, learning curve, manager quality, comp",
        required: true,
      },
      {
        prompt: "What burned you last time that you're avoiding now?",
        placeholder: "A few words is enough",
        required: false,
      },
    ],
  },
  {
    trigger: (askType, livedContext) =>
      ["pressure_testing", "direction"].includes(askType) &&
      livedContext.includes("raising_capital"),
    title: "Tell us about your raise 💰",
    subtitle: "We'll find people who've been exactly here.",
    prompts: [
      {
        prompt: "What are you really trying to raise for?",
        placeholder: "e.g. validation, hiring, speed, credibility",
        required: true,
      },
      {
        prompt: "What's your biggest doubt going in?",
        placeholder: "e.g. timing, traction, story, myself",
        required: true,
      },
      {
        prompt: "What would make this feel like a win, even if it's small?",
        placeholder: "A few words is enough",
        required: false,
      },
    ],
  },
  {
    trigger: (askType, livedContext) =>
      ["clarity", "pressure_testing"].includes(askType) &&
      (livedContext.includes("job_vs_startup") || livedContext.includes("hiring_early")),
    title: "About partnerships 🤝",
    subtitle: "Finding the right people to build with is everything.",
    prompts: [
      {
        prompt: "What gap are you hoping a partner fills?",
        placeholder: "e.g. execution, vision, sales, emotional load",
        required: true,
      },
      {
        prompt: "What's a deal-breaker for you?",
        placeholder: "A few words is enough",
        required: true,
      },
      {
        prompt: "Any past mistake you're trying not to repeat?",
        placeholder: "A few words is enough",
        required: false,
      },
    ],
  },
  {
    trigger: (askType, livedContext) =>
      ["pressure_testing", "opportunity"].includes(askType) &&
      livedContext.includes("building_product"),
    title: "About your product 🛠️",
    subtitle: "Let's understand where you are.",
    prompts: [
      {
        prompt: "Who is this for right now?",
        placeholder: "Describe your user in a few words",
        required: true,
      },
      {
        prompt: "What kind of feedback do you want most?",
        placeholder: "e.g. brutal honesty, PMF signal, usability",
        required: true,
      },
      {
        prompt: "What would make you pivot after these conversations?",
        placeholder: "A few words is enough",
        required: false,
      },
    ],
  },
  {
    trigger: (askType, livedContext) =>
      ["direction", "pressure_testing"].includes(askType) &&
      livedContext.includes("hired_mid_senior"),
    title: "About your interview 💼",
    subtitle: "Let's find people who know this company/role.",
    prompts: [
      {
        prompt: "What role or team are you interviewing for?",
        placeholder: "A few words is enough",
        required: true,
      },
      {
        prompt: "What do you most want clarity on before saying yes?",
        placeholder: "e.g. expectations, politics, growth, reality vs JD",
        required: true,
      },
      {
        prompt: "What would make you walk away even with an offer?",
        placeholder: "A few words is enough",
        required: false,
      },
    ],
  },
];

// Step gradient backgrounds
const STEP_GRADIENTS = [
  "from-blue-50/50 via-transparent to-transparent",
  "from-purple-50/50 via-transparent to-transparent",
  "from-amber-50/50 via-transparent to-transparent",
  "from-emerald-50/50 via-transparent to-transparent",
  "from-rose-50/50 via-transparent to-transparent",
  "from-cyan-50/50 via-transparent to-transparent",
  "from-violet-50/50 via-transparent to-transparent",
];

// Time estimates per step
const TIME_ESTIMATES: Record<number, string> = {
  1: "~2 min",
  2: "~90 sec",
  3: "~1 min",
  4: "~45 sec",
  5: "~30 sec",
  6: "~15 sec",
  7: "Done!",
};

// Confetti trigger function
const triggerConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

// Playful progress component
const PlayfulProgress = ({ currentStep, totalSteps, hasDepthInputs }: { 
  currentStep: number; 
  totalSteps: number;
  hasDepthInputs: boolean;
}) => {
  const visibleSteps = hasDepthInputs 
    ? STEP_CONFIG 
    : STEP_CONFIG.filter(s => s.id !== 4);

  const timeEstimate = TIME_ESTIMATES[currentStep] || "";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-2">
        {visibleSteps.map((stepConfig, index) => {
          const adjustedCurrent = hasDepthInputs 
            ? currentStep 
            : currentStep > 3 ? currentStep + 1 : currentStep;
          
          const isCompleted = adjustedCurrent > stepConfig.id;
          const isCurrent = adjustedCurrent === stepConfig.id;
          const Icon = stepConfig.icon;

          return (
            <motion.div
              key={stepConfig.id}
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted 
                    ? "bg-primary text-primary-foreground" 
                    : isCurrent 
                      ? "bg-primary/20 text-primary border-2 border-primary" 
                      : "bg-muted text-muted-foreground"
                }`}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </motion.div>
              <span className={`text-[10px] mt-1 font-medium ${
                isCurrent ? "text-primary" : "text-muted-foreground"
              }`}>
                {stepConfig.label}
              </span>
            </motion.div>
          );
        })}
      </div>
      {/* Time estimate */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Clock className="w-3 h-3" />
        <span>{timeEstimate}</span>
      </motion.div>
    </div>
  );
};

// Celebration toast component
const CelebrationToast = ({ message, show }: { message: string; show: boolean }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg font-medium text-sm z-50"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Recap Card component for final step
const RecapCard = ({ data }: { data: OnboardingData }) => {
  const getAskLabel = () => ASK_TYPES.find(a => a.id === data.ask_type)?.label || "";
  const getPostureEmoji = () => DECISION_POSTURES.find(p => p.id === data.decision_posture)?.emoji || "";
  const getWeightLabel = () => DECISION_WEIGHTS.find(w => w.id === data.decision_weight)?.label || "";
  const getLivedContextEmojis = () => data.lived_context.map(id => 
    LIVED_CONTEXTS.find(c => c.id === id)?.emoji || ""
  ).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-muted/50 rounded-2xl p-5 space-y-3 text-left w-full max-w-sm mx-auto"
    >
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your context snapshot</h4>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Looking for</span>
          <span className="text-sm font-medium">{getAskLabel()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Decision style</span>
          <span className="text-lg">{getPostureEmoji()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Stakes</span>
          <span className="text-sm font-medium">{getWeightLabel()}</span>
        </div>
        {data.lived_context.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Experience</span>
            <span className="text-lg">{getLivedContextEmojis()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [step, setStep] = useState<Step>(1);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
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
    depth_input_1: "",
    depth_input_2: "",
    depth_input_3: "",
  });

  // Get the active depth input config based on current selections
  const getActiveDepthConfig = (): DepthInputConfig | null => {
    for (const config of DEPTH_INPUT_CONFIGS) {
      if (config.trigger(data.ask_type, data.lived_context)) {
        return config;
      }
    }
    return null;
  };

  const activeDepthConfig = getActiveDepthConfig();
  const hasDepthInputs = activeDepthConfig !== null;

  const getTotalSteps = () => (hasDepthInputs ? 7 : 6);

  // Show celebration when step changes
  const triggerCelebration = (stepNum: number) => {
    if (stepNum > 1 && stepNum <= 7) {
      setCelebrationMessage(CELEBRATION_MESSAGES[Math.min(stepNum - 2, CELEBRATION_MESSAGES.length - 1)]);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
  };

  const handleNext = useCallback(() => {
    const totalSteps = hasDepthInputs ? 7 : 6;
    if (step < totalSteps) {
      // If we're on step 3 and there are no depth inputs, skip step 4
      const nextStep = step === 3 && !hasDepthInputs ? 5 : step + 1;
      triggerCelebration(nextStep);
      if (step === 3 && !hasDepthInputs) {
        setStep(5 as Step);
      } else {
        setStep((s) => (s + 1) as Step);
      }
    } else {
      onComplete(data);
    }
  }, [step, data, onComplete, hasDepthInputs]);

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
        return "Which past fork still haunts your current confusion?";
      case "direction":
        return "Which experience are you trying to project forward from?";
      case "opportunity":
        return "Which of these feels like an unfinished thread?";
      case "pressure_testing":
        return "Which experience already shaped your current lean?";
      case "help_others":
        return "Which of these could you speak about without polishing the story?";
      default:
        return "Which of these are relevant right now?";
    }
  };

  const showMicroReason = data.ask_type === "clarity" || data.ask_type === "pressure_testing";
  const getMicroReasonPlaceholder = () => {
    if (data.ask_type === "clarity") return "What makes this genuinely hard to decide?";
    if (data.ask_type === "pressure_testing") return "What did you learn the hard way?";
    return "";
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!data.decision_posture;
      case 2: return !!data.ask_type;
      case 3: return data.lived_context.length > 0;
      case 4: {
        if (!activeDepthConfig) return true;
        const requiredPrompts = activeDepthConfig.prompts.filter(p => p.required);
        const inputs = [data.depth_input_1, data.depth_input_2, data.depth_input_3];
        return requiredPrompts.every((_, idx) => inputs[idx]?.trim().length > 0);
      }
      case 5: return !!data.decision_weight;
      case 6: return true;
      case 7: return true;
      default: return true;
    }
  };

  const getDisplayStep = () => {
    if (!hasDepthInputs && step >= 5) {
      return step - 1;
    }
    return step;
  };

  // Trigger confetti on final step
  useEffect(() => {
    if (step === 7) {
      setTimeout(() => {
        triggerConfetti();
      }, 300);
    }
  }, [step]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-all duration-500 bg-gradient-to-br ${STEP_GRADIENTS[step - 1] || STEP_GRADIENTS[0]}`}>
      {/* Celebration Toast */}
      <CelebrationToast message={celebrationMessage} show={showCelebration} />

      {/* Playful Progress indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-10"
      >
        <PlayfulProgress 
          currentStep={step} 
          totalSteps={getTotalSteps()} 
          hasDepthInputs={hasDepthInputs}
        />
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
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                🤔
              </motion.div>
              <h2 className="text-2xl font-semibold">
                Hey! When a decision really matters, what do you usually do first?
              </h2>
              <p className="text-muted-foreground">
                No wrong answers — this just helps us understand how you think.
              </p>
            </div>

            <RadioGroup
              value={data.decision_posture}
              onValueChange={(val) => setData((prev) => ({ ...prev, decision_posture: val }))}
              className="space-y-3"
            >
              {DECISION_POSTURES.map((posture, index) => (
                <motion.div
                  key={posture.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <div
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      data.decision_posture === posture.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setData((prev) => ({ ...prev, decision_posture: posture.id }))}
                  >
                    <span className="text-xl">{posture.emoji}</span>
                    <RadioGroupItem value={posture.id} id={posture.id} className="hidden" />
                    <Label htmlFor={posture.id} className="flex-1 cursor-pointer font-medium">
                      {posture.label}
                    </Label>
                    {data.decision_posture === posture.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </RadioGroup>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: canProceed() ? 1 : 0.5 }}
              className="pt-2"
            >
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-full h-12 font-semibold rounded-xl group"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
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
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                ✨
              </motion.div>
              <h2 className="text-2xl font-semibold">
                What brings you to ChekInn today?
              </h2>
              <p className="text-muted-foreground">
                This helps us match you with the right people. You can always change your mind later!
              </p>
            </div>

            <RadioGroup
              value={data.ask_type}
              onValueChange={(val) => setData((prev) => ({ ...prev, ask_type: val }))}
              className="space-y-3"
            >
              {ASK_TYPES.map((ask, index) => (
                <motion.div
                  key={ask.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <div
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      data.ask_type === ask.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setData((prev) => ({ ...prev, ask_type: ask.id }))}
                  >
                    <span className="text-xl">{ask.emoji}</span>
                    <RadioGroupItem value={ask.id} id={ask.id} className="hidden" />
                    <Label htmlFor={ask.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{ask.label}</span>
                      <span className="text-muted-foreground text-sm block">{ask.description}</span>
                    </Label>
                    {data.ask_type === ask.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </RadioGroup>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl group"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
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
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                🎒
              </motion.div>
              <h2 className="text-2xl font-semibold">
                What have you already lived through?
              </h2>
              <p className="text-muted-foreground">
                This helps us know who can help you — and who you can help.
              </p>
            </div>

            <div className="space-y-2">
              {LIVED_CONTEXTS.map((ctx, index) => (
                <motion.div
                  key={ctx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                >
                  <div
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      data.lived_context.includes(ctx.id)
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleArrayItem("lived_context", ctx.id)}
                  >
                    <span className="text-xl">{ctx.emoji}</span>
                    <Checkbox
                      checked={data.lived_context.includes(ctx.id)}
                      onCheckedChange={() => toggleArrayItem("lived_context", ctx.id)}
                      className="hidden"
                    />
                    <Label className="flex-1 cursor-pointer font-medium">{ctx.label}</Label>
                    {data.lived_context.includes(ctx.id) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Conditional Follow-Up */}
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
                      <span className="text-lg">{ctx.emoji}</span>
                      <Checkbox
                        checked={data.followup_context.includes(ctx.id)}
                        onCheckedChange={() => toggleArrayItem("followup_context", ctx.id)}
                        className="hidden"
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
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                            data.help_style === style.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          <span>{style.emoji}</span>
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Universal Optional */}
            <div className="pt-4 border-t border-border">
              <Textarea
                value={data.open_help_text}
                onChange={(e) => setData((prev) => ({ ...prev, open_help_text: e.target.value }))}
                placeholder="Anything you'd want to be useful to others about? (optional)"
                className="min-h-[80px] text-sm rounded-xl border-2 resize-none"
              />
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl group"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        )}

        {/* Screen 4 - Ask-Specific Depth Inputs (Conditional) */}
        {step === 4 && activeDepthConfig && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                🔍
              </motion.div>
              <h2 className="text-2xl font-semibold">
                {activeDepthConfig.title}
              </h2>
              <p className="text-muted-foreground">
                {activeDepthConfig.subtitle}
              </p>
            </div>

            <div className="space-y-5">
              {activeDepthConfig.prompts.map((promptConfig, idx) => {
                const inputKey = `depth_input_${idx + 1}` as keyof OnboardingData;
                const value = data[inputKey] as string;

                return (
                  <motion.div
                    key={idx}
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.1 }}
                  >
                    <Label className="text-sm font-medium">
                      {promptConfig.prompt}
                      {promptConfig.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      value={value}
                      onChange={(e) => setData((prev) => ({ ...prev, [inputKey]: e.target.value }))}
                      placeholder={promptConfig.placeholder}
                      className="h-12 rounded-xl border-2"
                    />
                  </motion.div>
                );
              })}
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl group"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        )}

        {/* Screen 5 - Decision Weight */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                ⚖️
              </motion.div>
              <h2 className="text-2xl font-semibold">
                How big is this decision, really?
              </h2>
              <p className="text-muted-foreground">
                This helps us calibrate how seriously to take the conversation.
              </p>
            </div>

            <RadioGroup
              value={data.decision_weight}
              onValueChange={(val) => setData((prev) => ({ ...prev, decision_weight: val }))}
              className="space-y-3"
            >
              {DECISION_WEIGHTS.map((weight, index) => (
                <motion.div
                  key={weight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <div
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      data.decision_weight === weight.id
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setData((prev) => ({ ...prev, decision_weight: weight.id }))}
                  >
                    <span className="text-xl">{weight.emoji}</span>
                    <RadioGroupItem value={weight.id} id={weight.id} className="hidden" />
                    <Label htmlFor={weight.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{weight.label}</span>
                      <span className="text-muted-foreground text-sm block">{weight.description}</span>
                    </Label>
                    {data.decision_weight === weight.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </RadioGroup>

            {(data.decision_weight === "heavy" || data.decision_weight === "very_heavy") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Textarea
                  value={data.stakes_text}
                  onChange={(e) => setData((prev) => ({ ...prev, stakes_text: e.target.value }))}
                  placeholder="What's at stake if this goes sideways? (optional but helpful)"
                  className="min-h-[80px] text-sm rounded-xl border-2 resize-none"
                />
              </motion.div>
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full h-12 font-semibold rounded-xl group"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        )}

        {/* Screen 6 - Context Amplifier */}
        {step === 6 && (
          <motion.div
            key="step6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-6"
          >
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="text-4xl mb-4"
              >
                🎯
              </motion.div>
              <h2 className="text-2xl font-semibold">
                Any constraints shaping your thinking?
              </h2>
              <p className="text-muted-foreground">
                Select any that apply — or skip if none feel relevant.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {CONTEXT_CONSTRAINTS.map((constraint, index) => (
                <motion.button
                  key={constraint.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                  onClick={() => toggleArrayItem("context_chips", constraint.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    data.context_chips.includes(constraint.id)
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <span>{constraint.emoji}</span>
                  {constraint.label}
                </motion.button>
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="w-full h-12 font-semibold rounded-xl group"
            >
              {data.context_chips.length === 0 ? "Skip for now" : "Continue"}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        )}

        {/* Screen 7 - Close */}
        {step === 7 && (
          <motion.div
            key="step7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center space-y-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="text-6xl mb-2"
            >
              🎉
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-semibold"
            >
              You're all set!
            </motion.h2>

            {/* Recap Card */}
            <RecapCard data={data} />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-2 text-sm text-muted-foreground"
            >
              <p>We don't match on titles or resumes.</p>
              <p className="font-medium text-foreground">We match on forks already crossed. ✨</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-14 text-lg font-semibold rounded-xl group"
              >
                Enter ChekInn
                <Sparkles className="w-5 h-5 ml-2 group-hover:rotate-12 transition-transform" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
