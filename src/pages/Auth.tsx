import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFunnelTracking } from "@/hooks/useFunnelTracking";
import { Loader2, ArrowLeft } from "lucide-react";
import MagicLinkAuth from "@/components/auth/MagicLinkAuth";

const Auth = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { trackPageView } = useFunnelTracking();

  // Track page view
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/chat");
    }
  }, [user, authLoading, navigate]);

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
        <MagicLinkAuth 
          onSuccess={() => navigate("/chat")}
          showPasswordFallback={true}
        />
      </div>
    </div>
  );
};

export default Auth;
