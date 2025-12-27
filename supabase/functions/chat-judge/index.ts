import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// CHAT JUDGE
// =============================================================================
// This decides HOW to reply, not WHAT to say.
// Output is a fixed schema, no creativity.
// Defaults: mode=observer, tone=soft, max_lines=1
// If unsure → observer + soft + no question
// This is where dignity is enforced.
// =============================================================================

interface JudgeDecision {
  mode: "observer" | "reflect" | "guide";
  tone: "soft" | "neutral" | "playful";
  reference_intent: boolean;
  max_lines: number;
  banter_allowed: boolean;
  ask_question: boolean;
}

interface IntentCandidate {
  id: string;
  type: string;
  confidence: number;
  freshness_hours: number;
  evidence: string;
}

interface ConversationContext {
  message_count: number;
  last_message_role: string;
  hours_since_last: number;
  has_recent_activity: boolean;
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

    // Fetch top 3 intent candidates for this user
    const { data: candidates } = await supabase
      .from("intent_candidates")
      .select("id, type, confidence, freshness_hours, evidence")
      .eq("user_id", userId)
      .eq("processed", false)
      .gte("confidence", 0.6)
      .order("confidence", { ascending: false })
      .limit(3);

    const intents: IntentCandidate[] = candidates || [];

    // Build conversation context
    const context = buildConversationContext(conversationHistory || []);

    // Make the judgment
    const decision = judge(userMessage, intents, context);

    console.log(`[chat-judge] Decision for ${userId}:`, JSON.stringify(decision));

    // Mark used intents as processed if we're referencing them
    if (decision.reference_intent && intents.length > 0) {
      await supabase
        .from("intent_candidates")
        .update({ processed: true })
        .in("id", intents.map(i => i.id));
    }

    return new Response(
      JSON.stringify({
        decision,
        intents: decision.reference_intent ? intents.slice(0, 1) : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[chat-judge] Error:", error);
    
    // Default safe decision on error
    const safeDecision: JudgeDecision = {
      mode: "observer",
      tone: "soft",
      reference_intent: false,
      max_lines: 1,
      banter_allowed: false,
      ask_question: false,
    };

    return new Response(
      JSON.stringify({ decision: safeDecision, intents: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// BUILD CONVERSATION CONTEXT
// =============================================================================

function buildConversationContext(history: any[]): ConversationContext {
  const now = new Date();
  const lastMessage = history[history.length - 1];
  const hoursSinceLast = lastMessage
    ? (now.getTime() - new Date(lastMessage.created_at || Date.now()).getTime()) / (1000 * 60 * 60)
    : 999;

  return {
    message_count: history.length,
    last_message_role: lastMessage?.role || "none",
    hours_since_last: hoursSinceLast,
    has_recent_activity: hoursSinceLast < 24,
  };
}

// =============================================================================
// THE JUDGE - CORE DECISION LOGIC
// =============================================================================

function judge(
  userMessage: string | null,
  intents: IntentCandidate[],
  context: ConversationContext
): JudgeDecision {
  // Default: observer + soft + no question (silence is respect)
  const decision: JudgeDecision = {
    mode: "observer",
    tone: "soft",
    reference_intent: false,
    max_lines: 1,
    banter_allowed: false,
    ask_question: false,
  };

  // If no user message and no strong intents, stay quiet
  if (!userMessage && intents.length === 0) {
    return decision;
  }

  const hasStrongIntent = intents.some(i => i.confidence >= 0.75);
  const topIntent = intents[0];

  // ==========================================================================
  // RULE 1: User just sent a message - prioritize responding to them
  // ==========================================================================
  if (userMessage && userMessage.trim().length > 0) {
    const msg = userMessage.toLowerCase();
    
    // Check for explicit questions from user
    const isQuestion = msg.includes("?") || 
                       msg.startsWith("what") || 
                       msg.startsWith("how") ||
                       msg.startsWith("why") ||
                       msg.startsWith("should") ||
                       msg.startsWith("can you");
    
    // Check for emotional content
    const isEmotional = /stress|anxious|worried|nervous|excited|happy|sad|frustrated/i.test(msg);
    
    // Check for help request
    const needsHelp = /help|advice|suggest|think|opinion/i.test(msg);

    if (needsHelp || isQuestion) {
      decision.mode = "guide";
      decision.tone = "neutral";
      decision.max_lines = 2;
      decision.ask_question = !isQuestion; // Ask clarifying question only if they didn't ask one
    } else if (isEmotional) {
      decision.mode = "reflect";
      decision.tone = "soft";
      decision.max_lines = 1;
      decision.ask_question = false; // Don't interrogate emotions
    } else {
      decision.mode = "observer";
      decision.tone = "soft";
      // Allow playful only if we have history and recent activity
      if (context.message_count > 5 && context.has_recent_activity) {
        decision.banter_allowed = true;
        decision.tone = "playful";
      }
    }
  }

  // ==========================================================================
  // RULE 2: Reference intent only if it's very relevant
  // ==========================================================================
  if (hasStrongIntent && topIntent) {
    // Only reference intent if:
    // 1. It's high confidence (>0.75)
    // 2. It's fresh (< 24h old)
    // 3. User hasn't been active recently (don't interrupt)
    if (
      topIntent.confidence >= 0.75 &&
      topIntent.freshness_hours < 24 &&
      !context.has_recent_activity
    ) {
      decision.reference_intent = true;
      decision.mode = "reflect";
      
      // Important reminders get slightly more urgency
      if (topIntent.type === "important_reminder") {
        decision.max_lines = 2;
      }
    }
  }

  // ==========================================================================
  // RULE 3: Long conversation = allow more natural flow
  // ==========================================================================
  if (context.message_count > 10) {
    decision.banter_allowed = true;
    if (context.has_recent_activity) {
      decision.max_lines = Math.min(decision.max_lines + 1, 3);
    }
  }

  // ==========================================================================
  // RULE 4: First few messages = stay reserved
  // ==========================================================================
  if (context.message_count < 3) {
    decision.mode = "observer";
    decision.tone = "soft";
    decision.banter_allowed = false;
    decision.max_lines = 1;
  }

  return decision;
}
