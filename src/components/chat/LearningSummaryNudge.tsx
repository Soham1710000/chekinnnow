import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LearningSummaryNudgeProps {
  userId: string;
  hasDebriefs: boolean;
  onDismiss: () => void;
}

interface LearningSummary {
  summary: string;
  keyLearnings: string[];
  totalChats: number;
}

const LearningSummaryNudge = ({
  userId,
  hasDebriefs,
  onDismiss,
}: LearningSummaryNudgeProps) => {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<LearningSummary | null>(null);

  const handleGenerateSummary = async () => {
    setExpanded(true);
    setLoading(true);

    try {
      // Fetch all debriefs for this user
      const { data: debriefs, error: debriefError } = await supabase
        .from("chat_debriefs")
        .select("what_learned, chat_quality, key_learnings, ai_summary")
        .eq("user_id", userId);

      if (debriefError) throw debriefError;

      // Fetch all user chat messages from connections
      const { data: userChats, error: chatError } = await supabase
        .from("user_chats")
        .select("content, sender_id")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: true })
        .limit(100);

      if (chatError) throw chatError;

      // Build context for summary
      const learnings = debriefs
        ?.filter((d) => d.what_learned)
        .map((d) => d.what_learned) || [];
      
      const existingSummaries = debriefs
        ?.filter((d) => d.ai_summary)
        .map((d) => d.ai_summary) || [];

      const chatContext = userChats
        ?.slice(-50)
        .map((c) => c.content)
        .join("\n") || "";

      // Call AI to generate summary
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-learnings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            userId,
            learnings,
            existingSummaries,
            chatContext,
            totalChats: debriefs?.length || 0,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate summary");
      }

      const data = await response.json();
      setSummary({
        summary: data.summary,
        keyLearnings: data.keyLearnings || [],
        totalChats: debriefs?.length || 0,
      });
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({
        title: "Couldn't generate summary",
        description: "Try again later",
        variant: "destructive",
      });
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  if (!hasDebriefs) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleGenerateSummary}
            className="w-full text-left"
          >
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 hover:border-amber-500/40 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Summarize my learnings
                  </p>
                  <p className="text-xs text-muted-foreground">
                    See what you've learned from your connections
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold">Your Learning Journey</h3>
              </div>
              <button
                onClick={() => {
                  setExpanded(false);
                  onDismiss();
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Analyzing your conversations...
                </p>
              </div>
            ) : summary ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  From{" "}
                  <span className="text-foreground font-medium">
                    {summary.totalChats} connection
                    {summary.totalChats !== 1 ? "s" : ""}
                  </span>
                </p>

                <p className="text-sm leading-relaxed">{summary.summary}</p>

                {summary.keyLearnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Key Takeaways
                    </p>
                    <ul className="space-y-2">
                      {summary.keyLearnings.map((learning, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{learning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExpanded(false);
                    onDismiss();
                  }}
                  className="w-full mt-2"
                >
                  Got it
                </Button>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LearningSummaryNudge;
