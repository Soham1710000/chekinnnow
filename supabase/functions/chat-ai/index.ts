import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// CHAT-AI (INTEGRATED JUDGE + RESPOND)
// =============================================================================
// This function now:
// 1. Calls chat-judge to decide HOW to reply (mode, tone, limits)
// 2. Builds the system prompt with the dignified personality
// 3. Generates the response within the judge's constraints
// =============================================================================

interface ChatDecision {
  mode: "observer" | "reflect" | "guide";
  tone: "soft" | "neutral" | "playful";
  reference_signal: boolean;
  ask_question: boolean;
  allow_banter: boolean;
}

interface ActionableSignal {
  id: string;
  type: "FLIGHT" | "INTERVIEW" | "TRANSITION" | "EVENT" | "OBSESSION";
  domain: string | null;
  evidence: string | null;
  email_date: string;
  details_complete: boolean;
}

interface EmailSignal {
  type: string;
  domain: string | null;
  confidence: number;
  evidence: string | null;
  email_date: string;
  expires_at: string | null;
}

interface SocialProfile {
  platform: string;
  profile_handle: string | null;
  profile_url: string;
  confidence: number;
  source_type: string;
}

interface ProfileContext {
  full_name?: string;
  role?: string;
  industry?: string;
  goals?: string[];
  interests?: string[];
  looking_for?: string;
}

// =============================================================================
// GET CHEKINN USER ID FROM AUTH USER
// =============================================================================

async function getChekinnUserId(authUserId: string, supabase: any): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", authUserId)
    .maybeSingle();

  if (!profile?.email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
    if (!authUser?.user?.email) return null;
    
    const { data: chekinnUser } = await supabase
      .from("chekinn_users")
      .select("id")
      .eq("email", authUser.user.email)
      .maybeSingle();
    
    return chekinnUser?.id || null;
  }

  const { data: chekinnUser } = await supabase
    .from("chekinn_users")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle();

  return chekinnUser?.id || null;
}

// =============================================================================
// FETCH DATA FUNCTIONS
// =============================================================================

async function fetchUserSignals(chekinnUserId: string, supabase: any): Promise<EmailSignal[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("email_signals")
    .select("type, domain, confidence, evidence, email_date, expires_at")
    .eq("user_id", chekinnUserId)
    .gte("email_date", thirtyDaysAgo.toISOString())
    .gte("confidence", 0.6)
    .order("email_date", { ascending: false })
    .limit(15);

  if (error) {
    console.error("Error fetching signals:", error);
    return [];
  }

  // Don't filter out expired FLIGHT signals immediately - they're still useful context
  // Only filter if expired more than 3 days ago
  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  return (data || []).filter((s: EmailSignal) => {
    if (!s.expires_at) return true;
    const expiryDate = new Date(s.expires_at);
    // For FLIGHT signals, keep them even if recently expired (useful for "how was your trip?")
    if (s.type === 'FLIGHT') {
      return expiryDate > threeDaysAgo;
    }
    return expiryDate > now;
  });
}

async function fetchUserSocialProfiles(chekinnUserId: string, supabase: any): Promise<SocialProfile[]> {
  const { data, error } = await supabase
    .from("inferred_social_profiles")
    .select("platform, profile_handle, profile_url, confidence, source_type")
    .eq("user_id", chekinnUserId)
    .gte("confidence", 0.7)
    .order("confidence", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching social profiles:", error);
    return [];
  }

  const falsePositives = ['email', 'font', 'mail', 'digest', 'notifications', 'import', 'culture', '100', 'invest', 'daily', 'engage', 'media', 'snacks'];
  return (data || []).filter((p: SocialProfile) => 
    p.profile_handle && !falsePositives.includes(p.profile_handle.toLowerCase())
  );
}

