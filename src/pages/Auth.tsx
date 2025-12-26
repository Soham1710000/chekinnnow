import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail, Shield, Lock } from "lucide-react";
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
          ? "Gmail access is required to use ChekInn."
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

      // Exchange code for tokens and create/update chekinn_user
      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        body: {
          action: 'callback',
          code,
          redirect_uri: redirectUri,
        },
      });

      if (error) throw error;

      const { userId: chekinnUserId, email } = data as { userId: string; email: string };

      // Sign in to Supabase Auth with a temp password (auto-generated)
      // First try to sign in, if fails, sign up
      let authError = null;
      const tempPassword = `ChekInn_${chekinnUserId.slice(0, 8)}!`;
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: tempPassword,
      });

      if (signInError) {
        // User doesn't exist, create them
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
            data: { chekinn_user_id: chekinnUserId }
          }
        });
        authError = signUpError;
      }

      if (authError) {
        console.error('[Auth] Auth error:', authError);
      }

      // Trigger email ingestion in background
      supabase.functions.invoke('gmail-ingest', {
        body: { userId: chekinnUserId }
      }).catch(err => console.error('[Auth] Ingestion error:', err));

      trackEvent("auth_complete", { mode: "gmail_oauth", email });
      
      toast({
        title: "Connected!",
        description: "Scanning your emails for signals...",
      });

      window.history.replaceState({}, document.title, '/auth');
      navigate("/chat");

    } catch (error: any) {
      console.error('[Auth] OAuth callback error:', error);
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect Gmail. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessingCallback(false);
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
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-3">ChekInn</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We quietly watch your Gmail for signals—<br />
              flights, interviews, events, transitions—<br />
              and nudge you when something matters.
            </p>
          </div>

          {/* Gmail Sign-In Button */}
          <Button 
            onClick={handleGmailSignIn}
            className="w-full h-14 text-base font-semibold rounded-xl gap-3"
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

          {/* Fine print */}
          <p className="mt-8 text-xs text-center text-muted-foreground/70 leading-relaxed">
            Gmail is the only way in.<br />
            We use it to understand your context—not to spam you.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
