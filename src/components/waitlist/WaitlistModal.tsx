import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWaitlist } from "@/hooks/useWaitlist";
import { AuthFlow } from "./AuthFlow";
import { WaitlistSuccess } from "./WaitlistSuccess";
import { useEffect, useState } from "react";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string | null;
}

export const WaitlistModal = ({ isOpen, onClose, referralCode }: WaitlistModalProps) => {
  const { user, loading: authLoading } = useAuth();
  const { entry, loading: waitlistLoading, createWaitlistEntry } = useWaitlist();
  const [isCreating, setIsCreating] = useState(false);
  const { trackEvent } = useFunnelTracking();

  // Track modal open
  useEffect(() => {
    if (isOpen) {
      trackEvent("modal_open", { referral: referralCode });
    }
  }, [isOpen, referralCode, trackEvent]);

  // Auto-create waitlist entry when user authenticates
  useEffect(() => {
    const createEntry = async () => {
      if (user && !entry && !waitlistLoading && !isCreating) {
        setIsCreating(true);
        await createWaitlistEntry(referralCode || undefined);
        setIsCreating(false);
        trackEvent("waitlist_success", { referral: referralCode });
      }
    };
    createEntry();
  }, [user, entry, waitlistLoading, referralCode]);

  const showLoading = authLoading || waitlistLoading || isCreating;
  const showAuth = !user && !showLoading;
  const showSuccess = user && entry && !showLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Content */}
            <div className="p-8">
              {showLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {showAuth && <AuthFlow />}

              {showSuccess && <WaitlistSuccess entry={entry} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
