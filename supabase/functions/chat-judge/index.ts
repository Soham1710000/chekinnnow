import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Type definitions
interface Signal {
  id: string;
  type: "FLIGHT" | "INTERVIEW" | "EVENT" | "TRANSITION" | "OBSESSION";
  email_date: string;
  evidence: string | null;
  confidence: number;
  domain: string | null;
  details_complete?: boolean;
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
  actionable_signal?: Signal | null;
}

// Helper: Check if signal has complete details
function hasCompleteDetails(signal: Signal): boolean {
  if (!signal.evidence) return false;
  
  if (signal.type === "FLIGHT") {
    // Must have destination AND date
    const hasDestination = /to\s+\w+|destination|arriving/i.test(signal.evidence);
    const hasDate = /\d{1,2}[\/\-]\d{1,2}|\w+\s+\d{1,2}|tomorrow|next week/i.test(signal.evidence);
    return hasDestination && hasDate;
  }
  
  if (signal.type === "INTERVIEW") {
    // Must have company or role
    return /interview|meeting|call|scheduled/i.test(signal.evidence);
  }
  
  if (signal.type === "TRANSITION") {
    // Must have explicit offer/resignation language
    return /offer|resignation|leaving|joining|accepted|declined/i.test(signal.evidence);
  }
  
  return false;
}

// Main judge logic
function chatJudge(input: JudgeInput): ChatDecision {
  // Step 0: Defaults
  const decision: ChatDecision = {
    mode: "observer",
    tone: "soft",
    reference_signal: false,
    ask_question: false,
    allow_banter: false,
    actionable_signal: null,
  };

  // Step 1: No user message → stay silent
  if (!input.user_message) {
    return decision;
  }

  const msg = input.user_message.toLowerCase();

  // Step 2: Detect if user opened the door
  const userOpenedDoor =
    msg.includes("?") ||
    /help|plans|what to do|next|thinking|consider|advice/i.test(msg) ||
    input.conversation_state === "returning";

  if (!userOpenedDoor) {
    return decision;
  }

  // Step 3: Filter eligible signals
  const eligibleSignals: Signal[] = [];
  
  for (const signal of input.recent_signals) {
    // OBSESSION: never allowed to speak
    if (signal.type === "OBSESSION") continue;
    
    // EVENT: only if user mentions explicitly (skip for now)
    if (signal.type === "EVENT") continue;
    
    // FLIGHT: must have destination AND date
    if (signal.type === "FLIGHT") {
      if (hasCompleteDetails(signal)) {
        eligibleSignals.push(signal);
      }
      continue;
    }
    
    // INTERVIEW: must be past or deadline approaching
    if (signal.type === "INTERVIEW") {
      if (hasCompleteDetails(signal)) {
        eligibleSignals.push(signal);
      }
      continue;
    }
    
    // TRANSITION: must have explicit offer/resignation
    if (signal.type === "TRANSITION") {
      if (hasCompleteDetails(signal)) {
        eligibleSignals.push(signal);
      }
      continue;
    }
  }

  // If no eligible signals, stay in observer mode
  if (eligibleSignals.length === 0) {
    decision.mode = "observer";
    decision.tone = "soft";
    return decision;
  }

  // Step 4: Apply timing restraint
  let actionableSignal: Signal | null = null;
  const now = Date.now();

  for (const signal of eligibleSignals) {
    const signalTime = new Date(signal.email_date).getTime();
    const hoursSinceSignal = (now - signalTime) / (1000 * 60 * 60);

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

  // Step 5: Gate check - no actionable signal means no reference
  if (!actionableSignal) {
    return decision;
  }

  // Step 6: Map signal → mode
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

  // Step 7: Tone selection
  if (decision.mode === "observer") {
    decision.tone = "soft";
  } else if (decision.mode === "reflect") {
    decision.tone = "soft";
  } else if (decision.mode === "guide") {
    decision.tone = "neutral";
  }

  // Step 8: Banter rules - never in career/money moments
  if (
    input.has_prior_banter &&
    decision.mode !== "guide" &&
    !["INTERVIEW", "TRANSITION"].includes(actionableSignal.type)
  ) {
    decision.allow_banter = true;
  }

  // Step 9: Final safety kill switch
  if (decision.reference_signal && !hasCompleteDetails(actionableSignal)) {
    return {
      mode: "observer",
      tone: "soft",
      reference_signal: false,
      ask_question: false,
      allow_banter: false,
      actionable_signal: null,
    };
  }

  // Attach the actionable signal for chat-ai to use
  decision.actionable_signal = actionableSignal;

  // Step 10: Return decision
  return decision;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: JudgeInput = await req.json();
    
    console.log("[chat-judge] Input:", JSON.stringify({
      has_message: !!input.user_message,
      signal_count: input.recent_signals?.length || 0,
      conversation_state: input.conversation_state,
      has_prior_banter: input.has_prior_banter,
    }));

    const decision = chatJudge(input);

    console.log("[chat-judge] Decision:", JSON.stringify(decision));

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[chat-judge] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
