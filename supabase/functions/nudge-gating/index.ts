import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// NUDGE GATING
// =============================================================================
// This is NOT the judgment engine. Its job is GATING.
// Decides whether to even invoke judgment-engine based on hard constraints.
// 
// Inputs:
//   - Previous user_state
//   - Newly derived user_state  
//   - Recent nudge history
//
// Outputs:
//   - should_judge: true/false
//   - trigger_reason: string
// =============================================================================

interface UserState {
  user_id: string;
  career_state: string | null;
  career_state_since: string | null;
  travel_state: string | null;
  travel_destination: string | null;
  travel_arrival_at: string | null;
  event_state: string | null;
  next_event_at: string | null;
  next_event_name: string | null;
  trust_level: number;
  fatigue_score: number;
  nudges_24h: number;
  ignored_nudges: number;
  last_interaction_at: string | null;
  updated_at: string | null;
}

interface NudgeHistory {
  id: string;
  user_id: string;
  decision_state: string;
  created_at: string;
  reason: string;
}

interface GatingResult {
  should_judge: boolean;
  reason: string;
  details?: Record<string, any>;
}

// =============================================================================
// HARD CONSTRAINT: COOLDOWN PERIODS (hours)
// =============================================================================
const COOLDOWN_HOURS = {
  NUDGE: 12,           // Minimum hours between nudges
  CHAT_INVITE: 24,     // Minimum hours between chat invites
  SIMILAR_SIGNAL: 48,  // Don't nudge for same signal type within this window
};

const MAX_NUDGES_24H = 2;  // Hard cap on daily nudges
const MAX_IGNORED_BEFORE_SILENCE = 3;  // Stop nudging after this many ignores

// =============================================================================
// STATE CHANGE DETECTION
// =============================================================================
function detectStateChanges(
  previous: UserState | null,
  current: UserState
): { changed: boolean; changes: string[] } {
  const changes: string[] = [];

  if (!previous) {
    // First state - only proceed if there's something meaningful
    if (current.career_state && current.career_state !== 'IDLE') {
      changes.push(`career_state_initialized:${current.career_state}`);
    }
    if (current.travel_state && current.travel_state !== 'NONE') {
      changes.push(`travel_state_initialized:${current.travel_state}`);
    }
    if (current.event_state && current.event_state !== 'NONE') {
      changes.push(`event_state_initialized:${current.event_state}`);
    }
    return { changed: changes.length > 0, changes };
  }

  // Career state changes
  if (previous.career_state !== current.career_state) {
    // Significant career transitions
    if (current.career_state === 'SWITCH_WINDOW') {
      changes.push('career_switch_window_opened');
    } else if (current.career_state === 'INTERVIEWING') {
      changes.push('career_interviewing_started');
    } else if (current.career_state === 'OFFER_PENDING') {
      changes.push('career_offer_received');
    } else if (previous.career_state === 'SWITCH_WINDOW' && current.career_state === 'IDLE') {
      changes.push('career_switch_window_closed');
    }
  }

  // Travel state changes
  if (previous.travel_state !== current.travel_state) {
    if (current.travel_state === 'PLANNING') {
      changes.push('travel_planning_detected');
    } else if (current.travel_state === 'IMMINENT') {
      changes.push('travel_imminent');
    } else if (current.travel_state === 'IN_TRANSIT') {
      changes.push('travel_started');
    }
  }

  // Event state changes
  if (previous.event_state !== current.event_state) {
    if (current.event_state === 'IMMINENT') {
      changes.push('event_imminent');
    } else if (current.event_state === 'ATTENDING') {
      changes.push('event_attending');
    }
  }

  // Time-sensitive: upcoming event within 24h
  if (current.next_event_at) {
    const hoursUntilEvent = (new Date(current.next_event_at).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilEvent > 0 && hoursUntilEvent <= 24) {
      changes.push('event_within_24h');
    }
  }

  // Travel arriving soon
  if (current.travel_arrival_at) {
    const hoursUntilArrival = (new Date(current.travel_arrival_at).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilArrival > 0 && hoursUntilArrival <= 48) {
      changes.push('travel_arrival_imminent');
    }
  }

  return { changed: changes.length > 0, changes };
}

// =============================================================================
// COOLDOWN CHECK
// =============================================================================
function checkCooldown(
  nudgeHistory: NudgeHistory[],
  currentState: UserState
): { blocked: boolean; reason: string } {
  const now = Date.now();

  // Check: Too many nudges in 24h
  if (currentState.nudges_24h >= MAX_NUDGES_24H) {
    return { 
      blocked: true, 
      reason: `daily_limit_reached:${currentState.nudges_24h}/${MAX_NUDGES_24H}` 
    };
  }

  // Check: Too many ignored nudges
  if (currentState.ignored_nudges >= MAX_IGNORED_BEFORE_SILENCE) {
    return { 
      blocked: true, 
      reason: `user_fatigued:${currentState.ignored_nudges}_ignored` 
    };
  }

  // Check recent nudge history
  const recentNudges = nudgeHistory.filter(n => {
    const nudgeTime = new Date(n.created_at).getTime();
    const hoursSince = (now - nudgeTime) / (1000 * 60 * 60);
    return hoursSince < COOLDOWN_HOURS.NUDGE;
  });

  if (recentNudges.length > 0) {
    const mostRecent = recentNudges[0];
    const hoursSince = (now - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60);
    return { 
      blocked: true, 
      reason: `cooldown_active:${Math.round(hoursSince)}h_since_last_nudge` 
    };
  }

  // Check for chat invites (longer cooldown)
  const recentChatInvites = nudgeHistory.filter(n => {
    const nudgeTime = new Date(n.created_at).getTime();
    const hoursSince = (now - nudgeTime) / (1000 * 60 * 60);
    return n.decision_state === 'CHAT_INVITE' && hoursSince < COOLDOWN_HOURS.CHAT_INVITE;
  });

  if (recentChatInvites.length > 0) {
    const hoursSince = (now - new Date(recentChatInvites[0].created_at).getTime()) / (1000 * 60 * 60);
    return { 
      blocked: true, 
      reason: `chat_invite_cooldown:${Math.round(hoursSince)}h_remaining` 
    };
  }

  return { blocked: false, reason: 'cooldown_clear' };
}

