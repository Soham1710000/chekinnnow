import { motion } from "framer-motion";
import { Sparkles, Target, Lightbulb, Clock } from "lucide-react";

interface OnboardingContext {
  ask_type?: string;
  lived_context?: string[];
  decision_weight?: string;
  context_chips?: string[];
  depth_input_1?: string;
  depth_input_2?: string;
  depth_input_3?: string;
}

interface ProfileSummary {
  headline?: string;
  narrative?: string;
  seeking?: string;
  decisionContext?: string;
}

interface AiInsights {
  profileSummary?: ProfileSummary;
}

interface WelcomeGreetingProps {
  userName?: string;
  onboardingContext?: OnboardingContext;
  aiInsights?: AiInsights;
}

const WelcomeGreeting = ({ userName, onboardingContext, aiInsights }: WelcomeGreetingProps) => {
  const firstName = userName?.split(' ')[0];
  const depthInput1 = onboardingContext?.depth_input_1;
  const depthInput2 = onboardingContext?.depth_input_2;
  
  // Get AI-generated insights if available
  const profileSummary = aiInsights?.profileSummary;

  // Build personalized understanding text
  const buildUnderstandingText = () => {
    if (profileSummary?.narrative) {
      const narrative = profileSummary.narrative;
      return narrative.length > 200 ? narrative.substring(0, 200) + '...' : narrative;
    }
    
    if (depthInput1) {
      return depthInput1;
    }
    
    return null;
  };

  const understandingText = buildUnderstandingText();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[88%] space-y-3"
    >
      {/* Main greeting card */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/8 to-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="font-semibold text-primary">
            Hey{firstName ? `, ${firstName}` : ''}! I'm Chek.
          </p>
        </div>

        {/* What we understand */}
        {understandingText && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Target className="w-3.5 h-3.5" />
              <span>What I understand about your situation</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed pl-5">
              "{understandingText}"
            </p>
          </div>
        )}

        {/* What they're seeking */}
        {(profileSummary?.seeking || depthInput2) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>What would help most</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed pl-5">
              {profileSummary?.seeking || depthInput2}
            </p>
          </div>
        )}
      </div>

      {/* Finding match card */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-r from-emerald-500/5 to-green-500/5 border border-emerald-500/20 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Finding your match
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              We're matching you with someone who's been exactly where you are. 
              Expect an update within 12-24 hours — it'll appear right here in chat.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WelcomeGreeting;
