import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// TYPES (UNCHANGED)
// =============================================================================

interface DecisionOutput {
  mode: "reflect" | "observer" | "guide";
  tone: "soft" | "neutral" | "probing";
  use_experiences: boolean;
  consider_social: boolean;
}

interface UserContext {
  isAuthenticated: boolean;
  source?: string;
  isReturningUser?: boolean;
  isFirstMessageOfSession?: boolean;
  hasPendingIntros?: boolean;
  userId?: string;
  experimentVariant?: "direct" | "reflective";
}

interface ProfileContext {
  full_name?: string;
  role?: string;
  industry?: string;
  goals?: string[];
  interests?: string[];
}

// =============================================================================
// STEP 1: DECISION LAYER (NOW VERY DUMB)
// =============================================================================

async function getDecision(messages: any[], userContext: UserContext, apiKey: string): Promise<DecisionOutput> {
  const userMessageCount = messages.filter((m) => m.role === "user").length;

  // Default: reflect
  let mode: DecisionOutput["mode"] = "reflect";

  // First user message → observer
  if (userMessageCount <= 1) {
    mode = "observer";
  }

  // Explicit confusion words → clarifier (still mapped as guide)
  const text = messages.map((m) => m.content.toLowerCase()).join(" ");
  if (/\b(confused|stuck|can't decide|not sure|torn)\b/.test(text)) {
    mode = "guide";
  }

  return {
    mode,
    tone: "soft",
    use_experiences: false,
    consider_social: false,
  };
}

// =============================================================================
// STEP 2: CONTEXT ASSEMBLY (READ ONLY)
// =============================================================================

async function assembleContext(userId: string | undefined, apiKey: string): Promise<ProfileContext | null> {
  if (!userId) return null;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data } = await supabase
    .from("profiles")
    .select("full_name, role, industry, goals, interests")
    .eq("id", userId)
    .single();

  return data || null;
}

// =============================================================================
// STEP 3: SYSTEM PROMPT (SOURCE OF TRUTH)
// =============================================================================

function buildSystemPrompt(decision: DecisionOutput): string {
  const mode = decision.mode;

  return `
You are ChekInn.

You help people think clearly about important decisions over time.

You are NOT a task assistant.
You do NOT send emails.
You do NOT manage reminders.
You do NOT browse the web.
You do NOT take actions for the user.

––––––––––––––––––––
CORE PRINCIPLES
––––––––––––––––––––

• Do not rush clarity.
• Do not push decisions.
• Silence is allowed.

––––––––––––––––––––
MODE: ${mode.toUpperCase()}
––––––––––––––––––––

${
  mode === "observer"
    ? `
Ask ONE short question.
No advice.
Under 25 words.
`
    : ""
}

${
  mode === "reflect"
    ? `
Make ONE observation.
No advice.
Under 30 words.
`
    : ""
}

${
  mode === "guide"
    ? `
Ask ONE constraint-based question.
No reassurance.
No solutions.
`
    : ""
}

––––––––––––––––––––
STYLE
––––––––––––––––––––

• Calm
• Human
• Texting tone
• 1–2 sentences max

Never say:
• “How can I help?”
• “Here’s what you should do”
• “I recommend”
• “You should talk to someone”

Never mention:
• data
• signals
• systems
• profiles
• emails
• introductions

If unsure, say less.
`;
}

// =============================================================================
// MAIN SERVE HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { status: 400, headers: corsHeaders });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const context: UserContext = userContext || { isAuthenticated: false };

    const decision = await getDecision(messages, context, LOVABLE_API_KEY);
    const systemPrompt = buildSystemPrompt(decision);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
