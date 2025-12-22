import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Linkedin, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";

const linkedinUrlSchema = z.string()
  .refine(val => val === '' || val.includes('linkedin.com'), {
    message: "Please enter a valid LinkedIn profile URL"
  });

interface LinkedInStepProps {
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export const LinkedInStep = ({ userId, onComplete, onSkip }: LinkedInStepProps) => {
  const { toast } = useToast();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkedinUrl.trim()) {
      onSkip();
      return;
    }

    try {
      linkedinUrlSchema.parse(linkedinUrl);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Invalid URL",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-linkedin', {
        body: { linkedinUrl, userId }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to import profile');
      }

      toast({
        title: "Profile imported! 🎉",
        description: "We found your professional details. This helps us make better matches.",
      });

      onComplete();
    } catch (error: any) {
      console.error('LinkedIn enrichment error:', error);
      toast({
        title: "Couldn't import profile",
        description: error.message || "We'll learn about you through conversation instead.",
        variant: "destructive",
      });
      // Still allow user to continue even if enrichment fails
      setTimeout(() => onSkip(), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm mx-auto"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Optional - saves time</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-[#0A66C2]/10 rounded-2xl flex items-center justify-center">
          <Linkedin className="w-8 h-8 text-[#0A66C2]" />
        </div>
        <h1 className="text-2xl font-bold mb-3">
          Speed up your profile
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Share your LinkedIn so we can learn about you faster and make better matches. Otherwise, we'll learn through conversation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="url"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="linkedin.com/in/yourprofile"
            className="h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors pl-11"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold rounded-xl"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Importing your profile...
            </>
          ) : linkedinUrl.trim() ? (
            <>
              Import & Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              Skip for now
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-xs text-center text-muted-foreground/70">
        We only read public profile info. Never post or connect.
      </p>
    </motion.div>
  );
};
