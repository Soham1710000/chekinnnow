import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles } from "lucide-react";

interface Introduction {
  id: string;
  intro_message: string;
  other_user?: {
    full_name: string;
    avatar_url: string;
    bio: string;
    role: string;
  };
}

interface IntroCardProps {
  introduction: Introduction;
  onAccept: () => void;
  onDecline: () => void;
}

const IntroCard = ({ introduction, onAccept, onDecline }: IntroCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 max-w-[90%]"
    >
      <div className="flex items-center gap-2 text-primary mb-4">
        <Sparkles className="w-5 h-5" />
        <span className="font-semibold text-sm">New Introduction</span>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold shrink-0">
          {introduction.other_user?.full_name?.charAt(0) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">
            {introduction.other_user?.full_name || "Someone special"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {introduction.other_user?.role || "ChekInn member"}
          </p>
          {introduction.other_user?.bio && (
            <p className="text-sm mt-2 text-foreground/80 line-clamp-2">
              {introduction.other_user.bio}
            </p>
          )}
        </div>
      </div>

      <div className="bg-background/50 rounded-xl p-3 mb-4">
        <p className="text-sm text-muted-foreground mb-1">Why you should connect:</p>
        <p className="text-sm">{introduction.intro_message}</p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onDecline}
          variant="outline"
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          Pass
        </Button>
        <Button
          onClick={onAccept}
          className="flex-1"
        >
          <Check className="w-4 h-4 mr-2" />
          Connect
        </Button>
      </div>
    </motion.div>
  );
};

export default IntroCard;
