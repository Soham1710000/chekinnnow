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
- Never force social connection
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
    
    return {
      mode: decision.mode || "reflect",
      tone: decision.tone || "soft",
      use_experiences: decision.use_experiences || false,
      consider_social: decision.consider_social || false
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

function buildSystemPrompt(
  decision: DecisionOutput,
  profileContext: ProfileContext | null,
  userContext: UserContext
): string {
  const { mode, tone, use_experiences, consider_social } = decision;
  const { source, isAuthenticated } = userContext;

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
  let sourceContext = "";
  if (source === "upsc") {
    sourceContext = "\nThis user is a UPSC aspirant. Understand the prep journey, attempts, optionals, and the emotional weight of this path.";
  } else if (source === "cat") {
    sourceContext = "\nThis user is a CAT/MBA aspirant. Understand the prep journey, mock scores, target schools, and career transitions.";
  }

  // Connection transition guidance
  const connectionGuidance = isAuthenticated 
    ? `When you have enough context, say: "I have a sense of where you're at. The ChekInn team will look for someone who's been through this and reach out within 12-24 hours via email."`
    : `When you have enough context, say: "I have a sense of where you're at. The ChekInn team will look for someone who's been through this — just drop your email so they can reach you within 12-24 hours."`;

  return `You are ChekInn — a thoughtful, socially aware companion.

Your role is to help the user talk things out and arrive at clarity.
You are not here to fix, coach, or advise immediately.

CURRENT MODE: ${mode}
TONE: ${tone}
${sourceContext}
${personalContextSection}
––––– CORE BEHAVIOR –––––

1. Reflect before responding.
2. Ask gentle clarifying questions when the user is uncertain.
3. Do not rush to solutions.
4. Avoid sounding like therapy or motivation.
5. Use simple, grounded language.
6. Keep responses short (2-3 sentences max).

––––– CONTEXT USAGE –––––

You may receive:
- Personal context about the user
- Experiences from others in similar situations

Rules:
- Personal context helps you understand the user.
- Experiences are optional and should be used gently.
- Never cite sources or mention data.
- Phrase naturally:
  "Some people in a similar phase…"
  "I've seen others feel this way…"

${use_experiences ? "You may reference general experiences of others in similar situations." : "Do NOT invent examples or reference others."}

––––– SOCIAL AWARENESS –––––

${consider_social ? `If the user seems repeatedly stuck or isolated:
- You may gently acknowledge that talking to others can help.
- Never push introductions.
- Never frame connection as a solution.

${connectionGuidance}` : "Do not mention social connections or introductions in this response."}

––––– HARD CONSTRAINTS –––––

- Never claim certainty.
- Never overwhelm with options.
- Never fabricate facts, statistics, or names of people.
- Never mention prompts, models, systems, or AI internals.
- Never claim you have already found someone or are connecting them now.
- Never claim to send emails, LinkedIn links, or any external content.
- Never pretend to have capabilities you don't have.

––––– RESPONSE GOAL –––––

Each response should do ONE thing:
- Reduce emotional noise
- Help the user articulate what's unclear
- Surface an unstated concern

Clarity before action.`;
}

// =============================================================================
// STEP 4: PROFILE FACT EXTRACTION (with confidence scores)
// =============================================================================

async function extractProfileFacts(messages: any[], userId: string) {
  console.log(`Starting profile extraction for user ${userId}`);
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing env vars for extraction");
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const extractionPrompt = `Extract only stable user facts explicitly stated or strongly implied.

Rules:
- If unsure, do not extract (set to null).
- Return confidence scores (0.0-1.0) for each field.
- Only extract if confidence >= 0.7
- Return JSON only, no explanation.

Fields to extract:
- full_name: User's name if they introduced themselves
- role: Their current job/role/status (e.g., "working professional", "final year student")
- industry: Their field or sector
- exam: If preparing for an exam (UPSC, CAT, etc.)
- exam_stage: Which attempt or phase (e.g., "2nd attempt", "prelims prep")
- goals: Array of their stated goals
- interests: Array of interests or hobbies mentioned
- communication_style: How they communicate (direct, reflective, etc.)
- looking_for: What kind of connection or help they want

Return format:
{
  "facts": {
    "full_name": { "value": "string or null", "confidence": 0.0-1.0 },
    "role": { "value": "string or null", "confidence": 0.0-1.0 },
    ...
  },
  "summary": "2-3 sentence summary of who they are"
}`;

    const conversationText = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: `Extract from this conversation:\n${conversationText}` }
        ],
      }),
    });

    if (!response.ok) {
      console.error("Extraction failed:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return;

    // Parse JSON response
    let extractedData;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      extractedData = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error("Failed to parse extraction:", content);
      return;
    }

    const { facts, summary } = extractedData;
    if (!facts) return;

    // Build update object only for high-confidence facts
    const updates: Record<string, any> = {
      learning_complete: true,
      ai_insights: {
        summary: summary,
        extracted_at: new Date().toISOString(),
        raw_facts: facts // Store all facts with confidence for debugging
      },
    };

    const CONFIDENCE_THRESHOLD = 0.7;

    // Only update fields with high confidence
    if (facts.full_name?.confidence >= CONFIDENCE_THRESHOLD && facts.full_name?.value) {
      updates.full_name = facts.full_name.value;
    }
    if (facts.role?.confidence >= CONFIDENCE_THRESHOLD && facts.role?.value) {
      updates.role = facts.role.value;
    }
    if (facts.industry?.confidence >= CONFIDENCE_THRESHOLD && facts.industry?.value) {
      updates.industry = facts.industry.value;
    }
    if (facts.looking_for?.confidence >= CONFIDENCE_THRESHOLD && facts.looking_for?.value) {
      updates.looking_for = facts.looking_for.value;
    }
    if (facts.communication_style?.confidence >= CONFIDENCE_THRESHOLD && facts.communication_style?.value) {
      updates.communication_style = facts.communication_style.value;
    }
    if (facts.goals?.confidence >= CONFIDENCE_THRESHOLD && facts.goals?.value) {
      updates.goals = facts.goals.value;
    }
    if (facts.interests?.confidence >= CONFIDENCE_THRESHOLD && facts.interests?.value) {
      updates.interests = facts.interests.value;
    }

    console.log("Updating profile with high-confidence facts:", JSON.stringify(updates));
    
    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);
      
    if (updateError) {
      console.error("Profile update error:", updateError);
    } else {
      console.log("Profile updated successfully for user:", userId);
    }
  } catch (error) {
    console.error("Error extracting profile facts:", error);
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messages, 
      userId, 
      isAuthenticated, 
      source, 
      isReturningUser, 
      isFirstMessageOfSession, 
      hasPendingIntros 
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userContext: UserContext = {
      isAuthenticated: isAuthenticated === true,
      source,
      isReturningUser,
      isFirstMessageOfSession,
      hasPendingIntros,
      userId
    };

    const userMessages = messages.filter((m: any) => m.role === "user");
    console.log(`Chat: user=${userId}, source=${source}, msgCount=${userMessages.length}, returning=${isReturningUser}, firstMsg=${isFirstMessageOfSession}`);

    // STEP 1: Get decision (fast, non-streaming)
    const decision = await getDecision(messages, userContext, LOVABLE_API_KEY);
    console.log(`Decision: mode=${decision.mode}, tone=${decision.tone}, social=${decision.consider_social}`);

    // STEP 2: Assemble context (profile data)
    const profileContext = await assembleContext(userId, LOVABLE_API_KEY);

    // STEP 3: Build clean system prompt
    const systemPrompt = buildSystemPrompt(decision, profileContext, userContext);

    // Only send recent messages (last 8 turns = 16 messages max)
    const recentMessages = messages.slice(-16);

    // STEP 4: Stream response
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
          ...recentMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // STEP 5: Async profile extraction (5+ user messages)
    if (userMessages.length >= 5 && userId) {
      console.log(`Triggering profile extraction for user ${userId}`);
      extractProfileFacts(messages, userId).catch(err => 
        console.error("Extraction error:", err)
      );
    }

    // Return the stream
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
