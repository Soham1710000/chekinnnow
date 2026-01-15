import { motion } from "framer-motion";
import { Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExternalMatchNudgeProps {
  matchCount?: number;
  onViewMatches: () => void;
}

const ExternalMatchNudge = ({ matchCount = 0, onViewMatches }: ExternalMatchNudgeProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 my-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-foreground mb-1">
            {matchCount > 0 
              ? `Found ${matchCount} potential connections!`
              : "We found some matches for you!"}
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            While we match you with ChekInn members (usually within 24 hours), 
            here are some people outside our network who might be great to connect with.
          </p>
          <Button 
            size="sm" 
            variant="outline"
            onClick={onViewMatches}
            className="bg-background/50 hover:bg-background"
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            View Matches
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ExternalMatchNudge;
