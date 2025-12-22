import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Loader2, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email");

interface SaveProgressNudgeProps {
  sessionId: string;
  onEmailCaptured: (email: string) => void;
  onDismiss: () => void;
}

const SaveProgressNudge = ({ sessionId, onEmailCaptured, onDismiss }: SaveProgressNudgeProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Invalid email",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      // Send magic link
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
        },
      });

      if (authError) throw authError;

      // Update lead with email
      await supabase
        .from("leads")
        .update({ 
          extracted_insights: { email, captured_at: new Date().toISOString() }
        })
        .eq("session_id", sessionId);

      setSent(true);
      onEmailCaptured(email);
      
      toast({
        title: "Check your inbox! 📬",
        description: "Click the link to save your progress & get matched.",
      });
    } catch (error: any) {
      toast({
        title: "Couldn't send link",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-green-700 dark:text-green-400">Link sent to {email}</p>
            <p className="text-sm text-muted-foreground">Check your inbox to continue</p>
          </div>
        </div>
      </motion.div>
    );
  }

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
            Drop your email — we'll save this chat and notify you when we find someone
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="pl-9 h-10 text-sm rounded-xl"
              required
            />
          </div>
          <Button 
            type="submit" 
            disabled={loading || !email.trim()}
            className="h-10 px-4 rounded-xl font-medium"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save →"
            )}
          </Button>
        </div>
      </form>

      <button
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
      >
        Maybe later
      </button>
    </motion.div>
  );
};

export default SaveProgressNudge;
