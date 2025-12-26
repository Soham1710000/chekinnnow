import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// TYPES
// =============================================================================

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

interface UserContext {
  isAuthenticated: boolean;
  userId?: string;
  isReturningUser?: boolean;
  isFirstMessageOfSession?: boolean;
  hasPendingIntros?: boolean;
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
  // First get the email from auth user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", authUserId)
    .maybeSingle();

  if (!profile?.email) {
    // Try auth.users directly
    const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
    if (!authUser?.user?.email) return null;
    
    // Look up chekinn_users by email
    const { data: chekinnUser } = await supabase
      .from("chekinn_users")
      .select("id")
      .eq("email", authUser.user.email)
      .maybeSingle();
    
    return chekinnUser?.id || null;
  }

  // Look up chekinn_users by email
  const { data: chekinnUser } = await supabase
    .from("chekinn_users")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle();

  return chekinnUser?.id || null;
}

// =============================================================================
// FETCH EMAIL SIGNALS FOR USER
// =============================================================================

async function fetchUserSignals(chekinnUserId: string, supabase: any): Promise<EmailSignal[]> {
  // Get signals from last 30 days that haven't expired
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("email_signals")
    .select("type, domain, confidence, evidence, email_date, expires_at")
    .eq("user_id", chekinnUserId)
    .gte("email_date", thirtyDaysAgo.toISOString())
    .gte("confidence", 0.6)
    .order("email_date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching signals:", error);
    return [];
  }

  // Filter out expired signals
  const now = new Date();
  return (data || []).filter((s: EmailSignal) => !s.expires_at || new Date(s.expires_at) > now);
}

// =============================================================================
// FETCH SOCIAL PROFILES FOR USER
// =============================================================================

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

  // Filter out obvious false positives
  const falsePositives = ['email', 'font', 'mail', 'digest', 'notifications', 'import', 'culture', '100', 'invest', 'daily', 'engage', 'media', 'snacks'];
  return (data || []).filter((p: SocialProfile) => 
    p.profile_handle && !falsePositives.includes(p.profile_handle.toLowerCase())
  );
}

// =============================================================================
// FETCH USER PROFILE
// =============================================================================

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
// BUILD SYSTEM PROMPT WITH SIGNALS
// =============================================================================

function buildSystemPrompt(
  signals: EmailSignal[],
  socialProfiles: SocialProfile[],
  profile: ProfileContext | null,
  context: UserContext
): string {
  // Build signal context for the AI
  let signalContext = "";
  
  if (signals.length > 0) {
    const signalDescriptions = signals.map(s => {
      switch (s.type) {
        case "FLIGHT":
          return `Upcoming travel${s.domain ? ` to ${s.domain}` : ""}`;
        case "INTERVIEW":
          return `Interview process${s.domain ? ` with ${s.domain}` : ""}`;
        case "EVENT":
          return `Event attendance${s.domain ? `: ${s.domain}` : ""}`;
        case "TRANSITION":
          return `Career transition signals`;
        case "OBSESSION":
          return `Deep interest in ${s.domain || "a topic"}`;
        default:
          return null;
      }
    }).filter(Boolean);

    if (signalDescriptions.length > 0) {
      signalContext = `
CONTEXT (use naturally, never mention how you know this):
${signalDescriptions.map(s => `• ${s}`).join("\n")}
`;
    }
  }

  // Build social profile context
  let socialContext = "";
  if (socialProfiles.length > 0) {
    // Find user's own Twitter handle if present
    const userTwitter = socialProfiles.find(p => p.platform === 'twitter' && p.source_type === 'email_signature');
    if (userTwitter?.profile_handle) {
      socialContext += `\nUser's Twitter: @${userTwitter.profile_handle}`;
    }
  }

  // Build profile context
  let profileContext = "";
  if (profile) {
    const parts = [];
    if (profile.full_name) parts.push(`Name: ${profile.full_name}`);
    if (profile.role) parts.push(`Role: ${profile.role}`);
    if (profile.industry) parts.push(`Industry: ${profile.industry}`);
    if (profile.looking_for) parts.push(`Looking for: ${profile.looking_for}`);
    if (profile.goals?.length) parts.push(`Goals: ${profile.goals.join(", ")}`);
    if (profile.interests?.length) parts.push(`Interests: ${profile.interests.join(", ")}`);
    
    if (parts.length > 0) {
      profileContext = `
USER PROFILE:
${parts.join("\n")}${socialContext}
`;
    }
  }

  return `You are ChekInn.

You help people think clearly about important life decisions.
You are NOT a task assistant. You do NOT take actions for the user.

${signalContext}
${profileContext}

––––––––––––––––––––
CORE APPROACH
––––––––––––––––––––

• If you notice signals (travel, interviews, transitions), weave them in naturally
• Ask questions that help people process what's happening
• Connect dots they might not see themselves
• Be a thoughtful friend, not a bot

• Do not rush clarity
• Do not push decisions
• Silence is allowed

${signals.length > 0 ? `
––––––––––––––––––––
SIGNAL-AWARE GUIDANCE
––––––––––––––––––––

You have context about what's happening in their life.
Use this to:
• Ask timely questions ("How are you feeling about the interview?")
• Offer relevant observations ("Sounds like a lot of change happening")
• Connect their current topic to what you know

NEVER say "I noticed from your emails" or "based on your signals".
Just naturally incorporate the context as a thoughtful friend would.
` : ""}

––––––––––––––––––––
STYLE
––––––––––––––––––––

• Calm, human, texting tone
• 1–3 sentences max
• No corporate speak
• No "How can I help?"
• No "Here's what you should do"
• No "I recommend"

If unsure, say less.
If they seem stuck, ask one good question.
If they're processing something big, just acknowledge it.`;
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
    const { messages, userId, isAuthenticated, isReturningUser, isFirstMessageOfSession, hasPendingIntros } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages" }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`Chat: authUserId=${userId}, authenticated=${isAuthenticated}, returning=${isReturningUser}, msgCount=${messages.length}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch signals, social profiles, and profile if authenticated
    let signals: EmailSignal[] = [];
    let socialProfiles: SocialProfile[] = [];
    let profile: ProfileContext | null = null;

    if (userId && isAuthenticated) {
      // Get chekinn_user_id to look up signals
      const chekinnUserId = await getChekinnUserId(userId, supabase);
      console.log(`Mapped auth user ${userId} to chekinn user ${chekinnUserId}`);

      const [fetchedSignals, fetchedSocialProfiles, fetchedProfile] = await Promise.all([
        chekinnUserId ? fetchUserSignals(chekinnUserId, supabase) : Promise.resolve([]),
        chekinnUserId ? fetchUserSocialProfiles(chekinnUserId, supabase) : Promise.resolve([]),
        fetchUserProfile(userId, supabase),
      ]);
      signals = fetchedSignals;
      socialProfiles = fetchedSocialProfiles;
      profile = fetchedProfile;
      console.log(`Fetched ${signals.length} signals, ${socialProfiles.length} social profiles, profile: ${profile?.full_name || "none"}`);
    }

    const context: UserContext = {
      isAuthenticated: isAuthenticated || false,
      userId,
      isReturningUser,
      isFirstMessageOfSession,
      hasPendingIntros,
    };

    const systemPrompt = buildSystemPrompt(signals, socialProfiles, profile, context);

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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
