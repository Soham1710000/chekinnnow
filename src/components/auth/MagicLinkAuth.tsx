import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Sparkles, Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email");

interface MagicLinkAuthProps {
  onSuccess?: () => void;
  onBack?: () => void;
  showPasswordFallback?: boolean;
}

const MagicLinkAuth = ({ onSuccess, onBack, showPasswordFallback = true }: MagicLinkAuthProps) => {
  const { toast } = useToast();
  const { trackEvent } = useFunnelTracking();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const hasTrackedStart = useRef(false);

  // Track when user starts typing
  useEffect(() => {
    if (email && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      trackEvent("auth_start", { mode: "magic_link" });
    }
  }, [email, trackEvent]);

  const handleMagicLink = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
        },
      });

      if (error) throw error;

      setSent(true);
      trackEvent("auth_magic_link_sent", { email });
      
      toast({
        title: "Check your inbox! 📬",
        description: "Click the magic link to sign in instantly.",
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

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse(email);
      
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
    } catch (err: any) {
      toast({
        title: "Validation Error",
        description: err.message || err.errors?.[0]?.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Try signing in.",
              variant: "destructive",
            });
            setIsSignUp(false);
            setLoading(false);
            return;
          }
          throw error;
        }

        trackEvent("auth_complete", { mode: "signup", email });
        toast({
          title: "You're in! 🎉",
          description: "Let's get to know you.",
        });
        onSuccess?.();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        trackEvent("auth_complete", { mode: "signin", email });
        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: isSignUp ? "Sign up failed" : "Sign in failed",
        description: error.message,
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
        className="text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
        <p className="text-muted-foreground mb-4">
          We sent a magic link to <span className="font-medium text-foreground">{email}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Click the link in your email to sign in instantly. No password needed!
        </p>
        
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="mt-6 text-sm text-primary hover:underline"
        >
          Use a different email
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm"
    >
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      )}

      {/* Quick step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            {usePassword ? "30 seconds" : "No password needed"}
          </span>
        </div>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {usePassword 
            ? (isSignUp ? "Quick step to get intros" : "Welcome back")
            : "Save your progress"
          }
        </h1>
        <p className="text-muted-foreground text-sm">
          {usePassword
            ? (isSignUp 
                ? "Just an email so we can notify you when we find someone" 
                : "Sign in to see your intros")
            : "Enter your email — we'll send you a magic link to continue"
          }
        </p>
      </div>

      {usePassword ? (
        <form onSubmit={handlePasswordAuth} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              required
              className="pl-10 h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
            />
          </div>

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "Create a password" : "Your password"}
            required
            minLength={6}
            className="h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
          />
          {isSignUp && (
            <p className="text-xs text-muted-foreground text-center">Min 6 characters</p>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold rounded-xl" 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              "Get Started →"
            ) : (
              "Sign In"
            )}
          </Button>

          <div className="text-center space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "Already signed up? Sign in" : "New here? Sign up"}
            </button>
            <br />
            <button
              type="button"
              onClick={() => setUsePassword(false)}
              className="text-sm text-primary hover:underline"
            >
              Use magic link instead
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              required
              className="pl-10 h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold rounded-xl" 
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Send Magic Link →"
            )}
          </Button>

          {showPasswordFallback && (
            <button
              type="button"
              onClick={() => setUsePassword(true)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              Use password instead
            </button>
          )}
        </form>
      )}

      <p className="mt-6 text-xs text-center text-muted-foreground/70">
        No spam. We only reach out when we find a match.
      </p>
    </motion.div>
  );
};

export default MagicLinkAuth;