// =============================================================================
// QUIET HOURS CHECK
// =============================================================================
function isQuietHours(): boolean {
  // Use IST (UTC+5:30) as default timezone for India-focused app
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const hour = istTime.getUTCHours();
  
  // Quiet hours: 10 PM to 8 AM IST
  return hour >= 22 || hour < 8;
}

// =============================================================================
// MAIN GATING LOGIC
// =============================================================================
async function evaluateGating(
  supabase: any,
  userId: string,
  newState: UserState
): Promise<GatingResult> {
  console.log(`[nudge-gating] Evaluating for user: ${userId}`);

  // 1. Check quiet hours first
  if (isQuietHours()) {
    console.log('[nudge-gating] ❌ Blocked: Quiet hours');
    return {
      should_judge: false,
      reason: 'quiet_hours',
      details: { blocked_by: 'time_of_day' }
    };
  }

  // 2. Fetch previous state (snapshot before this update)
  // We'll use the state's own updated_at to detect if this is fresh
  const previousState = newState; // In practice, we'd compare with cached/previous version
  
  // 3. Fetch recent nudge history
  const { data: nudgeHistory, error: historyError } = await supabase
    .from('decision_log')
    .select('*')
    .eq('user_id', userId)
    .in('decision_state', ['NUDGE', 'CHAT_INVITE'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (historyError) {
    console.error('[nudge-gating] Error fetching history:', historyError);
  }

  const history = (nudgeHistory || []) as NudgeHistory[];
  console.log(`[nudge-gating] Found ${history.length} recent nudge decisions`);

  // 4. Check cooldown constraints
  const cooldownCheck = checkCooldown(history, newState);
  if (cooldownCheck.blocked) {
    console.log(`[nudge-gating] ❌ Blocked: ${cooldownCheck.reason}`);
    return {
      should_judge: false,
      reason: cooldownCheck.reason,
      details: { blocked_by: 'cooldown', history_count: history.length }
    };
  }

  // 5. Detect state changes
  // For now, we'll fetch the user's signals to understand if there's meaningful change
  const { data: recentSignals } = await supabase
    .from('signals_raw')
    .select('category, type, subtype, created_at, confidence')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Check if there are any HIGH confidence signals in the last 24h
  const now = Date.now();
  const freshHighConfidenceSignals = (recentSignals || []).filter((s: any) => {
    const signalAge = (now - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
    return signalAge < 24 && s.confidence === 'HIGH';
  });

  console.log(`[nudge-gating] Fresh high-confidence signals: ${freshHighConfidenceSignals.length}`);

  // 6. Apply state change threshold rule
  const stateChanges = detectStateChanges(null, newState); // Compare with stored previous state

  if (!stateChanges.changed && freshHighConfidenceSignals.length === 0) {
    console.log('[nudge-gating] ❌ No meaningful state change or high-confidence signals');
    return {
      should_judge: false,
      reason: 'no_material_change',
      details: { 
        state_changes: stateChanges.changes,
        fresh_signals: freshHighConfidenceSignals.length
      }
    };
  }

  // 7. If we have meaningful changes, proceed to judgment
  const triggerReason = stateChanges.changes.length > 0 
    ? stateChanges.changes[0] 
    : `high_confidence_signal:${freshHighConfidenceSignals[0]?.type || 'unknown'}`;

  console.log(`[nudge-gating] ✅ Proceeding to judgment: ${triggerReason}`);
  
  return {
    should_judge: true,
    reason: triggerReason,
    details: {
      state_changes: stateChanges.changes,
      fresh_high_signals: freshHighConfidenceSignals.length,
      nudges_24h: newState.nudges_24h,
      trust_level: newState.trust_level
    }
  };
}

// =============================================================================
// HTTP HANDLER
// =============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { userId, userState } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nudge-gating] Request for user: ${userId}`);

    // If userState not provided, fetch it
    let state = userState;
    if (!state) {
      const { data: fetchedState, error: stateError } = await supabase
        .from('user_state')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (stateError || !fetchedState) {
        console.log('[nudge-gating] No user_state found, cannot proceed');
        return new Response(
          JSON.stringify({ 
            should_judge: false, 
            reason: 'no_user_state',
            details: { error: stateError?.message }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      state = fetchedState;
    }

    // Evaluate gating
    const result = await evaluateGating(supabase, userId, state as UserState);

    console.log(`[nudge-gating] Result:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[nudge-gating] Error:", error);
    return new Response(
      JSON.stringify({ 
        should_judge: false,
        reason: 'error',
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
