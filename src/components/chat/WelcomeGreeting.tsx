import { motion } from "framer-motion";
import { Sparkles, Users, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OnboardingContext {
  ask_type?: string;
  lived_context?: string[];
  decision_weight?: string;
  context_chips?: string[];
  depth_input_1?: string;
  depth_input_2?: string;
  depth_input_3?: string;
}

interface WelcomeGreetingProps {
  userName?: string;
  onboardingContext?: OnboardingContext;
  onViewMatches: () => void;
}

const ASK_LABELS: Record<string, string> = {
  clarity: "seeking clarity",
  direction: "figuring out direction",
  opportunity: "exploring opportunities",
  pressure_testing: "pressure testing a decision",
  help_others: "helping others navigate",
};

const LIVED_CONTEXT_LABELS: Record<string, string> = {
  hired_mid_senior: "mid-senior hiring",
  raising_capital: "fundraising",
  job_vs_startup: "job vs startup decisions",
  career_switch: "career switching",
  building_product: "building from zero",
  hiring_early: "early team building",
  decision_paralysis: "decision paralysis",
};

const WelcomeGreeting = ({ userName, onboardingContext, onViewMatches }: WelcomeGreetingProps) => {
  const askType = onboardingContext?.ask_type;
  const livedContexts = onboardingContext?.lived_context || [];
  const depthInput1 = onboardingContext?.depth_input_1;
  const depthInput2 = onboardingContext?.depth_input_2;

  // Build a summary of what we captured
  const buildAskSummary = () => {
    const parts: string[] = [];
    
    if (askType && ASK_LABELS[askType]) {
      parts.push(ASK_LABELS[askType]);
    }
    
    // Add depth inputs if available
    if (depthInput1) {
      parts.push(depthInput1);
    }
    
    return parts.join(" — ");
  };

  const buildContextSummary = () => {
    const relevantContexts = livedContexts
      .filter(ctx => LIVED_CONTEXT_LABELS[ctx])
      .map(ctx => LIVED_CONTEXT_LABELS[ctx])
      .slice(0, 2);
    
    return relevantContexts.join(" and ");
  };

  const askSummary = buildAskSummary();
  const contextSummary = buildContextSummary();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 max-w-[90%]"
    >
      {/* Main greeting card */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-primary mb-4">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-sm">Hey{userName ? `, ${userName.split(' ')[0]}` : ''}! I'm Chek.</span>
        </div>

        <div className="space-y-3 text-sm">
          {/* What we captured */}
          {askSummary && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-lg">🎯</span>
              </div>
              <div>
                <p className="font-medium text-foreground">What you're working through</p>
                <p className="text-muted-foreground">{askSummary}</p>
              </div>
            </div>
          )}

          {/* Non-negotiable if captured */}
          {depthInput2 && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-lg">🔒</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Your non-negotiable</p>
                <p className="text-muted-foreground">{depthInput2}</p>
              </div>
            </div>
          )}

          {/* Context they've lived */}
          {contextSummary && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-lg">📍</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Experience you bring</p>
                <p className="text-muted-foreground">You've navigated {contextSummary}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Match section nudge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-muted/50 border border-border rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Check relevant folks in the meantime</p>
            <p className="text-xs text-muted-foreground mt-1">
              While we find your ChekInn member match, browse people who might be helpful.
            </p>
            <Button 
              variant="link" 
              size="sm" 
              className="h-auto p-0 mt-2 text-primary"
              onClick={onViewMatches}
            >
              View Match Section →
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ChekInn member match nudge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border border-green-500/20 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Finding your ChekInn member match</p>
            <p className="text-xs text-muted-foreground mt-1">
              We're matching you with a verified ChekInn member who's been exactly where you are. 
              Expect an email within 24 hours — the match will also appear here in chat.
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-700 dark:text-green-300">
              <Clock className="w-3 h-3" />
              <span>Usually within 12-24 hours</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WelcomeGreeting;
