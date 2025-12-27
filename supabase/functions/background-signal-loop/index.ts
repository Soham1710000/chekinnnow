import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// BACKGROUND SIGNAL LOOP
// =============================================================================
// This is NOT chat. This is NOT proactive messaging.
// It only creates possible moments (intent candidates).
// Runs every 6-8 hours via cron.
// Hard rule: if confidence < 0.6 → do nothing. Silence is the default.
// =============================================================================

interface EmailSignal {
  id: string;
  type: string;
  evidence: string | null;
  email_date: string;
  expires_at: string | null;
  domain: string | null;
}

interface ChatMessage {
  id: string;
  created_at: string;
  role: string;
  metadata: any;
}

interface IntentCandidate {
  user_id: string;
  type: "missed_followup" | "social_drift" | "important_reminder";
  confidence: number;
  freshness_hours: number;
  evidence: string;
  source_signal_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[background-signal-loop] Starting scan...");

    // Get all active users with oauth tokens (they've connected Gmail)
    const { data: users, error: usersError } = await supabase
      .from("chekinn_users")
      .select("id, email")
      .eq("status", "active");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`[background-signal-loop] Found ${users?.length || 0} active users`);

    const candidates: IntentCandidate[] = [];

    for (const user of users || []) {
      const userCandidates = await detectIntentsForUser(user.id, supabase);
      candidates.push(...userCandidates);
    }

    // Filter by confidence >= 0.6 (hard rule)
    const validCandidates = candidates.filter(c => c.confidence >= 0.6);
    console.log(`[background-signal-loop] ${candidates.length} raw candidates, ${validCandidates.length} above threshold`);

    // Insert valid candidates
    if (validCandidates.length > 0) {
      const { error: insertError } = await supabase
        .from("intent_candidates")
        .insert(validCandidates);

      if (insertError) {
        console.error("Error inserting candidates:", insertError);
      } else {
        console.log(`[background-signal-loop] Inserted ${validCandidates.length} intent candidates`);
      }
    }

    // Clean up expired candidates
    const { error: cleanupError } = await supabase
      .from("intent_candidates")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (cleanupError) {
      console.error("Error cleaning up expired candidates:", cleanupError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_scanned: users?.length || 0,
        candidates_created: validCandidates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[background-signal-loop] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// DETECT INTENTS FOR A SINGLE USER
// =============================================================================

async function detectIntentsForUser(userId: string, supabase: any): Promise<IntentCandidate[]> {
  const candidates: IntentCandidate[] = [];
  const now = new Date();

  // Fetch signals, chat messages, and social profiles in parallel
  const [signalsResult, messagesResult, profilesResult] = await Promise.all([
    supabase
      .from("email_signals")
      .select("id, type, evidence, email_date, expires_at, domain")
      .eq("user_id", userId)
      .gte("expires_at", now.toISOString())
      .order("email_date", { ascending: false })
      .limit(20),
    supabase
      .from("chat_messages")
      .select("id, created_at, role, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("inferred_social_profiles")
      .select("platform, profile_handle, confidence")
      .eq("user_id", userId)
      .gte("confidence", 0.7)
      .limit(10),
  ]);

  const signals: EmailSignal[] = signalsResult.data || [];
  const messages: ChatMessage[] = messagesResult.data || [];
  const profiles = profilesResult.data || [];

  // Calculate hours since last meaningful action
  const lastMessage = messages[0];
  const hoursSinceLastMessage = lastMessage
    ? (now.getTime() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60)
    : 999;

  // ==========================================================================
  // DETECT: missed_followup
  // ==========================================================================
  // Look for signals that might need follow-up based on timing
  for (const signal of signals) {
    const signalAge = (now.getTime() - new Date(signal.email_date).getTime()) / (1000 * 60 * 60);
    
    // Interview signals older than 24h without recent chat activity
    if (signal.type === "INTERVIEW" && signalAge > 24 && hoursSinceLastMessage > 12) {
      candidates.push({
        user_id: userId,
        type: "missed_followup",
        confidence: Math.min(0.8, 0.5 + (signalAge / 72) * 0.3),
        freshness_hours: signalAge,
        evidence: `Interview signal from ${signal.domain || "unknown"}: ${signal.evidence?.substring(0, 100) || "no details"}`,
        source_signal_id: signal.id,
      });
    }

    // Event signals that are approaching expiry
    if (signal.type === "EVENT" && signal.expires_at) {
      const hoursUntilExpiry = (new Date(signal.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < 48 && hoursUntilExpiry > 0) {
        candidates.push({
          user_id: userId,
          type: "important_reminder",
          confidence: Math.min(0.9, 0.6 + (1 - hoursUntilExpiry / 48) * 0.3),
          freshness_hours: hoursUntilExpiry,
          evidence: `Upcoming event: ${signal.evidence?.substring(0, 100) || "event soon"}`,
          source_signal_id: signal.id,
        });
      }
    }
  }

  // ==========================================================================
  // DETECT: social_drift
  // ==========================================================================
  // If user has social profiles but hasn't engaged in a while
  if (profiles.length > 0 && hoursSinceLastMessage > 72) {
    candidates.push({
      user_id: userId,
      type: "social_drift",
      confidence: Math.min(0.7, 0.4 + (hoursSinceLastMessage / 168) * 0.3),
      freshness_hours: hoursSinceLastMessage,
      evidence: `${profiles.length} social profiles tracked, ${Math.round(hoursSinceLastMessage)}h since last activity`,
    });
  }

  // ==========================================================================
  // DETECT: important_reminder
  // ==========================================================================
  // Transition signals need attention
  const transitionSignals = signals.filter(s => s.type === "TRANSITION");
  for (const signal of transitionSignals) {
    const signalAge = (now.getTime() - new Date(signal.email_date).getTime()) / (1000 * 60 * 60);
    if (signalAge > 48 && hoursSinceLastMessage > 24) {
      candidates.push({
        user_id: userId,
        type: "important_reminder",
        confidence: 0.75,
        freshness_hours: signalAge,
        evidence: `Transition detected: ${signal.evidence?.substring(0, 100) || "career change"}`,
        source_signal_id: signal.id,
      });
    }
  }

  return candidates;
}
