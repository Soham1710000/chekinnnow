import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type FunnelEvent =
  | "page_view"
  | "cta_click"
  | "modal_open"
  | "auth_start"
  | "auth_complete"
  | "auth_magic_link_sent"
  | "waitlist_success"
  | "chat_page_loaded"
  | "save_progress_shown"
  | "save_progress_captured"
  | "linkedin_enriched"
  | "linkedin_skipped";

// Generate or retrieve session ID for anonymous tracking
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem("funnel_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("funnel_session_id", sessionId);
  }
  return sessionId;
};

export const useFunnelTracking = () => {
  const hasTrackedPageView = useRef(false);

  const trackEvent = useCallback(async (
    eventType: FunnelEvent, 
    metadata?: Record<string, any>
  ) => {
    const sessionId = getSessionId();
    
    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get referrer info
    const urlParams = new URLSearchParams(window.location.search);
    const referral = urlParams.get('ref');
    const utmSource = urlParams.get('utm_source');
    
    const eventData = {
      event_type: eventType,
      user_id: user?.id || null,
      session_id: sessionId,
      source: utmSource || document.referrer || 'direct',
      referral: referral,
      page_url: window.location.pathname,
      metadata: metadata || {},
    };

    // Log to console for debugging
    console.log("[Funnel]", eventType, eventData);

    // Save to database
    const { error } = await supabase
      .from('funnel_events')
      .insert(eventData);
    
    if (error) {
      console.error("[Funnel] Error tracking event:", error);
    }
  }, []);

  // Track page view on mount
  const trackPageView = useCallback(() => {
    if (!hasTrackedPageView.current) {
      hasTrackedPageView.current = true;
      trackEvent("page_view");
    }
  }, [trackEvent]);

  return { trackEvent, trackPageView };
};
