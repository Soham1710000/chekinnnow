import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYERS 3-4: INTENT INFERENCE + STATE DERIVATION
 * 
 * Layer 3: Intent Inference (ephemeral, in-memory)
 * Layer 4: State Derivation (stable summaries, stored)
 * 
 * Output: user_state table
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ===== INTENT VOCABULARY (LOCKED) =====
type Intent =
  | 'JOB_SWITCH'          // User is actively looking
  | 'JOB_ACCELERATION'    // Momentum is building
  | 'JOB_DECISION'        // Offer in hand
  | 'TRAVEL_ARRIVAL'      // User is traveling
  | 'EVENT_ATTENDANCE'    // User RSVPed to event
  | 'NEEDS_PREP'          // Upcoming time-bound thing
  | 'SOCIAL_OPENNESS'     // User is socially active
  | 'DECISION_STALLED';   // User has unfinished business

interface InferredIntent {
  intent: Intent;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  supporting_signal_ids: string[];
}

interface Signal {
  id: string;
  user_id: string;
  user_story: string;
  category: string;
  type: string;
  subtype: string;
  confidence: string;
  evidence: string;
  metadata: any;
  occurred_at: string;
}

// ===== LAYER 3: INTENT INFERENCE (ephemeral) =====
function inferIntents(signals: Signal[]): InferredIntent[] {
  const intents: InferredIntent[] = [];
  
  // Group signals by category
  const byCategory: Record<string, Signal[]> = {};
  for (const sig of signals) {
    if (!byCategory[sig.category]) byCategory[sig.category] = [];
    byCategory[sig.category].push(sig);
  }

  // ===== JOB_SWITCH =====
  const careerSignals = byCategory.CAREER || [];
  const switchSubtypes = ['ROLE_APPLICATION', 'BURNOUT', 'RECRUITER_INTEREST'];
  const switchSignals = careerSignals.filter(s => switchSubtypes.includes(s.subtype));
  if (switchSignals.length > 0) {
    intents.push({
      intent: 'JOB_SWITCH',
      strength: calculateStrength(switchSignals),
      supporting_signal_ids: switchSignals.map(s => s.id),
    });
  }

  // ===== JOB_ACCELERATION =====
  const accelSubtypes = ['INTERVIEW_CONFIRMED', 'RECRUITER_INTEREST'];
  const accelSignals = careerSignals.filter(s => accelSubtypes.includes(s.subtype));
  if (accelSignals.length > 0) {
    intents.push({
      intent: 'JOB_ACCELERATION',
      strength: calculateStrength(accelSignals),
      supporting_signal_ids: accelSignals.map(s => s.id),
    });
  }

  // ===== JOB_DECISION =====
  const offerSignals = careerSignals.filter(s => s.subtype === 'OFFER_STAGE');
  if (offerSignals.length > 0) {
    intents.push({
      intent: 'JOB_DECISION',
      strength: 'HIGH', // Always high if offer exists
      supporting_signal_ids: offerSignals.map(s => s.id),
    });
  }

  // ===== TRAVEL_ARRIVAL =====
  const travelSignals = byCategory.TRAVEL || [];
  const travelSubtypes = ['UPCOMING_TRIP', 'FLIGHT_BOOKED', 'HOTEL_BOOKED', 'IN_CITY'];
  const arrivalSignals = travelSignals.filter(s => travelSubtypes.includes(s.subtype));
  if (arrivalSignals.length > 0) {
    intents.push({
      intent: 'TRAVEL_ARRIVAL',
      strength: calculateStrength(arrivalSignals),
      supporting_signal_ids: arrivalSignals.map(s => s.id),
    });
  }

  // ===== EVENT_ATTENDANCE =====
  const eventSignals = byCategory.EVENTS || [];
  const attendanceSubtypes = ['TICKET_CONFIRMED', 'RSVP_YES', 'SPEAKER'];
  const attendSignals = eventSignals.filter(s => attendanceSubtypes.includes(s.subtype));
  if (attendSignals.length > 0) {
    intents.push({
      intent: 'EVENT_ATTENDANCE',
      strength: calculateStrength(attendSignals),
      supporting_signal_ids: attendSignals.map(s => s.id),
    });
  }

  // ===== NEEDS_PREP =====
  const prepSignals = [
    ...careerSignals.filter(s => s.subtype === 'INTERVIEW_CONFIRMED'),
    ...(byCategory.MEETINGS || []),
    ...eventSignals,
  ].filter(s => isImminent(s.occurred_at, s.metadata));
  
  if (prepSignals.length > 0) {
    intents.push({
      intent: 'NEEDS_PREP',
      strength: 'HIGH',
      supporting_signal_ids: prepSignals.map(s => s.id),
    });
  }

  // ===== SOCIAL_OPENNESS =====
  const socialSignals = byCategory.SOCIAL || [];
  if (socialSignals.length > 0) {
    intents.push({
      intent: 'SOCIAL_OPENNESS',
      strength: calculateStrength(socialSignals),
      supporting_signal_ids: socialSignals.map(s => s.id),
    });
  }

  // ===== DECISION_STALLED =====
  const lifeOpsSignals = byCategory.LIFE_OPS || [];
  if (lifeOpsSignals.length > 0) {
    intents.push({
      intent: 'DECISION_STALLED',
      strength: calculateStrength(lifeOpsSignals),
      supporting_signal_ids: lifeOpsSignals.map(s => s.id),
    });
  }

  return intents;
}

