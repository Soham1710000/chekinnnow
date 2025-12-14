import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const emailSchema = z.string().email("Please enter a valid email");

export const AuthFlow = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [intent, setIntent] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [hasStartedAuth, setHasStartedAuth] = useState(false);
  const { trackEvent } = useFunnelTracking();

  // Track when user starts typing (first interaction with auth form)
  useEffect(() => {
    if ((email || password) && !hasStartedAuth) {
      setHasStartedAuth(true);
      trackEvent("auth_start", { mode: isSignUp ? "signup" : "signin" });
    }
  }, [email, password, hasStartedAuth, isSignUp, trackEvent]);

  const handleEmailAuth = async () => {
    try {
      emailSchema.parse(email);
    } catch {
      toast.error("Please enter a valid email");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/waitlist`,
            data: {
              connection_intent: intent || null,
            },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Email already registered. Please sign in instead.");
            setIsSignUp(false);
          } else {
            throw error;
          }
        } else {
          trackEvent("auth_complete", { mode: "signup" });
          toast.success("Account created successfully!");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        trackEvent("auth_complete", { mode: "signin" });
        toast.success("Signed in successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isSignUp ? "Join Now" : "Welcome back"}
        </h2>
        <p className="text-gray-600">
          {isSignUp ? "Enter your email to secure your spot" : "Sign in to continue"}
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-14 text-lg rounded-xl border-2"
          onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 text-lg rounded-xl border-2"
          onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
        />
        {isSignUp && (
          <div className="space-y-1.5">
            <Input
              type="text"
              placeholder="Who do you want to connect with? (optional)"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="h-14 text-lg rounded-xl border-2"
              onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
            />
            <p className="text-xs text-gray-400 text-center">
              It's fine — we can always figure this out later
            </p>
          </div>
        )}
        <Button
          onClick={handleEmailAuth}
          disabled={loading}
          className="w-full h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSignUp ? "Sign Up" : "Sign In"}
        </Button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </div>
    </motion.div>
  );
};
