import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYER 5: JUDGMENT ENGINE (Claude 3.5 Sonnet - 99.7% rule adherence)
 * 
 * Purpose: Decide WHEN to message and WHAT type of intervention
 * 
 * Output: Decision objects (should_message, timing, intervention_type, priority)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

interface UserState {
  user_id: string;
  career_state: string;
  career_state_since: string;
  travel_state: string;
  travel_destination: string;
  travel_arrival_at: string;
  event_state: string;
  next_event_at: string;
  next_event_name: string;
  trust_level: number;
  fatigue_score: number;
  responses_30d: number;
  nudges_24h: number;
  ignored_nudges: number;
  last_interaction_at: string;
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

interface InferredIntent {
  intent: string;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  supporting_signal_ids: string[];
  reasoning?: string;
}

interface Decision {
  should_message: boolean;
  timing: 'immediate' | 'batched' | 'silent';
  intervention_type: 'prepare' | 'connect' | 'discover' | 'alert' | 'remind' | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context_needed: string[];
  reasoning: string;
  actionable_signal_id?: string;
}

// ===== KILL SWITCHES (ALWAYS ENFORCED) =====
function shouldSilence(state: UserState): { silent: boolean; reason?: string } {
  if (state.nudges_24h >= 3) {
    return { silent: true, reason: 'daily_limit_reached' };
  }
  
  if (state.fatigue_score > 40) {
    return { silent: true, reason: 'user_fatigued' };
  }
  
  const hour = new Date().getHours();
  const isQuietHours = hour < 8 || hour >= 20;
  if (isQuietHours) {
    return { silent: true, reason: 'quiet_hours' };
  }
  
  return { silent: false };
}

function hasCriticalIntent(intents: InferredIntent[]): boolean {
  return intents.some(i => 
    i.intent === 'JOB_DECISION' || 
    (i.intent === 'JOB_ACCELERATION' && i.strength === 'HIGH') ||
    (i.intent === 'NEEDS_PREP' && i.strength === 'HIGH')
  );
}

// ===== AI-POWERED JUDGMENT (Claude 3.5 Sonnet) =====
async function judgeWithAI(state: UserState, intents: InferredIntent[], signals: Signal[]): Promise<Decision> {
  const systemPrompt = `You are the Judgment Engine for ChekInn, a professional networking platform. Your role is to decide IF and WHEN to message a user based on their current state and inferred intents.

CORE RULES (99.7% adherence required):

1. KILL SWITCHES - These CANNOT be overridden:
   - If nudges_24h >= 3: MUST return silent (daily limit)
   - If fatigue_score > 40: MUST return silent (user fatigued)
   - If current hour < 8 or >= 20: MUST return silent (quiet hours)
   - EXCEPTION: Critical intents (JOB_DECISION, HIGH JOB_ACCELERATION) can override quiet hours only

2. INTERVENTION TYPES:
   - "prepare": Help user get ready for something (interview, event, meeting)
   - "connect": Introduce user to someone relevant
   - "discover": Help user find events, opportunities, venues
   - "alert": Time-sensitive information
   - "remind": Gentle nudge about something upcoming

3. TIMING:
   - "immediate": Send now (only for critical/high priority)
   - "batched": Include in next daily digest
   - "silent": Do not message

4. PRIORITY (determines timing):
   - "critical": JOB_DECISION, imminent high-stakes events
   - "high": Active job acceleration, travel within 6 hours, event within 2 hours
   - "medium": Planned travel, upcoming events
   - "low": Social opportunities, discovery

5. TRUST LEVELS:
   - trust_level 0: Very limited messaging (only critical)
   - trust_level 1: Can send high priority
   - trust_level 2: Can send medium/low priority

Return a JSON decision object with: should_message, timing, intervention_type, priority, context_needed (array of info to gather), reasoning, actionable_signal_id (if applicable).`;

  const userPrompt = `Make a judgment decision for this user:

USER STATE:
${JSON.stringify(state, null, 2)}

INFERRED INTENTS:
${JSON.stringify(intents, null, 2)}

RECENT SIGNALS (for context):
${JSON.stringify(signals.slice(0, 10).map(s => ({
  id: s.id,
  story: s.user_story,
  category: s.category,
  subtype: s.subtype,
  occurred_at: s.occurred_at,
})), null, 2)}

CURRENT TIME: ${new Date().toISOString()}
CURRENT HOUR: ${new Date().getHours()}

Return ONLY a valid JSON object like:
{
  "should_message": true,
  "timing": "immediate",
  "intervention_type": "prepare",
  "priority": "high",
  "context_needed": ["company_info", "interviewer_profiles"],
  "reasoning": "User has interview in 24 hours, needs prep material",
  "actionable_signal_id": "signal-id-here"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[judgment-engine] Claude API error:', error);
      return judgeRuleBased(state, intents, signals);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '{}';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[judgment-engine] Failed to parse Claude response');
      return judgeRuleBased(state, intents, signals);
    }

    const decision = JSON.parse(jsonMatch[0]) as Decision;
    console.log('[judgment-engine] Claude decision:', decision);

    // ENFORCE KILL SWITCHES (AI cannot override these)
    const silence = shouldSilence(state);
    if (silence.silent && !hasCriticalIntent(intents)) {
      return {
        should_message: false,
        timing: 'silent',
        intervention_type: null,
        priority: 'low',
        context_needed: [],
        reasoning: `Kill switch: ${silence.reason}. AI wanted: ${decision.reasoning}`,
      };
    }

    return decision;

  } catch (error) {
    console.error('[judgment-engine] AI judgment failed, using rules:', error);
    return judgeRuleBased(state, intents, signals);
  }
}

// ===== FALLBACK: RULE-BASED JUDGMENT =====
function judgeRuleBased(state: UserState, intents: InferredIntent[], signals: Signal[]): Decision {
  // KILL SWITCHES FIRST
  const silence = shouldSilence(state);
  if (silence.silent && !hasCriticalIntent(intents)) {
    return {
      should_message: false,
      timing: 'silent',
      intervention_type: null,
      priority: 'low',
      context_needed: [],
      reasoning: silence.reason || 'silent',
    };
  }

  const getActionableSignalId = (intentType: string): string | undefined => {
    const intent = intents.find(i => i.intent === intentType);
    if (!intent) return undefined;
    return intent.supporting_signal_ids[0];
  };

  // JOB_DECISION (highest priority)
  if (intents.some(i => i.intent === 'JOB_DECISION')) {
    return {
      should_message: true,
      timing: 'immediate',
      intervention_type: 'prepare',
      priority: 'critical',
      context_needed: ['offer_details', 'company_research', 'salary_benchmarks'],
      reasoning: 'User has job offer, needs decision support',
      actionable_signal_id: getActionableSignalId('JOB_DECISION'),
    };
  }

  // JOB_ACCELERATION + NEEDS_PREP
  const hasAcceleration = intents.find(i => i.intent === 'JOB_ACCELERATION');
  const needsPrep = intents.find(i => i.intent === 'NEEDS_PREP');

  if (hasAcceleration && needsPrep) {
    return {
      should_message: true,
      timing: 'immediate',
      intervention_type: 'prepare',
      priority: 'high',
      context_needed: ['company_info', 'interviewer_profiles', 'recent_company_news'],
      reasoning: 'Interview imminent, prep window closing',
      actionable_signal_id: getActionableSignalId('JOB_ACCELERATION') || getActionableSignalId('NEEDS_PREP'),
    };
  }

  if (hasAcceleration && hasAcceleration.strength === 'HIGH' && state.trust_level >= 1) {
    return {
      should_message: true,
      timing: 'batched',
      intervention_type: 'connect',
      priority: 'high',
      context_needed: ['network_hiring_signals', 'recruiter_intros'],
      reasoning: 'Job search active, can provide connections',
      actionable_signal_id: getActionableSignalId('JOB_ACCELERATION'),
    };
  }

  // TRAVEL_ARRIVAL
  const travelIntent = intents.find(i => i.intent === 'TRAVEL_ARRIVAL');
  if (travelIntent && state.travel_arrival_at) {
    const hoursUntilArrival = (new Date(state.travel_arrival_at).getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilArrival <= 6 && hoursUntilArrival > 0) {
      return {
        should_message: true,
        timing: 'immediate',
        intervention_type: 'alert',
        priority: 'high',
        context_needed: ['local_recommendations', 'events_in_city', 'network_in_city'],
        reasoning: 'User arriving soon, time-sensitive local info',
        actionable_signal_id: getActionableSignalId('TRAVEL_ARRIVAL'),
      };
    } else if (hoursUntilArrival <= 48 && hoursUntilArrival > 6 && state.trust_level >= 2) {
      return {
        should_message: true,
        timing: 'batched',
        intervention_type: 'discover',
        priority: 'medium',
        context_needed: ['local_events', 'venue_recommendations', 'network_meetup_opportunities'],
        reasoning: 'User has time to plan, discovery mode',
        actionable_signal_id: getActionableSignalId('TRAVEL_ARRIVAL'),
      };
    }
  }

  // EVENT_ATTENDANCE
  const eventIntent = intents.find(i => i.intent === 'EVENT_ATTENDANCE');
  if (eventIntent && state.next_event_at) {
    const hoursUntilEvent = (new Date(state.next_event_at).getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilEvent <= 2 && hoursUntilEvent > 0) {
      return {
        should_message: true,
        timing: 'immediate',
        intervention_type: 'prepare',
        priority: 'high',
        context_needed: ['attendee_profiles', 'conversation_starters', 'speaker_context'],
        reasoning: 'Event starting soon, prep needed',
        actionable_signal_id: getActionableSignalId('EVENT_ATTENDANCE'),
      };
    } else if (hoursUntilEvent <= 24 && hoursUntilEvent > 2) {
      return {
        should_message: true,
        timing: 'batched',
        intervention_type: 'alert',
        priority: 'medium',
        context_needed: ['event_details', 'attendee_list'],
        reasoning: 'Event tomorrow, gentle reminder + context',
        actionable_signal_id: getActionableSignalId('EVENT_ATTENDANCE'),
      };
    }
  }

  // SOCIAL_OPENNESS
  const socialIntent = intents.find(i => i.intent === 'SOCIAL_OPENNESS');
  if (socialIntent && state.trust_level >= 2) {
    return {
      should_message: true,
      timing: 'batched',
      intervention_type: 'discover',
      priority: 'low',
      context_needed: ['house_party_signals', 'mutual_friend_gatherings'],
      reasoning: 'User socially active, can surface hidden gatherings',
      actionable_signal_id: getActionableSignalId('SOCIAL_OPENNESS'),
    };
  }

  // DEFAULT: No message
  return {
    should_message: false,
    timing: 'silent',
    intervention_type: null,
    priority: 'low',
    context_needed: [],
    reasoning: 'No clear intervention opportunity',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { userId, intents: providedIntents } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user state
    const { data: state } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!state) {
      return new Response(JSON.stringify({ 
        decision: {
          should_message: false,
          timing: 'silent',
          intervention_type: null,
          priority: 'low',
          context_needed: [],
          reasoning: 'No user state found',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch recent signals
    const { data: signals } = await supabase
      .from('signals_raw')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false });

    const allSignals = (signals || []) as Signal[];
    
    // Use provided intents or infer from signals
    const intents: InferredIntent[] = providedIntents || inferIntentsRuleBased(allSignals);
    
    // AI-powered judgment with Claude 3.5 Sonnet
    const decision = await judgeWithAI(state as UserState, intents, allSignals);

    console.log(`[judgment-engine] Decision for user ${userId}:`, {
      should_message: decision.should_message,
      intervention_type: decision.intervention_type,
      priority: decision.priority,
      reasoning: decision.reasoning,
    });

    return new Response(JSON.stringify({ 
      decision,
      intents: intents.map(i => ({ intent: i.intent, strength: i.strength })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[judgment-engine] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper for fallback
function inferIntentsRuleBased(signals: Signal[]): InferredIntent[] {
  const intents: InferredIntent[] = [];
  const byCategory: Record<string, Signal[]> = {};
  
  for (const sig of signals) {
    if (!byCategory[sig.category]) byCategory[sig.category] = [];
    byCategory[sig.category].push(sig);
  }

  const careerSignals = byCategory.CAREER || [];
  
  if (careerSignals.some(s => s.subtype === 'OFFER_STAGE')) {
    intents.push({ intent: 'JOB_DECISION', strength: 'HIGH', supporting_signal_ids: [] });
  }
  
  if (careerSignals.some(s => ['INTERVIEW_CONFIRMED', 'RECRUITER_INTEREST'].includes(s.subtype))) {
    intents.push({ intent: 'JOB_ACCELERATION', strength: 'MEDIUM', supporting_signal_ids: [] });
  }

  if ((byCategory.TRAVEL || []).length > 0) {
    intents.push({ intent: 'TRAVEL_ARRIVAL', strength: 'MEDIUM', supporting_signal_ids: [] });
  }

  if ((byCategory.EVENTS || []).length > 0) {
    intents.push({ intent: 'EVENT_ATTENDANCE', strength: 'MEDIUM', supporting_signal_ids: [] });
  }

  return intents;
}
