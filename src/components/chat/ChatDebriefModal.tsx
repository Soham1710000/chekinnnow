import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Sparkles, ThumbsUp, Meh, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  introductionId: string;
  otherUserName: string;
  userId: string;
  onComplete: () => void;
}

type ChatQuality = "great" | "okay" | "not_helpful";

const ChatDebriefModal = ({
  isOpen,
  onClose,
  introductionId,
  otherUserName,
  userId,
  onComplete,
}: ChatDebriefModalProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<"quality" | "learnings" | "again">(
    "quality"
  );
  const [chatQuality, setChatQuality] = useState<ChatQuality | null>(null);
  const [whatLearned, setWhatLearned] = useState("");
  const [wouldChatAgain, setWouldChatAgain] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const handleQualitySelect = (quality: ChatQuality) => {
    setChatQuality(quality);
    setStep("learnings");
  };

  const handleLearningsSubmit = () => {
    setStep("again");
  };

  const handleComplete = async () => {
    setSaving(true);

    try {
      const { error } = await supabase.from("chat_debriefs").insert({
        user_id: userId,
        introduction_id: introductionId,
        chat_quality: chatQuality,
        what_learned: whatLearned || null,
        would_chat_again: wouldChatAgain,
        rating: chatQuality === "great" ? 5 : chatQuality === "okay" ? 3 : 1,
      });

      if (error) {
        console.error("Error saving debrief:", error);
        toast({
          title: "Couldn't save",
          description: "Try again later",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Thanks for the feedback!",
          description: "This helps us make better connections",
        });
        onComplete();
      }
    } catch (e) {
      console.error("Error:", e);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleSkip}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Quick Debrief</h2>
            </div>
            <button
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === "quality" && (
              <motion.div
                key="quality"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-center text-muted-foreground">
                  How was your chat with{" "}
                  <span className="text-foreground font-medium">
                    {otherUserName}
                  </span>
                  ?
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleQualitySelect("great")}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <ThumbsUp className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Great!</span>
                  </button>
                  <button
                    onClick={() => handleQualitySelect("okay")}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <Meh className="w-8 h-8 text-yellow-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Okay</span>
                  </button>
                  <button
                    onClick={() => handleQualitySelect("not_helpful")}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <ThumbsDown className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Not helpful</span>
                  </button>
                </div>

                <button
                  onClick={handleSkip}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  Skip for now
                </button>
              </motion.div>
            )}

            {step === "learnings" && (
              <motion.div
                key="learnings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-center text-muted-foreground">
                  What did you learn from this conversation?
                </p>

                <Textarea
                  placeholder="Any insights, tips, or takeaways... (optional)"
                  value={whatLearned}
                  onChange={(e) => setWhatLearned(e.target.value)}
                  className="min-h-[100px] resize-none"
                />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("quality")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button onClick={handleLearningsSubmit} className="flex-1">
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "again" && (
              <motion.div
                key="again"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-center text-muted-foreground">
                  Would you chat with{" "}
                  <span className="text-foreground font-medium">
                    {otherUserName}
                  </span>{" "}
                  again?
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setWouldChatAgain(true)}
                    className={`p-4 rounded-xl border transition-all ${
                      wouldChatAgain === true
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <span className="text-2xl">👍</span>
                    <p className="text-sm font-medium mt-1">Yes!</p>
                  </button>
                  <button
                    onClick={() => setWouldChatAgain(false)}
                    className={`p-4 rounded-xl border transition-all ${
                      wouldChatAgain === false
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    <span className="text-2xl">👎</span>
                    <p className="text-sm font-medium mt-1">Probably not</p>
                  </button>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep("learnings")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={wouldChatAgain === null || saving}
                    className="flex-1"
                  >
                    {saving ? "Saving..." : "Done"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatDebriefModal;
