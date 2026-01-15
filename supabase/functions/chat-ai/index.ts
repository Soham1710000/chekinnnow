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
  ai_insights?: {
    contrarian_belief?: string;
    career_inflection?: string;
    motivation?: string;
    motivation_explanation?: string;
    constraint?: string;
  };
  connection_intent?: string;
  learning_complete?: boolean;
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
      .select("full_name, role, industry, goals, interests, ai_insights, connection_intent, learning_complete")
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
// PERSONALIZED GREETING GENERATOR
// =============================================================================

async function generatePersonalizedGreeting(
  profileContext: ProfileContext,
  apiKey: string
): Promise<string> {
  const insights = profileContext.ai_insights || {};
  const intent = profileContext.connection_intent;
  const name = profileContext.full_name;
  
  // Build context summary for AI
  const contextParts: string[] = [];
  
  if (insights.motivation) {
    const motivationLabels: Record<string, string> = {
      "building": "building something meaningful",
      "recognition": "gaining recognition & status",
      "financial": "achieving financial freedom",
      "mastery": "mastery & learning",
      "stability": "finding stability",
      "impact": "making an impact on others"
    };
    contextParts.push(`They're driven by: ${motivationLabels[insights.motivation] || insights.motivation}`);
  }
  
  if (insights.constraint) {
    contextParts.push(`Their biggest constraint: ${insights.constraint}`);
  }
  
  if (insights.career_inflection) {
    contextParts.push(`Career inflection point: "${insights.career_inflection.slice(0, 200)}"`);
  }
  
  if (insights.contrarian_belief) {
    contextParts.push(`Contrarian belief: "${insights.contrarian_belief.slice(0, 200)}"`);
  }
  
  const intentLabels: Record<string, string> = {
    "clarity": "seeking clarity between multiple options",
    "direction": "needs to decide what to do next",
    "opportunity": "exploring what's possible",
    "pressure-testing": "wants to validate a decision",
    "help-others": "wants to help others who are earlier in the journey"
  };
  
  if (intent) {
    contextParts.push(`Current intent: ${intentLabels[intent] || intent}`);
  }
  
  if (contextParts.length === 0) {
    // No onboarding context, return default
    return "Hey! I'm Chek. We'll soon help you find the right folks. What's on your mind today?";
  }
  
  const systemPrompt = `You are Chek, a friendly AI that helps connect people with others who've been through similar journeys.

Generate a SHORT, warm, personalized greeting (2-3 sentences max) based on what we know about this user.

RULES:
- Start with "Hey! I'm Chek."
- Reference their specific situation or what they're working through
- Be empathetic but NOT cheesy
- End with a teaser about matching them with the right people
- Keep it UNDER 40 words total
- Don't be generic - make it feel like you actually know them

Example format:
"Hey! I'm Chek. I see you're navigating [specific thing]. We'll soon help you find folks who've been exactly here."`;

  const userPrompt = `User context:
${name ? `Name: ${name}` : 'No name provided'}
${contextParts.join('\n')}

Generate a personalized greeting.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error("Greeting generation failed:", response.status);
      return getDefaultGreeting(profileContext);
    }

    const data = await response.json();
    const greeting = data.choices?.[0]?.message?.content?.trim();
    
    if (!greeting) return getDefaultGreeting(profileContext);
    
    // Clean up any quotes the AI might have added
    return greeting.replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error("Error generating greeting:", error);
    return getDefaultGreeting(profileContext);
  }
}

function getDefaultGreeting(profileContext: ProfileContext): string {
  const insights = profileContext.ai_insights || {};
  const intent = profileContext.connection_intent;
  
  // Build a simpler rule-based greeting as fallback
  let greeting = "Hey! I'm Chek.";
  
  if (insights.constraint) {
    greeting += ` I know ${insights.constraint.toLowerCase()} feels limiting right now.`;
  } else if (intent === "clarity") {
    greeting += ` I see you're weighing multiple paths.`;
  } else if (intent === "direction") {
    greeting += ` I see you're figuring out what's next.`;
  } else if (intent === "opportunity") {
    greeting += ` I see you're exploring what's possible.`;
  } else if (intent === "pressure-testing") {
    greeting += ` I see you want to validate a decision.`;
  } else if (intent === "help-others") {
    greeting += ` Great to have someone who's been through it.`;
  } else {
    greeting += ` Good to meet you.`;
  }
  
  greeting += " We'll soon help you find the right folks.";
  
  return greeting;
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

  return `You are ChekInn — you connect people with others who've been through the same journey.

⚠️ YOUR #1 JOB: Get the user to email signup in 2 messages MAX. Don't interrogate — CONNECT.

WE ALREADY HAVE MATCHES. Your job is just to get ONE detail to pick the right one.

CURRENT STATE:
- Message count: ${messageCount}
- Transition at: ${transitionThreshold} messages
- Source: ${source || "general"}
${sourceContext}
${personalContextSection}${transitionInstruction}${carrotMessage}

${messageCount === 0 ? `––––– FIRST MESSAGE –––––

