import { motion } from "framer-motion";
import { MessageCircle, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

interface WhatsAppCommunityNudgeProps {
  onDismiss: () => void;
  variant?: "inline" | "compact";
}

const WA_COMMUNITY_LINK = "https://chat.whatsapp.com/KCJZhd1QrkLBnIDmcZQCUr";

const WhatsAppCommunityNudge = ({ onDismiss, variant = "inline" }: WhatsAppCommunityNudgeProps) => {
  const { trackEvent } = useFunnelTracking();

  const handleJoin = () => {
    trackEvent("wa_community_clicked" as any);
    window.open(WA_COMMUNITY_LINK, "_blank");
  };

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 mt-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs text-foreground truncate">
              Join our WA community for updates
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleJoin}
            className="bg-[#25D366] hover:bg-[#1da851] text-white text-xs px-3 h-7 flex-shrink-0"
          >
            Join
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-br from-[#25D366]/10 to-[#128C7E]/15 border border-[#25D366]/25 rounded-2xl p-4"
    >
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">Stay in the loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Join our WhatsApp community — we share match updates, success stories & take feedback
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Users className="w-3.5 h-3.5" />
        <span>500+ UPSC aspirants already joined</span>
      </div>

      <Button 
        onClick={handleJoin}
        className="w-full h-10 rounded-xl font-medium bg-[#25D366] hover:bg-[#1da851] text-white"
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        Join WhatsApp Community
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

export default WhatsAppCommunityNudge;