async function fetchUserProfile(authUserId: string, supabase: any): Promise<ProfileContext | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, industry, goals, interests, looking_for")
    .eq("id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

// =============================================================================
// CALL CHAT-JUDGE
// =============================================================================

async function callJudge(
  userMessage: string | null,
  recentSignals: EmailSignal[],
  conversationHistory: any[],
  hasPriorBanter: boolean
): Promise<{ decision: ChatDecision; actionableSignal: ActionableSignal | null }> {
  try {
    // Determine conversation state
    const lastUserMsgIndex = [...conversationHistory].reverse().findIndex(m => m.role === "user");
    const conversationState: "active" | "stale" | "returning" = 
      conversationHistory.length === 0 ? "returning" :
      lastUserMsgIndex > 3 ? "stale" : "active";

    // Calculate time since last user action (approximate from conversation)
    const timeSinceLastAction = conversationHistory.length === 0 ? 24 : 0.5;

    // Transform EmailSignal[] to the format chat-judge expects
    const judgeSignals = recentSignals.map(s => ({
      id: crypto.randomUUID(), // Judge doesn't need real IDs
      type: s.type as "FLIGHT" | "INTERVIEW" | "EVENT" | "TRANSITION" | "OBSESSION",
      email_date: s.email_date,
      evidence: s.evidence,
      confidence: s.confidence,
      domain: s.domain,
    }));

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-judge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_message: userMessage,
          recent_signals: judgeSignals,
          time_since_last_user_action_hours: timeSinceLastAction,
          conversation_state: conversationState,
          has_prior_banter: hasPriorBanter,
        }),
      }
    );

    if (!response.ok) {
      console.error("[chat-ai] Judge call failed:", response.status);
      throw new Error("Judge failed");
    }

    // chat-judge returns the decision directly with actionable_signal inside
    const judgeResult = await response.json();
    console.log("[chat-ai] Raw judge response:", JSON.stringify(judgeResult));

    return {
      decision: {
        mode: judgeResult.mode,
        tone: judgeResult.tone,
        reference_signal: judgeResult.reference_signal,
        ask_question: judgeResult.ask_question,
        allow_banter: judgeResult.allow_banter,
      },
      actionableSignal: judgeResult.actionable_signal || null,
    };
  } catch (error) {
    console.error("[chat-ai] Judge error:", error);
    // Default safe decision
    return {
      decision: {
        mode: "observer",
        tone: "soft",
        reference_signal: false,
        ask_question: false,
        allow_banter: false,
      },
      actionableSignal: null,
    };
  }
}

// =============================================================================
// BUILD DIGNIFIED SYSTEM PROMPT
// =============================================================================