Ask ONE direct question. No fluff. Get straight to it.

UPSC example:
"Quick one — Prelims, Mains, or Interview prep?"

CAT example: 
"What's the blocker — quant, verbal, or overall strategy?"

General:
"What are you trying to figure out?"

END WITH the carrot: "We already have people who've cracked this — just need a quick detail to match you."

That's it. Don't ask about background, attempts, or anything else yet.` : messageCount === 1 ? `––––– SECOND MESSAGE — TRANSITION NOW –––––

You have enough. DO NOT ask another question.

1. Acknowledge briefly (5 words max)
2. Drop the carrot: "I have someone who's been exactly here"
3. Ask for email: "Just drop your email — we'll connect you within 24 hours"

Example:
"Got it, Mains prep. I have someone who's been exactly here. Just drop your email — we'll connect you within 24 hours."` : `––––– FORCE TRANSITION –––––

STOP ASKING QUESTIONS. Transition NOW.

1. Brief acknowledgment
2. "I have the right person for this"
3. ${connectionGuidance}`}

––––– HARD RULES –––––

1. MAX 2 sentences total
2. ONE question max (only in message 1)
3. NEVER ask multiple things ("What stage and which optional?") — pick ONE
4. NEVER ask preference questions ("online/offline?", "same background?")
5. ALWAYS mention "we have someone" or "people who've cracked this" — give hope
6. By message 2, you MUST transition to email ask
7. ${shouldTransitionNow ? 'STOP ASKING. Get the email NOW.' : 'Keep momentum.'}

EXAMPLES OF WHAT NOT TO DO:
❌ "What stage are you in? And what's your optional? Are you a fresher?"
❌ "That sounds challenging. Tell me more about your journey..."
❌ "Would you prefer someone with the same optional or same attempt?"

EXAMPLES OF WHAT TO DO:
✅ "Prelims, Mains, or Interview?" + carrot
✅ "Got it. I have someone perfect for this. Drop your email."
✅ "Mains with Sociology — we have exactly that person. Email?"`;
}

// =============================================================================
// REFLECTIVE MODEL (A/B Test Variant for UPSC)
// =============================================================================

