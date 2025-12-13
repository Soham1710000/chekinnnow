import { useCallback } from "react";

type FunnelEvent =
  | "cta_click"
  | "modal_open"
  | "auth_start"
  | "auth_complete"
  | "waitlist_success";

interface FunnelEventData {
  event: FunnelEvent;
  timestamp: string;
  source?: string;
  referral?: string | null;
}

// Simple localStorage-based funnel tracking
// In production, you'd send this to an analytics service
export const useFunnelTracking = () => {
  const trackEvent = useCallback((event: FunnelEvent, metadata?: Record<string, any>) => {
    const eventData: FunnelEventData = {
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Log to console for debugging
    console.log("[Funnel]", event, metadata);

    // Store in localStorage for later analysis
    try {
      const existingEvents = JSON.parse(localStorage.getItem("funnel_events") || "[]");
      existingEvents.push(eventData);
      // Keep only last 100 events
      if (existingEvents.length > 100) {
        existingEvents.shift();
      }
      localStorage.setItem("funnel_events", JSON.stringify(existingEvents));
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  const getEvents = useCallback((): FunnelEventData[] => {
    try {
      return JSON.parse(localStorage.getItem("funnel_events") || "[]");
    } catch {
      return [];
    }
  }, []);

  return { trackEvent, getEvents };
};

