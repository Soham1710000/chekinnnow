import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYERS 3-4: INTENT INFERENCE + STATE DERIVATION
 * 
 * Layer 3: Intent Inference (AI-powered, Claude 3.5 Sonnet with Gemini fallback)
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
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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
  reasoning?: string;
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

// ===== LAYER 3: INTENT INFERENCE (AI-powered) =====
async function inferIntentsWithAI(signals: Signal[]): Promise<InferredIntent[]> {
  if (signals.length === 0) {
    return [];
  }

  const signalSummaries = signals.map(s => ({
    id: s.id,
    story: s.user_story,
    category: s.category,
    subtype: s.subtype,
    confidence: s.confidence,
    evidence: s.evidence?.slice(0, 200),
    occurred_at: s.occurred_at,
    metadata: s.metadata,
  }));

  const systemPrompt = `You are an intent inference engine for a professional networking platform. Your job is to analyze user signals and infer their current intents.

VALID INTENTS (you may ONLY output these):
- JOB_SWITCH: User is actively looking for a new role
- JOB_ACCELERATION: Momentum is building in their job search (interviews, recruiter calls)
- JOB_DECISION: User has an offer in hand and needs to decide
- TRAVEL_ARRIVAL: User is traveling to or has arrived in a new city
- EVENT_ATTENDANCE: User is attending an event
- NEEDS_PREP: User has an upcoming time-bound event that requires preparation
- SOCIAL_OPENNESS: User is socially active and open to connections
- DECISION_STALLED: User has unfinished business or decisions pending

STRENGTH LEVELS:
- HIGH: Multiple high-confidence signals or very clear evidence
- MEDIUM: Some evidence but not overwhelming
- LOW: Weak signals or low confidence

For each intent you infer, provide:
1. The intent type (from the valid list above)
2. The strength (HIGH, MEDIUM, or LOW)
3. The IDs of signals that support this inference
4. Brief reasoning

Return a JSON array of inferred intents. Be conservative - only infer intents with real evidence.`;

  const userPrompt = `Analyze these signals and infer the user's current intents:

${JSON.stringify(signalSummaries, null, 2)}

Return ONLY a valid JSON array like this:
[
  {
    "intent": "JOB_ACCELERATION",
    "strength": "HIGH",
    "supporting_signal_ids": ["id1", "id2"],
    "reasoning": "Multiple interview confirmations within 48 hours"
  }
]`;

  // Try Claude first
  if (ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2048,
          messages: [
            { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.content?.[0]?.text || '[]';
        
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[state-derive] Claude inferred intents:', parsed.map((p: any) => p.intent));
          
          return parsed.map((p: any) => ({
            intent: p.intent,
            strength: p.strength,
            supporting_signal_ids: p.supporting_signal_ids || [],
            reasoning: p.reasoning,
          }));
        }
      } else {
        console.warn('[state-derive] Claude API failed, trying Gemini fallback');
      }
    } catch (error) {
      console.warn('[state-derive] Claude error, trying Gemini fallback:', error);
    }
  }

  // Fallback to Gemini via Lovable AI
  if (LOVABLE_API_KEY) {
    try {
      console.log('[state-derive] Using Gemini 2.5 Pro fallback');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';
        
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('[state-derive] Gemini inferred intents:', parsed.map((p: any) => p.intent));
          
          return parsed.map((p: any) => ({
            intent: p.intent,
            strength: p.strength,
            supporting_signal_ids: p.supporting_signal_ids || [],
            reasoning: p.reasoning,
          }));
        }
      } else {
        console.error('[state-derive] Gemini API also failed:', await response.text());
      }
    } catch (error) {
      console.error('[state-derive] Gemini error:', error);
    }
  }

  // Final fallback to rules
  console.log('[state-derive] All AI failed, using rule-based inference');
  return inferIntentsRuleBased(signals);
}

// ===== FALLBACK: RULE-BASED INFERENCE =====
function inferIntentsRuleBased(signals: Signal[]): InferredIntent[] {
  const intents: InferredIntent[] = [];
  
  const byCategory: Record<string, Signal[]> = {};
  for (const sig of signals) {
    if (!byCategory[sig.category]) byCategory[sig.category] = [];
    byCategory[sig.category].push(sig);
  }

  const careerSignals = byCategory.CAREER || [];
  
  // JOB_SWITCH
  const switchSubtypes = ['ROLE_APPLICATION', 'BURNOUT', 'RECRUITER_INTEREST'];
  const switchSignals = careerSignals.filter(s => switchSubtypes.includes(s.subtype));
  if (switchSignals.length > 0) {
    intents.push({
      intent: 'JOB_SWITCH',
      strength: calculateStrength(switchSignals),
      supporting_signal_ids: switchSignals.map(s => s.id),
    });
  }

  // JOB_ACCELERATION
  const accelSubtypes = ['INTERVIEW_CONFIRMED', 'RECRUITER_INTEREST'];
  const accelSignals = careerSignals.filter(s => accelSubtypes.includes(s.subtype));
  if (accelSignals.length > 0) {
    intents.push({
      intent: 'JOB_ACCELERATION',
      strength: calculateStrength(accelSignals),
      supporting_signal_ids: accelSignals.map(s => s.id),
    });
  }

  // JOB_DECISION
  const offerSignals = careerSignals.filter(s => s.subtype === 'OFFER_STAGE');
  if (offerSignals.length > 0) {
    intents.push({
      intent: 'JOB_DECISION',
      strength: 'HIGH',
      supporting_signal_ids: offerSignals.map(s => s.id),
    });
  }

  // TRAVEL_ARRIVAL
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

  // EVENT_ATTENDANCE
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

  // NEEDS_PREP
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

  // SOCIAL_OPENNESS
  const socialSignals = byCategory.SOCIAL || [];
  if (socialSignals.length > 0) {
    intents.push({
      intent: 'SOCIAL_OPENNESS',
      strength: calculateStrength(socialSignals),
      supporting_signal_ids: socialSignals.map(s => s.id),
    });
  }

  // DECISION_STALLED
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
  const eventDate = metadata?.departure_date || metadata?.interview_date || 
                    metadata?.event_date || metadata?.meeting_date;
  
  if (eventDate) {
    const date = new Date(eventDate);
    const hoursUntil = (date.getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 0 && hoursUntil <= 48;
  }
  
  const signalDate = new Date(occurredAt);
  const hoursSince = (Date.now() - signalDate.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

// ===== LAYER 4: STATE DERIVATION =====
async function deriveState(supabase: any, userId: string, intents: InferredIntent[], signals: Signal[]) {
  const { data: currentState } = await supabase
    .from('user_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const newState: any = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  // CAREER STATE
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

  // TRAVEL STATE
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

  // EVENT STATE
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

  // TRUST & FATIGUE
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

  newState.fatigue_score = (newState.nudges_24h * 10) + (newState.ignored_nudges * 20);

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

    // Layer 3: Infer intents with Claude 3.5 Sonnet
    const intents = await inferIntentsWithAI(allSignals);
    console.log(`[state-derive] Inferred ${intents.length} intents:`, intents.map(i => i.intent));

    // Layer 4: Derive state (persistent)
    const state = await deriveState(supabase, userId, intents, allSignals);
    console.log(`[state-derive] Derived state for user:`, userId, state);

    return new Response(JSON.stringify({ 
      success: true,
      intents: intents.map(i => ({ intent: i.intent, strength: i.strength, reasoning: i.reasoning })),
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