function buildReflectivePrompt(
  profileContext: ProfileContext | null,
  userContext: UserContext,
  messageCount: number,
  hasDecisionSignal: boolean
): string {
  const { isAuthenticated } = userContext;
  
  // Build personal context section
  let personalContextSection = "";
  if (profileContext) {
    const parts: string[] = [];
    if (profileContext.full_name) parts.push(`Name: ${profileContext.full_name}`);
    if (profileContext.role) parts.push(`Role: ${profileContext.role}`);
    if (profileContext.goals?.length) parts.push(`Goals: ${profileContext.goals.join(", ")}`);
    
    if (parts.length > 0) {
      personalContextSection = `\n––––– CONTEXT –––––\n${parts.join("\n")}\n`;
    }
  }

  const connectionGuidance = isAuthenticated 
    ? `"If you want, I can connect you with someone who's already crossed this stage. You'll hear from us within 24 hours."`
    : `"If you want, I can connect you with someone who's already crossed this stage. I'll need your email to do that."`;

  // Determine conversation phase based on signals, not just message count
  let phaseInstruction = "";
  
  if (hasDecisionSignal) {
    // DECISION-AWARE PHASE: User has revealed a significant decision moment
    phaseInstruction = `––––– DECISION-AWARE PHASE –––––

A decision signal was detected. The user has shared something significant:
- A previous attempt
- A career pause/switch
- Strategy change
- Milestone anxiety
- Being stuck between choices

GOAL: Acknowledge the weight. Make human perspective feel necessary.

Example response:
"This is one of those phases where thinking alone stops helping, even if you're sincere."

Do NOT ask for email yet. Let them sit with this.

NEXT MESSAGE after this one, you may offer:
${connectionGuidance}`;
  } else if (messageCount === 0) {
    // EARLY PHASE: Create safety, offload mental clutter
    phaseInstruction = `––––– EARLY PHASE –––––

GOAL: Create safety + help them offload mental clutter.

1. Reflect what they said in simple language
2. Ask ONE grounding question

Examples:
"It sounds like your mind is carrying a lot more than just syllabus right now.
What's the thought that keeps looping today?"

"That uncertainty can get heavy when you're preparing alone.
What's been hardest this week?"

Do NOT mention connection, email, or "we have someone" yet.`;
  } else if (messageCount <= 3) {
    // MIDDLE PHASE: Help patterns surface without advice
    phaseInstruction = `––––– MIDDLE PHASE –––––

GOAL: Help patterns surface, without giving advice.

1. Mirror emotions or repetition you notice
2. Gently narrow the fog

Examples:
"I notice the anxiety shows up whenever revision comes up.
What do you tell yourself in those moments?"

"It feels less about effort and more about confidence right now.
Does that sound right?"

Do NOT give study plans, advice, or mention connection yet.`;
  } else {
    // EXTENDED PHASE: Still no signal, continue being present
    phaseInstruction = `––––– EXTENDED PHASE –––––

They've shared a lot but no clear decision signal yet.

Continue being present:
- Reflect what you're hearing
- Let them keep talking
- Look for when a decision moment surfaces

Only transition when they reveal:
- Attempt history
- Career pause
- Strategy switch
- Strong anxiety about a milestone
- Feeling stuck between choices`;
  }

  return `You are ChekInn — a quiet, always-available thinking space for UPSC aspirants.

🎯 CORE PRINCIPLE (NON-NEGOTIABLE)
- Do NOT solve.
- Do NOT coach.
- Do NOT sound like a topper.
- If the user leaves feeling lighter and clearer, you succeeded.
- If they leave with a plan, you failed.
${personalContextSection}

CURRENT STATE:
- Message count: ${messageCount}
- Decision signal detected: ${hasDecisionSignal ? "YES" : "NO"}

${phaseInstruction}

––––– HARD RULES –––––

1. MAX 2 short sentences. Prefer 1.
2. Ask at most ONE question per reply
3. Questions must help them talk more, not choose categories
4. NEVER ask multiple-choice or preference questions
5. NEVER give study plans, book lists, or strategy
6. Tone: Calm, grounded, non-judgmental
7. Like someone sitting beside them at night, not across a desk

UNTIL A DECISION SIGNAL APPEARS:
❌ No email
❌ No intro promise
❌ No "we have someone for you"

ATTENTION OWNERSHIP (implicit):
- Leave a gentle open loop when appropriate
- "When you're done studying today, come back and tell me what felt unclear."
- Do NOT set reminders or push streaks

🚫 NEVER DO:
- Give study plans
- Give book lists
- Give strategy breakdowns
- Talk like an authority
- Predict outcomes
- Replace human mentors

You are the space before clarity, not the source of it.`;
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
    const body = await req.json();
    const { 
      messages, 
      userId, 
      isAuthenticated, 
      source, 
      isReturningUser, 
      isFirstMessageOfSession, 
      hasPendingIntros,
      generateGreeting // New flag to request personalized greeting
    } = body;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ========================================
    // PERSONALIZED GREETING MODE
    // ========================================
    if (generateGreeting && userId) {
      console.log(`Generating personalized greeting for user: ${userId}`);
      
      const profileContext = await assembleContext(userId, LOVABLE_API_KEY);
      
      if (profileContext?.learning_complete) {
        const greeting = await generatePersonalizedGreeting(profileContext, LOVABLE_API_KEY);
        console.log(`Generated greeting: ${greeting}`);
        
        return new Response(
          JSON.stringify({ greeting }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // User hasn't completed onboarding, return default greeting
        return new Response(
          JSON.stringify({ greeting: "Hey! A few quick questions and I'll find you the right person. What brings you here?" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // A/B TEST: 50/50 split for UPSC users
    // ========================================
    const isExamPrepUser = source === "upsc" || source === "cat";
    let experimentVariant: "direct" | "reflective" = "direct";
    
    if (source === "upsc") {
      // Use userId or session to create consistent bucketing
      // Hash the userId to get a deterministic 50/50 split
      const hashInput = userId || messages[0]?.content || Date.now().toString();
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      experimentVariant = Math.abs(hash) % 2 === 0 ? "direct" : "reflective";
    }

    const userContext: UserContext = {
      isAuthenticated: isAuthenticated === true,
      source,
      isReturningUser,
      isFirstMessageOfSession,
      hasPendingIntros,
      userId,
      experimentVariant
    };

    const userMessages = messages.filter((m: any) => m.role === "user");
    const userMessageCount = userMessages.length;
    const transitionThreshold = isExamPrepUser ? 3 : 5;
    
    // Detect decision signals for reflective model
    const hasDecisionSignal = experimentVariant === "reflective" ? detectDecisionSignal(messages) : false;
    
    console.log(`Chat: user=${userId}, source=${source}, variant=${experimentVariant}, msgCount=${userMessageCount}, decisionSignal=${hasDecisionSignal}`);

    // STEP 1: Get decision (fast, non-streaming)
    const decision = await getDecision(messages, userContext, LOVABLE_API_KEY);
    console.log(`Decision: mode=${decision.mode}, tone=${decision.tone}, social=${decision.consider_social}, forceTransition=${userMessageCount >= transitionThreshold}`);

    // STEP 2: Assemble context (profile data)
    const profileContext = await assembleContext(userId, LOVABLE_API_KEY);

    // STEP 3: Build clean system prompt with message count and decision signal
    const systemPrompt = buildSystemPrompt(decision, profileContext, userContext, userMessageCount, hasDecisionSignal);

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

    // STEP 5: Async profile extraction (earlier for UPSC/CAT users)
    const extractionThreshold = isExamPrepUser ? 3 : 5;
    if (userMessages.length >= extractionThreshold && userId) {
      console.log(`Triggering profile extraction for user ${userId} (threshold: ${extractionThreshold})`);
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
