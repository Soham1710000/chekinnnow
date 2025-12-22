import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface SaveProgressNudgeProps {
  onDismiss: () => void;
}

const SaveProgressNudge = ({ onDismiss }: SaveProgressNudgeProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="bg-gradient-to-br from-primary/5 to-primary/15 border border-primary/25 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Bookmark className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">Save your progress</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quick signup so we can save this chat and notify you when we find someone
          </p>
        </div>
      </div>

      <Button 
        onClick={() => navigate("/auth")}
        className="w-full h-10 rounded-xl font-medium"
      >
        Continue with Email →
      </Button>

      <button
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors w-full text-center"
      >
        Maybe later
      </button>
    </motion.div>
  );
};

export default SaveProgressNudge;
