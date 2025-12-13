import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWaitlist } from "@/hooks/useWaitlist";
import { AuthFlow } from "@/components/waitlist/AuthFlow";
import { WaitlistSuccess } from "@/components/waitlist/WaitlistSuccess";
import { motion } from "framer-motion";

const Waitlist = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { entry, loading: waitlistLoading, createWaitlistEntry } = useWaitlist();
  const [isCreating, setIsCreating] = useState(false);

  // Store referral code from URL
  const referralCode = searchParams.get("ref");
  
  useEffect(() => {
    if (referralCode) {
      sessionStorage.setItem("waitlist_ref", referralCode);
    }
  }, [referralCode]);

  // Auto-create waitlist entry when user authenticates
  useEffect(() => {
    const createEntry = async () => {
      if (user && !entry && !waitlistLoading && !isCreating) {
        setIsCreating(true);
        const storedRef = sessionStorage.getItem("waitlist_ref");
        await createWaitlistEntry(storedRef || undefined);
        sessionStorage.removeItem("waitlist_ref");
        setIsCreating(false);
      }
    };
    createEntry();
  }, [user, entry, waitlistLoading]);

  const showLoading = authLoading || waitlistLoading || isCreating;
  const showAuth = !user && !showLoading;
  const showSuccess = user && entry && !showLoading;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ChekInn</h1>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          {showLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {showAuth && <AuthFlow />}

          {showSuccess && <WaitlistSuccess entry={entry} />}
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-900 text-sm font-medium"
          >
            ← Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Waitlist;