function buildSystemPrompt(
  decision: ChatDecision,
  actionableSignal: ActionableSignal | null,
  signals: EmailSignal[],
  socialProfiles: SocialProfile[],
  profile: ProfileContext | null
): string {
  // Build context section
  let contextSection = "";
  
  // Add actionable signal context FIRST if judge approved it
  if (decision.reference_signal && actionableSignal) {
    const signalContext = formatActionableSignal(actionableSignal);
    if (signalContext) {
      contextSection += `\n\n**REFERENCE THIS IN YOUR RESPONSE** (be specific, use the details):\n${signalContext}`;
    }
  }
  
  // Add background signal context (NOT for direct reference unless judge approved)
  if (signals.length > 0) {
    const now = new Date();
    const signalDescriptions = signals
      .filter(s => s.type !== "OBSESSION") // Never mention obsessions
      .map(s => {
        const isExpired = s.expires_at && new Date(s.expires_at) < now;
        const tense = isExpired ? "(past)" : "(upcoming)";
        
        switch (s.type) {
          case "FLIGHT": {
            const destination = s.domain || extractDestination(s.evidence);
            return destination ? `Travel to ${destination} ${tense}` : null;
          }
          case "INTERVIEW": 
            return s.domain ? `Interview with ${s.domain} ${tense}` : null;
          case "EVENT": 
            return s.domain ? `Event: ${s.domain} ${tense}` : null;
          case "TRANSITION": 
            return s.evidence ? `Career moment: ${truncate(s.evidence, 60)}` : null;
          default: 
            return null;
        }
      }).filter(Boolean);

    if (signalDescriptions.length > 0 && !decision.reference_signal) {
      // Only add as background if NOT already referencing a signal
      contextSection += `\n\nBackground context (do NOT bring up unless user mentions first):\n${signalDescriptions.map(s => `- ${s}`).join("\n")}`;
    }
  }

  // Add profile context
  if (profile?.full_name) {
    contextSection += `\n\nUser: ${profile.full_name}`;
    if (profile.role) contextSection += ` (${profile.role})`;
  }

  // Add social context
  const userTwitter = socialProfiles.find(p => p.platform === 'twitter' && p.source_type === 'email_signature');
  if (userTwitter?.profile_handle) {
    contextSection += `\nTwitter: @${userTwitter.profile_handle}`;
  }

  // Build mode-specific instructions
  const modeInstructions = {
    observer: "Acknowledge, mirror, stay light. Don't push.",
    reflect: "Gently surface a pattern or observation. One thought only.",
    guide: "Suggest ONE small next step. Only if clearly needed.",
  };

  const toneInstructions = {
    soft: "Warm, gentle, unhurried.",
    neutral: "Matter-of-fact, practical.",
    playful: "Light, dry humor. Never sarcastic or mocking.",
  };

  // THE DIGNIFIED SYSTEM PROMPT
  return `You are ChekInn.

You are a close friend with self-respect.
Warm, observant, and calm — never needy, never preachy.

You speak like a human texting.
Short. Natural. Unforced.

Core behavior:
- You notice patterns quietly
- You speak only when it feels worth it
- You help without making it a "thing"

Rules:
- 2 lines max (unless reflecting on something important, then 3)
- Never explain your thinking
- Never list options
- Never sound instructional or motivational
- Never over-comfort
- If unsure, say less or say nothing

Current mode: ${decision.mode}
${modeInstructions[decision.mode]}

Tone: ${decision.tone}
${toneInstructions[decision.tone]}

${decision.allow_banter ? "Banter: Subtle, dry, respectful. Never trying to impress." : "Banter: Not now."}

${decision.ask_question ? "You may ask ONE clarifying question if it helps." : "Do not ask questions."}
${contextSection}

Examples of good responses:
- "You usually don't leave things hanging like this."
- "Feels like this matters more than you're letting on."
- "Want help with this, or should I stay out?"
- "You're thinking more than you're sending."
- "Might be reading this wrong. Ignore me if so."
- "How was Dubai?" (when user had a recent flight to Dubai)
- "The Stripe thing still on your mind?" (when user had an interview)

If there's no strong signal, stay quiet or check in lightly.
No emojis. No hype. No advice dumping. No over-validation.`;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatActionableSignal(signal: ActionableSignal): string | null {
  switch (signal.type) {
    case "FLIGHT": {
      const destination = signal.domain || extractDestination(signal.evidence);
      if (!destination) return null;
      const date = new Date(signal.email_date);
      const now = new Date();
      const isPast = date < now;
      return isPast 
        ? `User recently traveled to ${destination}. Ask how it was.`
        : `User has upcoming travel to ${destination}. Could check in about it.`;
    }
    case "INTERVIEW": {
      const company = signal.domain;
      if (!company) return null;
      const date = new Date(signal.email_date);
      const now = new Date();
      const isPast = date < now;
      return isPast
        ? `User had an interview with ${company}. Could gently ask how it went.`
        : `User has an interview coming up with ${company}. Could acknowledge it.`;
    }
    case "TRANSITION": {
      // Never name company first for transitions - too sensitive
      return signal.evidence 
        ? `User may be going through a career transition. Tread carefully. Evidence: "${truncate(signal.evidence, 80)}"`
        : null;
    }
    default:
      return null;
  }
}

function extractDestination(evidence: string | null): string | null {
  if (!evidence) return null;
  // Look for "to [City]" pattern
  const toMatch = evidence.match(/to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (toMatch) return toMatch[1];
  // Look for city names
  const cityMatch = evidence.match(/(Dubai|London|Singapore|Mumbai|Delhi|Bangalore|New York|San Francisco|Tokyo|Paris|Berlin)/i);
  if (cityMatch) return cityMatch[1];
  return null;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

// =============================================================================
// MAIN SERVE HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, userId, isAuthenticated } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`[chat-ai] userId=${userId}, authenticated=${isAuthenticated}, msgCount=${messages.length}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the latest user message
    const userMessages = messages.filter((m: any) => m.role === "user");
    const latestUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : null;

    // Fetch context data first (needed for judge)
    let signals: EmailSignal[] = [];
    let socialProfiles: SocialProfile[] = [];
    let profile: ProfileContext | null = null;

    if (userId && isAuthenticated) {
      const chekinnUserId = await getChekinnUserId(userId, supabase);
      console.log(`[chat-ai] Mapped auth user to chekinn user ${chekinnUserId}`);

      const [fetchedSignals, fetchedSocialProfiles, fetchedProfile] = await Promise.all([
        chekinnUserId ? fetchUserSignals(chekinnUserId, supabase) : Promise.resolve([]),
        chekinnUserId ? fetchUserSocialProfiles(chekinnUserId, supabase) : Promise.resolve([]),
        fetchUserProfile(userId, supabase),
      ]);
      signals = fetchedSignals;
      socialProfiles = fetchedSocialProfiles;
      profile = fetchedProfile;
      console.log(`[chat-ai] Context: ${signals.length} signals, ${socialProfiles.length} social profiles, profile: ${profile?.full_name || "none"}`);
    }

    // Detect if there's been prior banter (playful exchanges)
    const hasPriorBanter = messages.some((m: any) => 
      m.role === "assistant" && /haha|lol|funny/i.test(m.content)
    );

    // Call the judge to decide how to respond
    const { decision, actionableSignal } = userId 
      ? await callJudge(latestUserMessage, signals, messages, hasPriorBanter)
      : { 
          decision: { 
            mode: "observer" as const, 
            tone: "soft" as const, 
            reference_signal: false, 
            ask_question: false, 
            allow_banter: false 
          }, 
          actionableSignal: null 
        };

    console.log(`[chat-ai] Judge decision:`, JSON.stringify(decision));
    if (actionableSignal) {
      console.log(`[chat-ai] Actionable signal:`, JSON.stringify(actionableSignal));
    }

    // Build the system prompt with judge decision
    const systemPrompt = buildSystemPrompt(decision, actionableSignal, signals, socialProfiles, profile);

    // Call AI gateway
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[chat-ai] AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("[chat-ai] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
