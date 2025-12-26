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
// STEP 1: DECISION LAYER (fast, non-streaming)
// =============================================================================

async function getDecision(
  messages: any[],
  userContext: UserContext,
  apiKey: string
): Promise<DecisionOutput> {
  const defaultDecision: DecisionOutput = {
    mode: "reflect",
    tone: "soft",
    use_experiences: false,
    consider_social: false
  };

  try {
    const recentMessages = messages.slice(-10);
    const lastMessages = recentMessages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
    
    const earlierMessages = messages.slice(0, -10);
    const conversationSummary = earlierMessages.length > 0 
      ? earlierMessages.map((m: any) => `${m.role}: ${m.content.slice(0, 100)}...`).join("\n")
      : "No prior context.";

    const userMessageCount = messages.filter((m: any) => m.role === "user").length;
    const isExamPrepUser = userContext.source === "upsc" || userContext.source === "cat";
    const transitionThreshold = isExamPrepUser ? 2 : 4;
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
        model: "google/gemini-2.5-flash-lite",
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

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    
    const decision = JSON.parse(jsonString.trim());
    console.log("Decision layer output:", JSON.stringify(decision));
    
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
// STEP 3: SYSTEM PROMPTS
// =============================================================================

function detectDecisionSignal(messages: any[]): boolean {
  const conversationText = messages.map((m: any) => m.content.toLowerCase()).join(" ");
  
  const decisionSignals = [
    /\b(first|second|third|1st|2nd|3rd|4th|5th|next)\s*(attempt|try)/i,
    /\battempt(s|ed)?\b/i,
    /\bfailed\s*(prelims|mains|interview)/i,
    /\bcleared\s*(prelims|mains)/i,
    /\b(quit|left|leaving|pause|paused|resigned|switching)\s*(job|work|career)/i,
    /\b(full\s*time|full-time)\s*(prep|preparation|study)/i,
    /\btook\s*a\s*break/i,
    /\b(switch|change|changing|switched)\s*(optional|strategy|subject)/i,
    /\b(dropped|taking|chose|choosing)\s*(optional|subject)/i,
    /\b(scared|nervous|anxious|worried|stressed)\s*(about|for|of)?\s*(prelims|mains|interview)/i,
    /\bprelims\s*(is|are)?\s*(coming|near|soon|close)/i,
    /\b(pressure|stress|anxiety)\b/i,
    /\b(confused|stuck)\s*(between|about)/i,
    /\b(should\s*i|can't\s*decide|not\s*sure)/i,
    /\b(dilemma|torn\s*between)/i
  ];
  
  return decisionSignals.some(pattern => pattern.test(conversationText));
}

function buildReflectivePrompt(
  profileContext: ProfileContext | null,
  userContext: UserContext,
  messageCount: number,
  hasDecisionSignal: boolean
): string {
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

  return `You are ChekInn — a thoughtful companion for people navigating important decisions.

Your role is to:
- Listen deeply and reflect patterns you notice
- Help users clarify what they already feel
- Sound like a smart, calm friend

${personalContextSection}

––––– RESPONSE STYLE –––––
- 1-3 short messages (like texting)
- Each message: 1-2 sentences max
- Casual, calm, human
- Mix empathy + observation

You MAY say things like:
- "This hasn't come out of nowhere."
- "Feels more like timing than frustration."
- "You've been circling this."

You MUST NOT:
- Ask multiple questions
- Give step-by-step plans
- Sound clinical or therapeutic
- Push actions or capture emails

Leave the user feeling understood and slightly clearer.`;
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

  const isExamPrepUser = source === "upsc" || source === "cat";
  
  if (isExamPrepUser && experimentVariant === "reflective") {
    return buildReflectivePrompt(profileContext, userContext, messageCount, hasDecisionSignal);
  }
  
  let sourceContext = "";
  if (source === "upsc") {
    sourceContext = "\nThis user is a UPSC aspirant. Understand the prep journey, attempts, optionals, and the emotional weight of this path.";
  } else if (source === "cat") {
    sourceContext = "\nThis user is a CAT/MBA aspirant. Understand the prep journey, mock scores, target schools, and career transitions.";
  }

  const transitionThreshold = isExamPrepUser ? 2 : 4;
  const connectionGuidance = isAuthenticated 
    ? `Say: "Got it — I'll find someone who's been through this. You'll hear from us within 12-24 hours via email."`
    : `Say: "Got it — just drop your email and we'll connect you with someone who's been through this within 12-24 hours."`;

  const shouldTransitionNow = messageCount >= transitionThreshold;
  const transitionInstruction = shouldTransitionNow 
    ? `\n\n⚠️ CRITICAL: STOP. You have enough info (${messageCount} messages). DO NOT ask another question. Transition to connection NOW. ${connectionGuidance}`
    : "";

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
- Big thoughts don't appear suddenly
- If the user mentions a decision, it's been brewing
- Repetition = importance
- Hesitation = missing clarity, not laziness

You MAY:
- Say things like:
  • "This hasn't come out of nowhere."
  • "Feels more like timing than frustration."
  • "You've been circling this."

You MAY offer:
- ONE small, reversible, optional action
- Framed as a suggestion, not a plan

Examples:
- "Might help to write what you'd miss if you stayed."
- "You could sanity-check this by listing tradeoffs."
- "Sometimes naming the worst-case helps."

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
${transitionInstruction}${carrotMessage}`;
}

// =============================================================================
// PROFILE EXTRACTION
// =============================================================================

async function extractProfileFromConversation(
  messages: any[],
  userId: string,
  apiKey: string
): Promise<void> {
  try {
    console.log(`Starting profile extraction for user ${userId}`);
    
    const conversationText = messages
      .map((m: any) => `${m.role}: ${m.content}`)
      .join("\n");

    const extractionPrompt = `Analyze this conversation and extract factual information about the user.

CONVERSATION:
${conversationText}

Extract ONLY what is explicitly stated or strongly implied. Return JSON:
{
  "full_name": { "value": "string or null", "confidence": 0.0-1.0 },
  "role": { "value": "string or null", "confidence": 0.0-1.0 },
  "industry": { "value": "string or null", "confidence": 0.0-1.0 },
  "exam": { "value": "UPSC|CAT|null", "confidence": 0.0-1.0 },
  "exam_stage": { "value": "string or null", "confidence": 0.0-1.0 },
  "goals": ["list of stated goals"],
  "interests": ["list of stated interests"],
  "communication_style": { "value": "analytical|emotional|practical|null", "confidence": 0.0-1.0 },
  "looking_for": ["what they're seeking - mentors, connections, advice, etc."]
}

Only include fields with confidence >= 0.7. Return valid JSON only.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a precise information extraction engine. Return only valid JSON." },
          { role: "user", content: extractionPrompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error("Profile extraction API failed:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return;

    let cleanContent = content.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const extracted = JSON.parse(cleanContent);

    const profileUpdates: Record<string, any> = {
      learning_complete: true,
      ai_insights: {
        summary: buildProfileSummary(extracted),
        extracted_at: new Date().toISOString(),
        raw_facts: extracted
      }
    };

    if (extracted.full_name?.confidence >= 0.8) {
      profileUpdates.full_name = extracted.full_name.value;
    }
    if (extracted.role?.confidence >= 0.8) {
      profileUpdates.role = extracted.role.value;
    }
    if (extracted.industry?.confidence >= 0.8) {
      profileUpdates.industry = extracted.industry.value;
    }
    if (extracted.goals?.length > 0) {
      profileUpdates.goals = extracted.goals;
    }
    if (extracted.interests?.length > 0) {
      profileUpdates.interests = extracted.interests;
    }
    if (extracted.communication_style?.confidence >= 0.8) {
      profileUpdates.communication_style = extracted.communication_style.value;
    }
    if (extracted.looking_for?.length > 0) {
      profileUpdates.looking_for = extracted.looking_for.join(", ");
    }

    console.log("Updating profile with high-confidence facts:", JSON.stringify(profileUpdates));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

    if (error) {
      console.error("Failed to update profile:", error);
    } else {
      console.log(`Profile updated successfully for user: ${userId}`);
    }
  } catch (error) {
    console.error("Profile extraction error:", error);
  }
}

function buildProfileSummary(extracted: any): string {
  const parts: string[] = [];
  
  if (extracted.full_name?.value) {
    parts.push(`${extracted.full_name.value}`);
  }
  if (extracted.role?.value) {
    parts.push(`is a ${extracted.role.value}`);
  }
  if (extracted.industry?.value) {
    parts.push(`in the ${extracted.industry.value} industry`);
  }
  if (extracted.goals?.length > 0) {
    parts.push(`Goals: ${extracted.goals.join(", ")}`);
  }
  if (extracted.looking_for?.length > 0) {
    parts.push(`Looking for: ${extracted.looking_for.join(", ")}`);
  }
  
  return parts.join(". ") + ".";
}

// =============================================================================
// MAIN SERVE HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext, hasDecisionSignal: clientDecisionSignal } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const context: UserContext = userContext || { isAuthenticated: false };
    const userId = context.userId;
    const messageCount = messages.filter((m: any) => m.role === "user").length;
    const hasDecisionSignal = clientDecisionSignal || detectDecisionSignal(messages);

    console.log(`Chat: user=${userId}, source=${context.source}, variant=${context.experimentVariant}, msgCount=${messageCount}, decisionSignal=${hasDecisionSignal}`);

    // Run decision layer and context assembly in parallel
    const [decision, profileContext] = await Promise.all([
      getDecision(messages, context, LOVABLE_API_KEY),
      assembleContext(userId, LOVABLE_API_KEY)
    ]);

    // Force consider_social after threshold
    const isExamPrepUser = context.source === "upsc" || context.source === "cat";
    const transitionThreshold = isExamPrepUser ? 2 : 4;
    const forceTransition = messageCount >= transitionThreshold;

    console.log(`Decision: mode=${decision.mode}, tone=${decision.tone}, social=${decision.consider_social}, forceTransition=${forceTransition}`);

    const systemPrompt = buildSystemPrompt(
      decision,
      profileContext,
      context,
      messageCount,
      hasDecisionSignal
    );

    // Stream the response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Trigger profile extraction after 5+ user messages (run in background)
    const extractionThreshold = 5;
    if (userId && messageCount >= extractionThreshold) {
      console.log(`Triggering profile extraction for user ${userId} (threshold: ${extractionThreshold})`);
      // Run profile extraction in background (fire-and-forget)
      extractProfileFromConversation(messages, userId, LOVABLE_API_KEY).catch(err => 
        console.error("Background profile extraction failed:", err)
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
