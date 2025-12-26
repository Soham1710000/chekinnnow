import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type DecisionState = 'SILENT' | 'NUDGE' | 'CHAT_INVITE';
type SignalType = 'FLIGHT' | 'INTERVIEW' | 'EVENT' | 'TRANSITION' | 'OBSESSION';

interface EmailSignal {
  id: string;
  user_id: string;
  type: SignalType;
  domain: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  created_at: string;
}

interface SocialSignal {
  id: string;
  user_id: string;
  signal_type: string;
  signal_value: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  created_at: string;
}

interface Decision {
  state: DecisionState;
  signalId: string;
  signalType: SignalType | string;
  reason: string;
  message?: string;
}

// Message templates - short, human, no emojis, source-agnostic
const MESSAGE_TEMPLATES: Record<string, { nudge: string[]; chat_invite: string[] }> = {
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
  // Social signal types - source-agnostic language
  topic: {
    nudge: [
      "You've been thinking a lot about this.\nMight be worth exploring further.",
    ],
    chat_invite: [
      "This topic keeps showing up in your world.\nWant to dig deeper?",
    ],
  },
  theme: {
    nudge: [
      "A pattern is emerging.\nPay attention to it.",
    ],
    chat_invite: [
      "Something's recurring in what you're doing.\nWant to talk it through?",
    ],
  },
  obsession: {
    nudge: [
      "You're clearly passionate about this.\nLean into it.",
    ],
    chat_invite: [
      "You've been deep in something for a while.\nWant to explore what's pulling you?",
    ],
  },
  transition: {
    nudge: [
      "Something seems to be shifting.\nGive yourself space for it.",
    ],
    chat_invite: [
      "Looks like you're in a transition.\nWant to think it through together?",
    ],
  },
};

function getRandomMessage(type: string, state: 'nudge' | 'chat_invite'): string {
  const templates = MESSAGE_TEMPLATES[type]?.[state] || MESSAGE_TEMPLATES['OBSESSION'][state];
  return templates[Math.floor(Math.random() * templates.length)];
}

function hoursUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

function evaluateEmailSignal(signal: EmailSignal, recentSignals: EmailSignal[]): Decision | null {
  // FLIGHT: Nudge if < 12 hours away
  if (signal.type === 'FLIGHT' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 12) {
      return {
        state: 'NUDGE',
        signalId: signal.id,
        signalType: signal.type,
        reason: `Flight in ${Math.round(hours)} hours`,
        message: getRandomMessage('FLIGHT', 'nudge'),
      };
    }
  }

  // INTERVIEW: Nudge if < 24 hours away
  if (signal.type === 'INTERVIEW' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 24) {
      return {
        state: 'NUDGE',
        signalId: signal.id,
        signalType: signal.type,
        reason: `Interview in ${Math.round(hours)} hours`,
        message: getRandomMessage('INTERVIEW', 'nudge'),
      };
    }
  }

  // EVENT: Nudge if < 48 hours away
  if (signal.type === 'EVENT' && signal.expires_at) {
    const hours = hoursUntil(signal.expires_at);
    if (hours > 0 && hours < 48) {
      return {
        state: 'NUDGE',
        signalId: signal.id,
        signalType: signal.type,
        reason: `Event in ${Math.round(hours)} hours`,
        message: getRandomMessage('EVENT', 'nudge'),
      };
    }
  }

  // TRANSITION: Chat invite if signals repeat for > 5 days
  if (signal.type === 'TRANSITION') {
    const now = new Date();
    const transitionSignals = recentSignals.filter(s => s.type === 'TRANSITION');
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const persistentSignals = transitionSignals.filter(s => new Date(s.created_at) < fiveDaysAgo);
    
    if (persistentSignals.length >= 2) {
      return {
        state: 'CHAT_INVITE',
        signalId: signal.id,
        signalType: signal.type,
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
      return {
        state: 'CHAT_INVITE',
        signalId: signal.id,
        signalType: signal.type,
        reason: `Repeated interest in ${signal.domain}`,
        message: getRandomMessage('OBSESSION', 'chat_invite'),
      };
    }
  }

  return null;
}

