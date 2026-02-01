import { Progress } from "@/components/ui/progress";
import { Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";

interface LearningProgressProps {
  messageCount: number;
  maxMessages?: number;
  learningComplete: boolean;
}

const LearningProgress = ({ messageCount, maxMessages = 5, learningComplete }: LearningProgressProps) => {
  const progress = Math.min((messageCount / maxMessages) * 100, 100);
  
  // Don't show if learning is complete
  if (learningComplete) return null;
  
  // Don't show until user has sent at least 1 message
  if (messageCount === 0) return null;

  const getMessage = () => {
    if (progress >= 100) return "Ready to find you intros!";
    if (progress >= 60) return "Almost there...";
    if (progress >= 40) return "Getting to know you...";
    return "Learning about you...";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20"
    >
      <div className="flex items-center gap-2 mb-2">
        {progress >= 100 ? (
          <Search className="w-4 h-4 text-primary animate-pulse" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
        <span className="text-sm font-medium text-foreground">{getMessage()}</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1.5">
        {progress >= 100 
          ? "We'll match you with the right people soon" 
          : `${Math.ceil(maxMessages - messageCount)} more question${maxMessages - messageCount !== 1 ? 's' : ''} to find your intros`
        }
      </p>
    </motion.div>
  );
};

export default LearningProgress;