function calculateStrength(signals: Signal[]): 'LOW' | 'MEDIUM' | 'HIGH' {
  const highConfidenceCount = signals.filter(s => 
    s.confidence === 'VERY_HIGH' || s.confidence === 'HIGH'
  ).length;
  
  if (highConfidenceCount >= 2) return 'HIGH';
  if (highConfidenceCount === 1) return 'MEDIUM';
  return 'LOW';
}

function isImminent(occurredAt: string, metadata: any): boolean {
  // Check if event/meeting is scheduled in the future
  const eventDate = metadata?.departure_date || metadata?.interview_date || 
                    metadata?.event_date || metadata?.meeting_date;
  
  if (eventDate) {
    const date = new Date(eventDate);
    const hoursUntil = (date.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 0 && hoursUntil <= 48;
  }
  
  // Fallback: signal occurred recently and might be time-sensitive
  const signalDate = new Date(occurredAt);
  const hoursSince = (Date.now() - signalDate.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

// ===== LAYER 4: STATE DERIVATION =====
async function deriveState(supabase: any, userId: string, intents: InferredIntent[], signals: Signal[]) {
  // Get current state
  const { data: currentState } = await supabase
    .from('user_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const newState: any = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  // ===== CAREER STATE =====
  const careerIntents = intents.filter(i => 
    i.intent === 'JOB_SWITCH' || i.intent === 'JOB_ACCELERATION' || i.intent === 'JOB_DECISION'
  );

  if (intents.some(i => i.intent === 'JOB_DECISION')) {
    newState.career_state = 'DECIDING';
  } else if (intents.some(i => i.intent === 'JOB_ACCELERATION' && i.strength === 'HIGH')) {
    newState.career_state = 'ACCELERATING';
  } else if (intents.some(i => i.intent === 'JOB_SWITCH')) {
    newState.career_state = 'ACTIVE_SEARCH';
  } else {
    newState.career_state = currentState?.career_state || 'IDLE';
  }

  if (newState.career_state !== currentState?.career_state) {
    newState.career_state_since = new Date().toISOString();
  } else {
    newState.career_state_since = currentState?.career_state_since;
  }

  // ===== TRAVEL STATE =====
  const travelIntent = intents.find(i => i.intent === 'TRAVEL_ARRIVAL');
  if (travelIntent) {
    const travelSignals = signals.filter(s => travelIntent.supporting_signal_ids.includes(s.id));
    const mostRecent = travelSignals.sort((a, b) => 
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    )[0];

    if (mostRecent) {
      const arrivalDate = mostRecent.metadata?.departure_date || mostRecent.metadata?.arrival_date;
      if (arrivalDate) {
        const hoursUntil = (new Date(arrivalDate).getTime() - Date.now()) / (1000 * 60 * 60);
        
        if (hoursUntil <= 0) {
          newState.travel_state = 'IN_CITY';
        } else if (hoursUntil <= 6) {
          newState.travel_state = 'IMMINENT';
        } else {
          newState.travel_state = 'PLANNED';
        }
        
        newState.travel_arrival_at = arrivalDate;
      } else {
        newState.travel_state = 'PLANNED';
      }
      
      newState.travel_destination = mostRecent.metadata?.destination || 
                                     mostRecent.metadata?.city || 
                                     mostRecent.metadata?.location;
    }
  } else {
    newState.travel_state = 'NONE';
    newState.travel_destination = null;
    newState.travel_arrival_at = null;
  }

  // ===== EVENT STATE =====
  const eventIntent = intents.find(i => i.intent === 'EVENT_ATTENDANCE');
  if (eventIntent) {
    const eventSignals = signals.filter(s => eventIntent.supporting_signal_ids.includes(s.id));
    const nextEvent = eventSignals
      .filter(s => s.metadata?.event_date)
      .sort((a, b) => new Date(a.metadata.event_date).getTime() - new Date(b.metadata.event_date).getTime())
      [0];

    if (nextEvent) {
      const hoursUntil = (new Date(nextEvent.metadata.event_date).getTime() - Date.now()) / (1000 * 60 * 60);
      
      if (hoursUntil <= 2) {
        newState.event_state = 'IMMINENT';
      } else {
        newState.event_state = 'ATTENDING';
      }
      
      newState.next_event_at = nextEvent.metadata.event_date;
      newState.next_event_name = nextEvent.metadata.event_name || nextEvent.evidence?.slice(0, 100);
    } else {
      newState.event_state = 'AWARE';
    }
  } else {
    newState.event_state = 'NONE';
    newState.next_event_at = null;
    newState.next_event_name = null;
  }

  // ===== TRUST & FATIGUE =====
  const { data: interactions } = await supabase
    .from('interaction_log')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  const allInteractions = interactions || [];
  const responses = allInteractions.filter((i: any) => i.interaction_type === 'user_responded');
  newState.responses_30d = responses.length;

  if (responses.length >= 5) {
    newState.trust_level = 2;
  } else if (responses.length >= 1) {
    newState.trust_level = 1;
  } else {
    newState.trust_level = 0;
  }

  const recentNudges = allInteractions.filter((i: any) => 
    i.interaction_type === 'nudge_sent' &&
    new Date(i.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  newState.nudges_24h = recentNudges.length;

  const ignores = allInteractions.filter((i: any) => i.interaction_type === 'user_ignored');
  newState.ignored_nudges = ignores.length;

  // Fatigue score: higher = more fatigued
  newState.fatigue_score = (newState.nudges_24h * 10) + (newState.ignored_nudges * 20);

  // Upsert state
  const { error } = await supabase
    .from('user_state')
    .upsert(newState, { onConflict: 'user_id' });

  if (error) {
    console.error('[state-derive] Failed to upsert state:', error);
  }

  return newState;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent signals (last 7 days)
    const { data: signals } = await supabase
      .from('signals_raw')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false });

    const allSignals = (signals || []) as Signal[];
    console.log(`[state-derive] Found ${allSignals.length} signals for user:`, userId);

    // Layer 3: Infer intents (ephemeral)
    const intents = inferIntents(allSignals);
    console.log(`[state-derive] Inferred ${intents.length} intents:`, intents.map(i => i.intent));

    // Layer 4: Derive state (persistent)
    const state = await deriveState(supabase, userId, intents, allSignals);
    console.log(`[state-derive] Derived state for user:`, userId, state);

    return new Response(JSON.stringify({ 
      success: true,
      intents: intents.map(i => ({ intent: i.intent, strength: i.strength })),
      state: {
        career_state: state.career_state,
        travel_state: state.travel_state,
        event_state: state.event_state,
        trust_level: state.trust_level,
        fatigue_score: state.fatigue_score,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[state-derive] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
