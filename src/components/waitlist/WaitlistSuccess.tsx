import { motion } from "framer-motion";
import { Copy, Check, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWaitlist } from "@/hooks/useWaitlist";

interface WaitlistEntry {
  id: string;
  waitlist_position: number;
  referral_code: string;
  referrals_count: number;
  access_granted: boolean;
}

interface WaitlistSuccessProps {
  entry: WaitlistEntry;
}

export const WaitlistSuccess = ({ entry }: WaitlistSuccessProps) => {
  const [copied, setCopied] = useState(false);
  const { spotsGained } = useWaitlist();
  
  const referralLink = `https://chekinn.app/waitlist?ref=${entry.referral_code}`;
  
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`Join me on ChekInn! Skip the line with my referral: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(`I'm on the ChekInn waitlist! Join me and skip the line: ${referralLink}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareOnInstagram = () => {
    // Instagram doesn't have a direct share URL, so we copy and notify
    navigator.clipboard.writeText(referralLink);
    toast.success("Link copied! Share it in your Instagram bio or story");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join ChekInn",
          text: "Skip the waitlist with my referral link!",
          url: referralLink,
        });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  if (entry.access_granted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 15, delay: 0.2 }}
          className="text-6xl mb-6"
        >
          🎉
        </motion.div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          You're in!
        </h2>
        <p className="text-lg text-gray-600">
          Early access unlocked. Welcome to ChekInn.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Success Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 15, delay: 0.1 }}
          className="text-5xl mb-4"
        >
          🎉
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          You're on the waitlist
        </h2>
      </div>

      {/* Position Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center py-8 bg-gray-50 rounded-2xl"
      >
        <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">
          Your current position
        </p>
        <motion.p
          key={entry.waitlist_position}
          initial={{ scale: 1.2, color: "#22c55e" }}
          animate={{ scale: 1, color: "#111827" }}
          className="text-6xl font-bold"
        >
          #{entry.waitlist_position}
        </motion.p>
      </motion.div>

      {/* Referral Boost Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white"
      >
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl">🚀</span>
          <div>
            <h3 className="font-bold text-lg">Move up the waitlist</h3>
            <p className="text-gray-300 text-sm">
              Invite friends. Each signup moves you up faster.
            </p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-2">Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm truncate">{referralLink}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyLink}
              className="shrink-0 text-white hover:bg-white/20"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={shareOnWhatsApp}
            className="bg-[#25D366] hover:bg-[#20bd5a] text-white border-0 rounded-xl h-12"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            WhatsApp
          </Button>
          <Button
            onClick={shareOnTwitter}
            className="bg-black hover:bg-gray-800 text-white border-0 rounded-xl h-12"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            X / Twitter
          </Button>
          <Button
            onClick={shareOnInstagram}
            className="bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#FCAF45] hover:opacity-90 text-white border-0 rounded-xl h-12"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            Instagram
          </Button>
          <Button
            onClick={shareNative}
            className="bg-gray-600 hover:bg-gray-500 text-white border-0 rounded-xl h-12"
          >
            <Share2 className="w-5 h-5 mr-2" />
            More
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-4"
      >
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{entry.referrals_count}</p>
          <p className="text-sm text-gray-500">Referrals</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-600">+{spotsGained}</p>
          <p className="text-sm text-gray-500">Spots gained</p>
        </div>
      </motion.div>

      {/* Unlock hint */}
      <p className="text-center text-sm text-gray-500">
        Top 500 or 7+ referrals unlocks early access
      </p>
    </motion.div>
  );
};
