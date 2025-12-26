import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// TYPES
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
  experimentVariant?: "direct" | "reflective"; // A/B test variant
}

interface ProfileContext {
  full_name?: string;
  role?: string;
  industry?: string;
  goals?: string[];
  interests?: string[];
}

// =============================================================================
// STEP 1: DECISION LAYER (fast, non-streaming)
// =============================================================================

async function getDecision(
  messages: any[],
  userContext: UserContext,
  apiKey: string
): Promise<DecisionOutput> {
  // Default fallback if decision fails
  const defaultDecision: DecisionOutput = {
    mode: "reflect",
    tone: "soft",
    use_experiences: false,
    consider_social: false
  };

  try {
    // Build conversation summary (last 5 messages only)
    const recentMessages = messages.slice(-10);
    const lastMessages = recentMessages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
    
    // Summarize earlier context if exists
    const earlierMessages = messages.slice(0, -10);
    const conversationSummary = earlierMessages.length > 0 
      ? earlierMessages.map((m: any) => `${m.role}: ${m.content.slice(0, 100)}...`).join("\n")
      : "No prior context.";

  // Force transition after message threshold (VERY fast for exam prep users)
  const userMessageCount = messages.filter((m: any) => m.role === "user").length;
  const isExamPrepUser = userContext.source === "upsc" || userContext.source === "cat";
  const transitionThreshold = isExamPrepUser ? 2 : 4; // Much faster - 2 messages max for UPSC/CAT
  const shouldForceTransition = userMessageCount >= transitionThreshold;

    const decisionPrompt = `You are an internal decision engine for ChekInn.

Your job is to decide HOW the assistant should respond, not WHAT it should say.

Analyze the conversation and return a JSON object only.
No explanation. No prose.

Decide:
- The interaction mode
- Whether to surface experiences from others
- Whether to gently consider human connection
- The tone to use

Interaction modes:
- "reflect" → user is processing or venting
- "observer" → returning user, stable, no action needed
- "guide" → user is stuck and seeking clarity

Rules:
- Default to "reflect"
- Use "guide" only if the user asks what to do or feels stuck
${shouldForceTransition ? '- IMPORTANT: We have enough context now. Set consider_social to TRUE.' : '- Consider social connection only if we have 2-3 key facts about the user.'}
- Prefer emotional safety over advice`;

    const userPrompt = `Conversation so far:
${conversationSummary}

Last 5 messages:
${lastMessages}

User state:
- authenticated: ${userContext.isAuthenticated}
- returning_user: ${userContext.isReturningUser || false}
- first_message_of_session: ${userContext.isFirstMessageOfSession || false}
- has_pending_intros: ${userContext.hasPendingIntros || false}
- source: ${userContext.source || "general"}

Return JSON with:
{
  "mode": "reflect | observer | guide",
  "tone": "soft | neutral | probing",
  "use_experiences": true | false,
  "consider_social": true | false
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Fast & cheap for classification
        messages: [
          { role: "system", content: decisionPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error("Decision layer failed, using default:", response.status);
      return defaultDecision;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return defaultDecision;

    // Parse JSON response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    
    const decision = JSON.parse(jsonString.trim());
    console.log("Decision layer output:", JSON.stringify(decision));
    
    // Force consider_social if threshold reached
    const parsedConsiderSocial = shouldForceTransition ? true : (decision.consider_social || false);
    
    return {
      mode: decision.mode || "reflect",
      tone: decision.tone || "soft",
      use_experiences: decision.use_experiences || false,
      consider_social: parsedConsiderSocial
    };
  } catch (error) {
    console.error("Decision layer error:", error);
    return defaultDecision;
  }
}

// =============================================================================
// STEP 2: CONTEXT ASSEMBLY
// =============================================================================

async function assembleContext(
  userId: string | undefined,
  apiKey: string
): Promise<ProfileContext | null> {
  if (!userId) return null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name, role, industry, goals, interests")
      .eq("id", userId)
      .single();

    if (error || !profile) return null;

    return profile as ProfileContext;
  } catch (error) {
    console.error("Context assembly error:", error);
    return null;
  }
}

// =============================================================================
// STEP 3: STREAMING SYSTEM PROMPT (Clean & Focused)
// =============================================================================

// Helper to detect decision signals in conversation
function detectDecisionSignal(messages: any[]): boolean {
  const conversationText = messages.map((m: any) => m.content.toLowerCase()).join(" ");
  
  const decisionSignals = [
    // Previous attempts
    /\b(first|second|third|1st|2nd|3rd|4th|5th|next)\s*(attempt|try)/i,
    /\battempt(s|ed)?\b/i,
    /\bfailed\s*(prelims|mains|interview)/i,
    /\bcleared\s*(prelims|mains)/i,
    
    // Career pauses/switches
    /\b(quit|left|leaving|pause|paused|resigned|switching)\s*(job|work|career)/i,
    /\b(full\s*time|full-time)\s*(prep|preparation|study)/i,
    /\btook\s*a\s*break/i,
    
    // Strategy changes
    /\b(switch|change|changing|switched)\s*(optional|strategy|subject)/i,
    /\b(dropped|taking|chose|choosing)\s*(optional|subject)/i,
    
    // Milestone anxiety
    /\b(scared|nervous|anxious|worried|stressed)\s*(about|for|of)?\s*(prelims|mains|interview)/i,
    /\bprelims\s*(is|are)?\s*(coming|near|soon|close)/i,
    /\b(pressure|stress|anxiety)\b/i,
    
    // Stuck between choices
    /\b(confused|stuck)\s*(between|about)/i,
    /\b(should\s*i|can't\s*decide|not\s*sure)/i,
    /\b(dilemma|torn\s*between)/i
  ];
  
  return decisionSignals.some(pattern => pattern.test(conversationText));
}

function buildSystemPrompt(
  decision: DecisionOutput,
  profileContext: ProfileContext | null,
  userContext: UserContext,
  messageCount: number,
  hasDecisionSignal: boolean = false
): string {
  const { mode, tone, use_experiences, consider_social } = decision;
  const { source, isAuthenticated, experimentVariant } = userContext;

  // Build personal context section
  let personalContextSection = "";
  if (profileContext) {
    const parts: string[] = [];
    if (profileContext.full_name) parts.push(`Name: ${profileContext.full_name}`);
    if (profileContext.role) parts.push(`Role: ${profileContext.role}`);
    if (profileContext.industry) parts.push(`Industry: ${profileContext.industry}`);
    if (profileContext.goals?.length) parts.push(`Goals: ${profileContext.goals.join(", ")}`);
    if (profileContext.interests?.length) parts.push(`Interests: ${profileContext.interests.join(", ")}`);
    
    if (parts.length > 0) {
      personalContextSection = `\n––––– PERSONAL CONTEXT –––––\n${parts.join("\n")}\n`;
    }
  }

  // Source-specific context
  const isExamPrepUser = source === "upsc" || source === "cat";
  
  // ========================================
  // A/B TEST: REFLECTIVE MODEL FOR UPSC
  // ========================================
  if (isExamPrepUser && experimentVariant === "reflective") {
    return buildReflectivePrompt(profileContext, userContext, messageCount, hasDecisionSignal);
  }
  
  // ========================================
  // DEFAULT: DIRECT MODEL
  // ========================================
  let sourceContext = "";
  if (source === "upsc") {
    sourceContext = "\nThis user is a UPSC aspirant. Understand the prep journey, attempts, optionals, and the emotional weight of this path.";
  } else if (source === "cat") {
    sourceContext = "\nThis user is a CAT/MBA aspirant. Understand the prep journey, mock scores, target schools, and career transitions.";
  }

  // Dynamic threshold based on source - much faster for exam users
  const transitionThreshold = isExamPrepUser ? 2 : 4;

  // Connection transition guidance
  const connectionGuidance = isAuthenticated 
    ? `Say: "Got it — I'll find someone who's been through this. You'll hear from us within 12-24 hours via email."`
    : `Say: "Got it — just drop your email and we'll connect you with someone who's been through this within 12-24 hours."`;

  // Force transition after threshold
  const shouldTransitionNow = messageCount >= transitionThreshold;
  const transitionInstruction = shouldTransitionNow 
    ? `\n\n⚠️ CRITICAL: STOP. You have enough info (${messageCount} messages). DO NOT ask another question. Transition to connection NOW. ${connectionGuidance}`
    : "";

  // Carrot messaging - earlier and stronger
  let carrotMessage = "";
  if (isExamPrepUser) {
    if (messageCount === 0) {
      carrotMessage = `\n\n🥕 END WITH: "We already have people who've cracked this — just need a quick detail to match you."`;
    } else if (messageCount === 1) {
      carrotMessage = `\n\n🥕 END WITH: "I think I have someone perfect for you."`;
    }
  }

  return `You are ChekInn — a thoughtful, human-like companion that helps people think clearly over time.

Your role is NOT to:
- push actions
- capture emails
- connect users to others
- rush conclusions

Your role IS to:
- reflect patterns you notice
- help the user clarify what they already feel
- offer grounded, optional next steps
- sound like a smart friend, not a coach or authority

${sourceContext}
${personalContextSection}

––––– RESPONSE STYLE (NON-NEGOTIABLE) –––––

- Respond in 1 to 3 short messages (like texting)
- Each message: 1–2 sentences max
- Casual, calm, human
- Mix empathy + observation + (optional) action
- Never reveal how you know something
- Never mention emails, data, signals, or profiles

––––– HOW TO THINK –––––

Assume:
- Big thoughts don’t appear suddenly
- If the user mentions a decision, it’s been brewing
- Repetition = importance
- Hesitation = missing clarity, not laziness

You MAY:
- Say things like:
  • “This hasn’t come out of nowhere.”
  • “Feels more like timing than frustration.”
  • “You’ve been circling this.”

You MAY offer:
- ONE small, reversible, optional action
- Framed as a suggestion, not a plan

Examples:
- “Might help to write what you’d miss if you stayed.”
- “You could sanity-check this by listing tradeoffs.”
- “Sometimes naming the worst-case helps.”

You MUST NOT:
- Ask multiple questions
- Give step-by-step plans
- Give motivational speeches
- Sound clinical or therapeutic
- Sound like a productivity tool

––––– TONE GUIDANCE –––––
Mode: ${mode}
Tone: ${tone}

If unsure, say less — not more.

Your goal:
Leave the user feeling understood and slightly clearer,
not decided, not pushed, not sold to.
`;
