import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail, Shield, Lock, User } from "lucide-react";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";

const Auth = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { trackEvent, trackPageView } = useFunnelTracking();
  const hasTrackedPageView = useRef(false);
  
  const [loading, setLoading] = useState(false);
  const [processingCallback, setProcessingCallback] = useState(false);
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Track page view once
  useEffect(() => {
    if (!hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackPageView();
    }
  }, [trackPageView]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast({
        title: "Authentication failed",
        description: error === 'access_denied' 
          ? "Gmail access is required for email signals. You can still use email/password."
          : "Something went wrong. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (code && !processingCallback) {
      handleOAuthCallback(code);
    }
  }, [searchParams]);

  // Redirect logged-in users
  useEffect(() => {
    if (!authLoading && user && !processingCallback) {
      navigate("/chat");
    }
  }, [user, authLoading, navigate, processingCallback]);

  const handleOAuthCallback = async (code: string) => {
    setProcessingCallback(true);
    setLoading(true);

    try {
      const redirectUri = `${window.location.origin}/auth`;

      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        body: {
          action: 'callback',
          code,
          redirect_uri: redirectUri,
        },
      });

      if (error) {
        throw error;
      }

      const { email } = data as { userId: string; email: string };

      // Sign in with OTP (magic link)
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/chat`,
        }
      });

      trackEvent("auth_complete", { mode: "gmail_oauth", email });
      
      toast({
        title: "Check your email",
        description: "Click the link in your email to complete sign in.",
      });

      window.history.replaceState({}, document.title, '/auth');

    } catch (error: any) {
      console.error('[Auth] OAuth callback error:', error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect Gmail. Try email/password instead.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessingCallback(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
            data: {
              full_name: fullName,
            }
          }
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
            throw error;
          }
          return;
        }

        trackEvent("auth_complete", { mode: "email_signup", email });
        toast({
          title: "Account created!",
          description: "You're now signed in.",
        });
        navigate("/chat");

      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login")) {
            toast({
              title: "Invalid credentials",
              description: "Email or password is incorrect.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        trackEvent("auth_complete", { mode: "email_signin", email });
        navigate("/chat");
      }

    } catch (error: any) {
      console.error('[Auth] Email auth error:', error);
      toast({
        title: "Something went wrong",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGmailSignIn = async () => {
    setLoading(true);
    trackEvent("auth_start", { mode: "gmail_oauth" });

    try {
      const redirectUri = `${window.location.origin}/auth`;
      
      const authUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth`);
      authUrl.searchParams.set('action', 'authorize');
      authUrl.searchParams.set('redirect_uri', redirectUri);

      const authResponse = await fetch(authUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        }
      });

      const authData = await authResponse.json();

      if (authData.error) {
        throw new Error(authData.error);
      }

      window.location.href = authData.authUrl;

    } catch (error: any) {
      console.error('[Auth] Error starting OAuth:', error);
      toast({
        title: "Something went wrong",
        description: error.message || "Failed to start authentication. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (authLoading || processingCallback) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          {processingCallback ? "Connecting your Gmail..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4">
        <button 
          onClick={() => mode === "email" ? setMode("choose") : navigate("/")} 
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
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-3">ChekInn</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {mode === "choose" ? (
                <>
                  We quietly watch for signals—<br />
                  flights, interviews, events, transitions—<br />
                  and nudge you when something matters.
                </>
              ) : isSignUp ? (
                "Create your account to get started"
              ) : (
                "Welcome back!"
              )}
            </p>
          </div>

          {mode === "choose" ? (
            <>
              {/* Gmail Sign-In Button */}
              <Button 
                onClick={handleGmailSignIn}
                className="w-full h-14 text-base font-semibold rounded-xl gap-3 mb-4"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    Continue with Gmail
                  </>
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Email Sign-In Button */}
              <Button 
                onClick={() => setMode("email")}
                variant="outline"
                className="w-full h-14 text-base font-semibold rounded-xl gap-3"
                disabled={loading}
              >
                <User className="w-5 h-5" />
                Continue with Email
              </Button>

              {/* Trust indicators */}
              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <p>Read-only access. We never send emails or modify anything.</p>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <p>Encrypted storage. Your tokens are secure and never exposed.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Email/Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <Input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12 rounded-xl"
                    required
                  />
                )}
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl"
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl"
                  minLength={6}
                  required
                />
                <Button 
                  type="submit"
                  className="w-full h-14 text-base font-semibold rounded-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button 
                      onClick={() => setIsSignUp(false)}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button 
                      onClick={() => setIsSignUp(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </p>
            </>
          )}

          {/* Fine print */}
          <p className="mt-8 text-xs text-center text-muted-foreground/70 leading-relaxed">
            {mode === "choose" ? (
              <>Gmail gives us context for smarter intros.<br />Email works too—just without signal extraction.</>
            ) : (
              <>By continuing, you agree to our terms of service.</>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
