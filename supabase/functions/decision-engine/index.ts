import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DecisionState = 'SILENT' | 'NUDGE' | 'CHAT_INVITE';
type SignalType = 'FLIGHT' | 'INTERVIEW' | 'EVENT' | 'TRANSITION' | 'OBSESSION';

interface Signal {
  id: string;
  user_id: string;
  type: SignalType;
  domain: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  created_at: string;
}

interface Decision {
  state: DecisionState;
  signal: Signal;
  reason: string;
  message?: string;
}

// Message templates - short, human, no emojis
const MESSAGE_TEMPLATES: Record<SignalType, { nudge: string[]; chat_invite: string[] }> = {
  FLIGHT: {
    nudge: [
      "You've got an early flight tomorrow.\nSleep.",
      "Flight coming up.\nPack light.",
      "Travel day approaching.\nDon't forget your charger.",
    ],
    chat_invite: [
      "Looks like you're traveling soon.\nWant to talk through what you're preparing for?",
    ],
  },
  INTERVIEW: {
    nudge: [
      "Interview tomorrow.\nYou've got this.",
      "Call coming up.\nTake a breath first.",
    ],
    chat_invite: [
      "You've been interviewing a lot.\nWant to think through what you're really looking for?",
    ],
  },
  EVENT: {
    nudge: [
      "There's an event this weekend that fits what you're building.\nYou should go.",
      "Something relevant is happening nearby.\nMight be worth showing up.",
    ],
    chat_invite: [
      "A few events coming up in your space.\nWant help deciding which ones matter?",
    ],
  },
  TRANSITION: {
    nudge: [
      "Sounds like something's shifting.\nTake your time with it.",
    ],
    chat_invite: [
      "You've been circling a job switch.\nWant to talk it out?",
      "Feels like you're thinking about a change.\nI'm here if you want to process it.",
    ],
  },
  OBSESSION: {
    nudge: [
      "You keep coming back to this topic.\nMight mean something.",
    ],
    chat_invite: [
      "You've been deep in this for a while.\nWant to explore what's pulling you?",
    ],
  },
};

function getRandomMessage(type: SignalType, state: 'nudge' | 'chat_invite'): string {
  const templates = MESSAGE_TEMPLATES[type][state];
  return templates[Math.floor(Math.random() * templates.length)];
}

function hoursUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

function evaluateSignal(signal: Signal, recentSignals: Signal[]): Decision {
  const now = new Date();
  
  // Default to silent
  let decision: Decision = {
    state: 'SILENT',
    signal,
    reason: 'No action criteria met',
  };

  // FLIGHT: Nudge if < 12 hours away
  if (signal.type === 'FLIGHT' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 12) {
      decision = {
        state: 'NUDGE',
        signal,
        reason: `Flight in ${Math.round(hours)} hours`,
        message: getRandomMessage('FLIGHT', 'nudge'),
      };
    }
  }

  // INTERVIEW: Nudge if < 24 hours away
  if (signal.type === 'INTERVIEW' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 24) {
      decision = {
        state: 'NUDGE',
        signal,
        reason: `Interview in ${Math.round(hours)} hours`,
        message: getRandomMessage('INTERVIEW', 'nudge'),
      };
    }
  }

  // EVENT: Nudge if < 48 hours away
  if (signal.type === 'EVENT' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 48) {
      decision = {
        state: 'NUDGE',
        signal,
        reason: `Event in ${Math.round(hours)} hours`,
        message: getRandomMessage('EVENT', 'nudge'),
      };
    }
  }

  // TRANSITION: Chat invite if signals repeat for > 5 days
  if (signal.type === 'TRANSITION') {
    const transitionSignals = recentSignals.filter(s => s.type === 'TRANSITION');
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const persistentSignals = transitionSignals.filter(s => new Date(s.created_at) < fiveDaysAgo);
    
    if (persistentSignals.length >= 2) {
      decision = {
        state: 'CHAT_INVITE',
        signal,
        reason: 'Transition signals persisting for 5+ days',
        message: getRandomMessage('TRANSITION', 'chat_invite'),
      };
    }
  }

  // OBSESSION: Chat invite if same domain appears 3+ times
  if (signal.type === 'OBSESSION') {
    const sameDomainSignals = recentSignals.filter(
      s => s.type === 'OBSESSION' && s.domain === signal.domain
    );
    
    if (sameDomainSignals.length >= 3) {
      decision = {
        state: 'CHAT_INVITE',
        signal,
        reason: `Repeated interest in ${signal.domain}`,
        message: getRandomMessage('OBSESSION', 'chat_invite'),
      };
    }
  }

  return decision;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user already received a message today (max 1 per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayMessages } = await supabase
      .from('user_messages')
      .select('id')
      .eq('user_id', userId)
      .gte('sent_at', today.toISOString())
      .limit(1);

    if (todayMessages && todayMessages.length > 0) {
      console.log(`User ${userId} already received message today, staying silent`);
      return new Response(
        JSON.stringify({ decision: 'SILENT', reason: 'Daily limit reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent signals (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { data: signals, error: signalsError } = await supabase
      .from('email_signals')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .gte('confidence', 0.6)
      .order('created_at', { ascending: false });

    if (signalsError) throw signalsError;
    if (!signals || signals.length === 0) {
      return new Response(
        JSON.stringify({ decision: 'SILENT', reason: 'No active signals' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get previously nudged signal IDs (to avoid duplicate nudges)
    const { data: previousMessages } = await supabase
      .from('user_messages')
      .select('signal_id')
      .eq('user_id', userId)
      .not('signal_id', 'is', null);

    const nudgedSignalIds = new Set((previousMessages || []).map(m => m.signal_id));

    // Evaluate each signal and find the best action
    let bestDecision: Decision | null = null;

    for (const signal of signals) {
      // Skip already-nudged signals
      if (nudgedSignalIds.has(signal.id)) continue;
      
      // Skip expired signals
      if (signal.expires_at && new Date(signal.expires_at) < new Date()) continue;

      const decision = evaluateSignal(signal as Signal, signals as Signal[]);
      
      if (decision.state !== 'SILENT') {
        // Prioritize NUDGE over CHAT_INVITE (more time-sensitive)
        if (!bestDecision || 
            (decision.state === 'NUDGE' && bestDecision.state !== 'NUDGE')) {
          bestDecision = decision;
        }
      }
    }

    if (!bestDecision || bestDecision.state === 'SILENT') {
      // Log silent decision
      await supabase.from('decision_log').insert({
        user_id: userId,
        decision_state: 'SILENT',
        reason: 'No actionable signals',
      });

      return new Response(
        JSON.stringify({ decision: 'SILENT', reason: 'No actionable signals' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log decision
    await supabase.from('decision_log').insert({
      user_id: userId,
      signal_id: bestDecision.signal.id,
      decision_state: bestDecision.state,
      signal_type: bestDecision.signal.type,
      reason: bestDecision.reason,
    });

    // Store message
    if (bestDecision.message) {
      await supabase.from('user_messages').insert({
        user_id: userId,
        signal_id: bestDecision.signal.id,
        decision_state: bestDecision.state,
        message_content: bestDecision.message,
      });
    }

    console.log(`Decision for ${userId}: ${bestDecision.state} - ${bestDecision.reason}`);

    return new Response(
      JSON.stringify({
        decision: bestDecision.state,
        message: bestDecision.message,
        reason: bestDecision.reason,
        signalType: bestDecision.signal.type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Decision engine error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