function evaluateSocialSignals(signals: SocialSignal[]): Decision | null {
  // Group by signal type and value
  const grouped: Record<string, SocialSignal[]> = {};
  
  for (const signal of signals) {
    const key = `${signal.signal_type}:${signal.signal_value}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(signal);
  }

  // Find patterns worth acting on
  for (const [key, groupedSignals] of Object.entries(grouped)) {
    // Same signal appearing 3+ times = obsession/pattern worth noting
    if (groupedSignals.length >= 3) {
      const signal = groupedSignals[0];
      const avgConfidence = groupedSignals.reduce((sum, s) => sum + s.confidence, 0) / groupedSignals.length;
      
      if (avgConfidence >= 0.6) {
        return {
          state: 'CHAT_INVITE',
          signalId: signal.id,
          signalType: signal.signal_type,
          reason: `Pattern detected: ${signal.signal_value} (${groupedSignals.length} occurrences)`,
          message: getRandomMessage(signal.signal_type, 'chat_invite'),
        };
      }
    }
  }

  // Transition signals are high priority
  const transitions = signals.filter(s => s.signal_type === 'transition');
  if (transitions.length >= 2) {
    const signal = transitions[0];
    return {
      state: 'CHAT_INVITE',
      signalId: signal.id,
      signalType: 'transition',
      reason: 'Multiple transition signals from social context',
      message: getRandomMessage('transition', 'chat_invite'),
    };
  }

  return null;
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

    // Check if user already received a message today (max 1 per 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: recentMessages } = await supabase
      .from('user_messages')
      .select('id')
      .eq('user_id', userId)
      .gte('sent_at', twentyFourHoursAgo.toISOString())
      .limit(1);

    if (recentMessages && recentMessages.length > 0) {
      console.log(`[decision-engine] User ${userId} received message in last 24h, staying silent`);
      return new Response(
        JSON.stringify({ decision: 'SILENT', reason: '24-hour limit reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get email signals
    const { data: emailSignals, error: emailError } = await supabase
      .from('email_signals')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .gte('confidence', 0.6)
      .order('created_at', { ascending: false });

    if (emailError) throw emailError;

    // Get social signals (not yet processed)
    const { data: socialSignals, error: socialError } = await supabase
      .from('social_signals')
      .select('*')
      .eq('user_id', userId)
      .eq('processed', false)
      .gte('confidence', 0.6)
      .order('created_at', { ascending: false });

    if (socialError) throw socialError;

    // Get previously nudged signal IDs (idempotency - no duplicate nudges)
    const { data: previousMessages } = await supabase
      .from('user_messages')
      .select('signal_id')
      .eq('user_id', userId)
      .not('signal_id', 'is', null);

    const nudgedSignalIds = new Set((previousMessages || []).map(m => m.signal_id));

    let bestDecision: Decision | null = null;

    // Evaluate email signals first (time-sensitive)
    if (emailSignals && emailSignals.length > 0) {
      for (const signal of emailSignals) {
        if (nudgedSignalIds.has(signal.id)) continue;
        if (signal.expires_at && new Date(signal.expires_at) < new Date()) continue;

        const decision = evaluateEmailSignal(signal as EmailSignal, emailSignals as EmailSignal[]);
        
        if (decision && decision.state !== 'SILENT') {
          // Prioritize NUDGE over CHAT_INVITE (more time-sensitive)
          if (!bestDecision || 
              (decision.state === 'NUDGE' && bestDecision.state !== 'NUDGE')) {
            bestDecision = decision;
          }
        }
      }
    }

    // If no email decision, check social signals
    if (!bestDecision && socialSignals && socialSignals.length > 0) {
      const socialDecision = evaluateSocialSignals(socialSignals as SocialSignal[]);
      if (socialDecision) {
        bestDecision = socialDecision;
      }
    }

    // Mark social signals as processed
    if (socialSignals && socialSignals.length > 0) {
      const signalIds = socialSignals.map(s => s.id);
      await supabase
        .from('social_signals')
        .update({ processed: true })
        .in('id', signalIds);
    }

    if (!bestDecision) {
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
      signal_id: bestDecision.signalId,
      decision_state: bestDecision.state,
      signal_type: bestDecision.signalType as any,
      reason: bestDecision.reason,
    });

    // Store message (only once per signal - idempotent)
    if (bestDecision.message) {
      await supabase.from('user_messages').insert({
        user_id: userId,
        signal_id: bestDecision.signalId,
        decision_state: bestDecision.state,
        message_content: bestDecision.message,
      });
    }

    console.log(`[decision-engine] Decision for ${userId}: ${bestDecision.state} - ${bestDecision.reason}`);

    return new Response(
      JSON.stringify({
        decision: bestDecision.state,
        message: bestDecision.message,
        reason: bestDecision.reason,
        signalType: bestDecision.signalType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[decision-engine] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});