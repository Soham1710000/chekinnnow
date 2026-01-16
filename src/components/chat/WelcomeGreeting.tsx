import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

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
  clarity: "clarity on a decision",
  direction: "direction on what's next",
  opportunity: "new opportunities",
  pressure_testing: "feedback on a decision",
  help_others: "ways to help others",
};

const LIVED_CONTEXT_LABELS: Record<string, string> = {
  hired_mid_senior: "hiring",
  raising_capital: "fundraising",
  job_vs_startup: "job vs startup",
  career_switch: "career transitions",
  building_product: "0→1 building",
  hiring_early: "early hiring",
  decision_paralysis: "tough decisions",
};

const WelcomeGreeting = ({ userName, onboardingContext, onViewMatches }: WelcomeGreetingProps) => {
  const askType = onboardingContext?.ask_type;
  const livedContexts = onboardingContext?.lived_context || [];
  const depthInput1 = onboardingContext?.depth_input_1;

  // Build a concise summary
  const buildSummary = () => {
    const parts: string[] = [];
    
    // What they're seeking
    if (askType && ASK_LABELS[askType]) {
      parts.push(`seeking ${ASK_LABELS[askType]}`);
    }
    
    // Their lived experience
    const relevantContexts = livedContexts
      .filter(ctx => LIVED_CONTEXT_LABELS[ctx])
      .map(ctx => LIVED_CONTEXT_LABELS[ctx])
      .slice(0, 2);
    
    if (relevantContexts.length > 0) {
      parts.push(`with experience in ${relevantContexts.join(" & ")}`);
    }
    
    return parts.join(", ");
  };

  const summary = buildSummary();
  const firstName = userName?.split(' ')[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[85%]"
    >
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm text-primary">
              Hey{firstName ? `, ${firstName}` : ''}! I'm Chek.
            </p>
            
            {summary && (
              <p className="text-sm text-muted-foreground">
                Got it — you're <span className="text-foreground font-medium">{summary}</span>.
              </p>
            )}
            
            {depthInput1 && (
              <p className="text-sm text-muted-foreground">
                Working through: <span className="text-foreground">"{depthInput1}"</span>
              </p>
            )}
            
            <p className="text-xs text-muted-foreground pt-1">
              Finding you the right person to talk to. Check the match tab for updates.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WelcomeGreeting;
