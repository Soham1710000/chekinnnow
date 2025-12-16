import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { z } from "zod";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackEvent, trackPageView } = useFunnelTracking();
  const hasTrackedAuthStart = useRef(false);
  
  const [isSignUp, setIsSignUp] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    try {
      const response = await supabase.functions.invoke("send-temp-password", {
        body: { email },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Check your email",
        description: "We sent you a temporary password.",
      });
      setIsForgotPassword(false);
      setIsSignUp(false); // Switch to sign-in mode
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send temporary password",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  // Track page view
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  // Track auth_start when user begins typing
  useEffect(() => {
    if ((email || password) && !hasTrackedAuthStart.current) {
      hasTrackedAuthStart.current = true;
      trackEvent("auth_start", { mode: isSignUp ? "signup" : "signin" });
    }
  }, [email, password, isSignUp, trackEvent]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/chat");
    }
  }, [user, authLoading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

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
            description: "This email is already registered. Try signing in instead.",
            variant: "destructive",
          });
          setIsSignUp(false);
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }
      trackEvent("auth_complete", { mode: "signup", email });
      toast({
        title: "You're in! 🎉",
        description: "Let's get to know you.",
      });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      trackEvent("auth_complete", { mode: "signin", email });
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4">
        <button 
          onClick={() => navigate("/")} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Quick step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">30 seconds</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-3">
              {isForgotPassword 
                ? "Reset your password" 
                : isSignUp 
                  ? "Quick step to get intros" 
                  : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isForgotPassword
                ? "Enter your email and we'll send you a reset link"
                : isSignUp 
                  ? "Just an email so we can nudge you when we find someone great for you to meet" 
                  : "Sign in to see your intros"}
            </p>
          </div>

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                required
                className="h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold rounded-xl mt-2" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send Temporary Password"
                )}
              </Button>

              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-3">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  required
                  className="h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
                />

                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  minLength={6}
                  className="h-12 text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
                />
                <p className="text-xs text-muted-foreground text-center">Min 6 characters — we keep it simple</p>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold rounded-xl mt-2" 
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
              </form>

              <div className="mt-6 text-center space-y-3">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:underline transition-colors block mx-auto"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isSignUp 
                    ? "Already signed up? Sign in" 
                    : "New here? Sign up"}
                </button>
              </div>

              {/* Trust indicator */}
              {isSignUp && (
                <p className="mt-8 text-xs text-center text-muted-foreground/70">
                  No spam. We only reach out when we find a match.
                </p>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
