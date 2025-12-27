import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// CHAT JUDGE - Signal-Aware Decision Engine
// =============================================================================
// This decides HOW to reply, not WHAT to say.
// Core principle: If ChekInn can't be specific, it shuts up.
// Never proactive. Only responds when user opens the door.
// =============================================================================

interface Signal {
  id: string;
  type: "FLIGHT" | "INTERVIEW" | "TRANSITION" | "EVENT" | "OBSESSION";
  domain: string | null;
  evidence: string | null;
  email_date: string;
  details_complete: boolean;
}

interface JudgeInput {
  user_message?: string;
  recent_signals: Signal[];
  time_since_last_user_action_hours: number;
  conversation_state: "active" | "stale" | "returning";
  has_prior_banter: boolean;
}

interface ChatDecision {
  mode: "observer" | "reflect" | "guide";
  tone: "soft" | "neutral" | "playful";
  reference_signal: boolean;
  ask_question: boolean;
  allow_banter: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userMessage, conversationHistory } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recent signals (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: signalsData } = await supabase
      .from("email_signals")
      .select("id, signal_type, domain, evidence, email_date")
      .eq("user_id", userId)
      .gte("email_date", fourteenDaysAgo.toISOString())
      .order("email_date", { ascending: false });

    const recentSignals: Signal[] = (signalsData || []).map(s => ({
      id: s.id,
      type: s.signal_type as Signal["type"],
      domain: s.domain,
      evidence: s.evidence,
      email_date: s.email_date,
      details_complete: Boolean(s.domain && s.evidence),
    }));

    // Build conversation state
    const conversationState = deriveConversationState(conversationHistory || []);
    const hasPriorBanter = checkPriorBanter(conversationHistory || []);

    // Build input
    const input: JudgeInput = {
      user_message: userMessage || undefined,
      recent_signals: recentSignals,
      time_since_last_user_action_hours: conversationState.hoursSinceLast,
      conversation_state: conversationState.state,
      has_prior_banter: hasPriorBanter,
    };

    // Make the judgment
    const decision = chatJudge(input);

    console.log(`[chat-judge] Decision for ${userId}:`, JSON.stringify(decision));
    console.log(`[chat-judge] Input state:`, JSON.stringify({
      hasMessage: Boolean(userMessage),
      signalCount: recentSignals.length,
      conversationState: conversationState.state,
      hasPriorBanter,
    }));

    // Find the actionable signal if we're referencing one
    let actionableSignal: Signal | null = null;
    if (decision.reference_signal) {
      actionableSignal = findActionableSignal(recentSignals, input);
    }

    return new Response(
      JSON.stringify({
        decision,
        signal: actionableSignal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[chat-judge] Error:", error);
    
    // Default safe decision on error
    const safeDecision: ChatDecision = {
      mode: "observer",
      tone: "soft",
      reference_signal: false,
      ask_question: false,
      allow_banter: false,
    };

    return new Response(
      JSON.stringify({ decision: safeDecision, signal: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// DERIVE CONVERSATION STATE
// =============================================================================

function deriveConversationState(history: any[]): {
  state: "active" | "stale" | "returning";
  hoursSinceLast: number;
} {
  if (history.length === 0) {
    return { state: "returning", hoursSinceLast: 999 };
  }

  const now = new Date();
  const lastUserMessage = [...history].reverse().find(m => m.role === "user");
  
  if (!lastUserMessage) {
    return { state: "returning", hoursSinceLast: 999 };
  }

  const lastTime = new Date(lastUserMessage.created_at || Date.now());
  const hoursSinceLast = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLast < 1) {
    return { state: "active", hoursSinceLast };
  } else if (hoursSinceLast < 24) {
    return { state: "stale", hoursSinceLast };
  } else {
    return { state: "returning", hoursSinceLast };
  }
}

// =============================================================================
// CHECK PRIOR BANTER
// =============================================================================

function checkPriorBanter(history: any[]): boolean {
  // Look for playful exchanges in recent history
  const recentHistory = history.slice(-10);
  
  for (const msg of recentHistory) {
    if (msg.role === "assistant") {
      const content = (msg.content || "").toLowerCase();
      // Simple heuristic: emojis, exclamations, casual language
      if (/[😊😄🎉!]{2,}|haha|lol|nice|cool|awesome/i.test(content)) {
        return true;
      }
    }
  }
  
  return false;
}

// =============================================================================
// FIND ACTIONABLE SIGNAL
// =============================================================================

function findActionableSignal(signals: Signal[], input: JudgeInput): Signal | null {
  const eligible = filterEligibleSignals(signals);
  
  for (const signal of eligible) {
    const hoursSinceSignal = getHoursSinceSignal(signal);
    
    if (signal.type === "FLIGHT" && hoursSinceSignal >= 6) {
      return signal;
    }
    
    if (signal.type === "INTERVIEW" && hoursSinceSignal >= 24) {
      return signal;
    }
    
    if (signal.type === "TRANSITION" && hoursSinceSignal >= 48) {
      return signal;
    }
  }
  
  return null;
}

function filterEligibleSignals(signals: Signal[]): Signal[] {
  const eligible: Signal[] = [];
  
  for (const signal of signals) {
    // OBSESSION: never speak about
    if (signal.type === "OBSESSION") {
      continue;
    }
    
    // EVENT: only if user mentions explicitly (handled elsewhere)
    if (signal.type === "EVENT") {
      continue;
    }
    
    // FLIGHT: must have destination and date
    if (signal.type === "FLIGHT") {
      if (signal.domain && signal.email_date) {
        eligible.push(signal);
      }
      continue;
    }
    
    // INTERVIEW: must be past or deadline approaching
    if (signal.type === "INTERVIEW") {
      const hoursSince = getHoursSinceSignal(signal);
      // Past interview or within next 48 hours
      if (hoursSince >= 0) {
        eligible.push(signal);
      }
      continue;
    }
    
    // TRANSITION: must have explicit offer/resignation language
    if (signal.type === "TRANSITION") {
      const evidence = (signal.evidence || "").toLowerCase();
      if (/offer|resign|accept|quit|leave|joining|last day|notice/i.test(evidence)) {
        eligible.push(signal);
      }
      continue;
    }
  }
  
  return eligible;
}

function getHoursSinceSignal(signal: Signal): number {
  const signalTime = new Date(signal.email_date);
  const now = new Date();
  return (now.getTime() - signalTime.getTime()) / (1000 * 60 * 60);
}

// =============================================================================
// THE JUDGE - CORE DECISION LOGIC
// =============================================================================

function chatJudge(input: JudgeInput): ChatDecision {
  // Step 0 — Defaults (MOST IMPORTANT)
  const decision: ChatDecision = {
    mode: "observer",
    tone: "soft",
    reference_signal: false,
    ask_question: false,
    allow_banter: false,
  };

  // Step 1 — If no user message, stay silent
  if (!input.user_message) {
    return decision;
  }

  // Step 2 — Detect whether user opened the door
  const userMessage = input.user_message.toLowerCase();
  
  const containsQuestion = userMessage.includes("?") ||
    /^(what|how|why|when|where|should|can|could|would|is|are|do|does)/i.test(userMessage.trim());
  
  const mentionsPlans = /plan|help|what to do|next|decide|thinking|consider|advice|suggest/i.test(userMessage);
  
  const isReturning = input.conversation_state === "returning";
  
  const userOpenedDoor = containsQuestion || mentionsPlans || isReturning;

  // Step 3 — Filter eligible signals
  const eligibleSignals = filterEligibleSignals(input.recent_signals);

  // Step 4 — Find actionable signal with timing restraint
  let actionableSignal: Signal | null = null;
  
  for (const signal of eligibleSignals) {
    const hoursSinceSignal = getHoursSinceSignal(signal);
    
    if (signal.type === "FLIGHT" && hoursSinceSignal >= 6) {
      actionableSignal = signal;
      break;
    }
    
    if (signal.type === "INTERVIEW" && hoursSinceSignal >= 24) {
      actionableSignal = signal;
      break;
    }
    
    if (signal.type === "TRANSITION" && hoursSinceSignal >= 48) {
      actionableSignal = signal;
      break;
    }
  }

  // Step 5 — Open-poke restraint gate
  if (!userOpenedDoor) {
    return decision;
  }

  if (!actionableSignal) {
    // No signal to reference, but user opened door
    // Allow basic response without signal reference
    decision.mode = "observer";
    decision.tone = "soft";
    return decision;
  }

  // Step 6 — Map signal → mode
  if (actionableSignal.type === "FLIGHT") {
    decision.mode = "reflect";
    decision.reference_signal = true;
    decision.ask_question = true;
  }

  if (actionableSignal.type === "INTERVIEW") {
    decision.mode = "reflect";
    decision.reference_signal = true;
    decision.ask_question = true;
  }

  if (actionableSignal.type === "TRANSITION") {
    decision.mode = "reflect";
    decision.reference_signal = false; // Never name company first
    decision.ask_question = true;
  }

  // Step 7 — Tone selection
  if (decision.mode === "observer") {
    decision.tone = "soft";
  }

  if (decision.mode === "reflect") {
    decision.tone = "soft";
  }

  if (decision.mode === "guide") {
    decision.tone = "neutral";
  }

  // Step 8 — Banter rules
  // Never banter in career/money moments
  const isSensitiveMoment = actionableSignal.type === "INTERVIEW" || 
                            actionableSignal.type === "TRANSITION";
  
  if (
    input.has_prior_banter &&
    decision.mode !== "guide" &&
    !isSensitiveMoment
  ) {
    decision.allow_banter = true;
  }

  // Step 9 — Final safety kill switch
  // If ChekInn can't be specific, it shuts up
  if (decision.reference_signal && !actionableSignal.details_complete) {
    return {
      mode: "observer",
      tone: "soft",
      reference_signal: false,
      ask_question: false,
      allow_banter: false,
    };
  }

  // Step 10 — Return decision
  return decision;
}
