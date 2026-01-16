import { motion } from "framer-motion";
import { Sparkles, Target, Lightbulb } from "lucide-react";

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
  onViewMatches: () => void;
}

const WelcomeGreeting = ({ userName, onboardingContext, aiInsights, onViewMatches }: WelcomeGreetingProps) => {
  const firstName = userName?.split(' ')[0];
  const depthInput1 = onboardingContext?.depth_input_1;
  const depthInput2 = onboardingContext?.depth_input_2;
  
  // Get AI-generated insights if available
  const profileSummary = aiInsights?.profileSummary;
  const hasAiSummary = profileSummary?.narrative || profileSummary?.seeking;

  // Build personalized understanding text
  const buildUnderstandingText = () => {
    if (profileSummary?.narrative) {
      // Use AI-generated narrative (truncate if too long)
      const narrative = profileSummary.narrative;
      return narrative.length > 200 ? narrative.substring(0, 200) + '...' : narrative;
    }
    
    // Fallback to depth inputs
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
      className="max-w-[88%]"
    >
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

        {/* What they're seeking - from AI or depth_input_2 */}
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

        {/* CTA */}
        <div className="pt-2 border-t border-primary/10">
          <p className="text-xs text-muted-foreground">
            I'm finding the right person who's been exactly where you are. 
            <button 
              onClick={onViewMatches}
              className="text-primary font-medium ml-1 hover:underline"
            >
              Check matches →
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default WelcomeGreeting;
