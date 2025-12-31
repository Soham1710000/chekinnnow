import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYER 2: SIGNAL EXTRACTION
 * Model: GPT-4o-mini
 * 
 * Unified signal extraction for:
 * - Email signals (CAREER, TRAVEL, EVENTS, MEETINGS, LIFESTYLE, LIFE_OPS, SOCIAL)
 * - LinkedIn signals (HIRING_IN_NETWORK, MEETING_PREP)
 * 
 * Uses the comprehensive JBTD signal taxonomy
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  user_id: string;
  raw_input_id: string | null;
  user_story: string;
  category: string;
  type: string;
  subtype: string;
  confidence: string;
  evidence: string;
  extraction_method: string;
  ai_reasoning: string;
  occurred_at: string;
  metadata?: Record<string, any>;
}

function parseEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Convert numeric confidence to enum value
function mapConfidenceToEnum(confidence: string | number): string {
  const numConf = typeof confidence === 'string' ? parseFloat(confidence) : confidence;
  if (numConf >= 0.9) return 'VERY_HIGH';
  if (numConf >= 0.7) return 'HIGH';
  if (numConf >= 0.5) return 'MEDIUM';
  return 'LOW';
}

// Pre-filter to skip low-value emails before AI processing
function shouldSkipEmail(email: any): boolean {
  const subject = (email.subject || "").toLowerCase();
  const from = (email.from || "").toLowerCase();
  
  // Skip LinkedIn job alerts (automated notifications)
  if (from.includes("linkedin") || from.includes("jobalerts-noreply")) {
    const jobAlertPatterns = [
      "jobs match your preferences",
      "job alert",
      "new jobs",
      "jobs for you",
      "jobs in",
      "who's hiring",
      "is hiring",
      "similar jobs",
      "jobs at",
      "apply now",
      "recommended jobs"
    ];
    if (jobAlertPatterns.some(p => subject.includes(p))) {
      return true;
    }
  }
  
  // Skip newsletters and marketing
  const skipPatterns = [
    "newsletter", "digest", "weekly roundup", "daily update",
    "unsubscribe", "promotional", "special offer", "discount"
  ];
  if (skipPatterns.some(p => subject.includes(p))) {
    return true;
  }
  
  return false;
}

// Email signal extraction prompt based on JBTD taxonomy
function buildEmailPrompt(email: any): string {
  return `You are extracting ACTIONABLE LIFE SIGNALS from emails. Be VERY selective - only extract signals that are personally directed to this user or represent CONFIRMED actions.

EMAIL:
Subject: ${email.subject || "N/A"}
From: ${email.from || "N/A"}
Date: ${email.date || "N/A"}
Body: ${(email.body || "").slice(0, 4000)}

SIGNAL CATEGORIES (extract signals matching these patterns):

1. CAREER SIGNALS (HIGH PRIORITY - must be PERSONAL):
   - DIRECT_OUTREACH / RECRUITER_PERSONAL: Someone personally reaching out to hire (InMail, direct email). Look for: personal greeting using your name, specific role mention, company intro. HIGH VALUE.
   - CAREER_EVENT / INTERVIEW_CONFIRMED: "Interview scheduled", "Next round"
   - CAREER_EVENT / OFFER_STAGE: "Offer letter", "CTC", "Compensation"
   - DECISION_PRESSURE / TIME_BOUND_OFFER: "48 hours", "Please confirm"
   - NETWORK_HIRING_SIGNAL / KNOWN_CONTACT_HIRING: "We're hiring" from known contact
   - CAREER_SWITCH_INTENT / ROLE_APPLICATION: "Thank you for applying", "Application received" - only for jobs YOU applied to
   
   CRITICAL - DO NOT EXTRACT (these are noise, not signals):
   - ANY LinkedIn job alert emails (e.g. "X jobs match your preferences", "jobs for PM in Bangalore")
   - "X is hiring" emails from LinkedIn - these are automated notifications
   - Mass recruiter emails without personal context
   - Newsletter job roundups
   - Generic "we viewed your profile" messages
   - "Start a conversation" prompts
   - Job board digest emails

2. TRAVEL SIGNALS:
   - TRAVEL_CONFIRMED / UPCOMING_TRIP: Flight booking confirmation with YOUR PNR/booking number
   - TRAVEL_CONFIRMED / IMMINENT_TRIP: Boarding pass, check-in complete
   - STAY_CONTEXT / LOCATION_ANCHOR: Hotel/Airbnb booking with YOUR confirmation
   - ARRIVAL_CONTEXT / GROUND_TRANSPORT: Uber receipt, airport transfer with pickup time

3. EVENT SIGNALS (only REAL events user is personally attending):
   - EVENT_ATTENDANCE / RSVP_CONFIRMED: Confirmed RSVP to Luma, Eventbrite with YOUR ticket
   - EVENT_SCHEDULED / TIME_BOUND: Calendar invite (ICS) with YOUR name in attendees
   - EVENT_INVITE / PRIVATE: Personal invitation addressed to YOU
   
   DO NOT EXTRACT:
   - Course/bootcamp promotional emails
   - Webinar promotions asking to sign up
   - "Join our cohort" sales emails
   - Event announcements not personally addressed

4. SOCIAL SIGNALS:
   - CONNECTION_REQUEST / PERSONAL: LinkedIn connection with personal note mentioning YOU
   - DIRECT_MESSAGE / OUTREACH: Someone specifically reaching out to meet/chat with YOU
   
   DO NOT EXTRACT:
   - Generic LinkedIn notifications
   - "X viewed your profile" notifications
   - "People you may know" suggestions

EXTRACTION RULES:
1. BE EXTREMELY SELECTIVE - when in doubt, DO NOT extract
2. Evidence MUST quote directly from the email
3. Return [] for: newsletters, promos, generic alerts, job digests, automated notifications
4. Only extract if the email is PERSONALLY addressed and ACTIONABLE

OUTPUT FORMAT (JSON array):
[{
  "user_story": "One sentence describing what this signal means",
  "category": "CAREER|TRAVEL|EVENTS|SOCIAL|MEETINGS",
  "type": "SIGNAL_TYPE from above",
  "subtype": "SIGNAL_SUBTYPE from above",
  "confidence": "0.5-1.0",
  "evidence": "exact quote from email",
  "reasoning": "why this is actionable"
}]

If no actionable signals, return [].`;
}

// Process emails from raw_inputs
async function extractEmailSignals(
  rawInputs: any[],
  userId: string,
  openaiKey: string
): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const rawInput of rawInputs) {
    const email = {
      subject: rawInput.raw_metadata?.subject,
      from: rawInput.raw_metadata?.from,
      date: rawInput.raw_metadata?.date,
      body: rawInput.raw_text,
      messageId: rawInput.external_id,
    };

    // Pre-filter to skip low-value emails
    if (shouldSkipEmail(email)) {
      console.log(`[signal-extract] Skipping low-value email: ${email.subject?.slice(0, 50)}`);
      continue;
    }

    const prompt = buildEmailPrompt(email);

    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const apiKey = LOVABLE_API_KEY || openaiKey;
      const apiUrl = LOVABLE_API_KEY 
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
      const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "gpt-4o-mini";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "You extract life signals from emails. Return only valid JSON arrays. Be conservative - only extract clear signals." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        console.error("[signal-extract] AI error:", await response.text());
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";
      
      console.log(`[signal-extract] Email: ${email.subject?.slice(0, 50)} | AI response length: ${content.length}`);

      content = content.trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      let extracted = [];
      try {
        extracted = JSON.parse(content);
        console.log(`[signal-extract] Parsed ${extracted.length} signals from email`);
      } catch (parseErr) {
        console.error(`[signal-extract] JSON parse failed for email ${email.subject}:`, content.slice(0, 200));
        continue;
      }

      for (const s of extracted) {
        if (parseFloat(s.confidence) >= 0.5) {
          signals.push({
            user_id: userId,
            raw_input_id: rawInput.id,
            user_story: s.user_story,
            category: s.category,
            type: s.type,
            subtype: s.subtype || "general",
            confidence: mapConfidenceToEnum(s.confidence),
            evidence: s.evidence,
            extraction_method: "ai_lovable_gemini",
            ai_reasoning: s.reasoning || "",
            occurred_at: rawInput.occurred_at || new Date().toISOString(),
            metadata: {
              gmail_message_id: rawInput.external_id,
              subject: rawInput.raw_metadata?.subject,
              from: rawInput.raw_metadata?.from,
            },
          });
        }
      }
    } catch (err) {
      console.error("[signal-extract] Email parse error:", err);
    }
  }

  return signals;
}

// LinkedIn signal extraction (HIRING and MEETING_PREP)
async function extractLinkedInSignals(
  rawInputs: any[],
  userId: string,
  openaiKey: string
): Promise<Signal[]> {
  const signals: Signal[] = [];

  for (const rawInput of rawInputs) {
    let linkedInData;
    try {
      linkedInData = JSON.parse(rawInput.raw_text);
    } catch {
      console.error("[signal-extract] Failed to parse LinkedIn raw_text");
      continue;
    }

    const mode = rawInput.raw_metadata?.mode || "NETWORK_HIRING";
    const profile = linkedInData.profile || {};
    const posts = linkedInData.posts || [];
    const aboutText = linkedInData.about_text || "";

    const postsText = posts
      .map((p: any, i: number) => `Post ${i + 1}: ${p.post_text}`)
      .join("\n\n");

    const prompt = mode === "NETWORK_HIRING" 
      ? buildHiringPrompt(profile, postsText, aboutText)
      : buildMeetingPrepPrompt(profile, postsText, aboutText);

    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const apiKey = LOVABLE_API_KEY || openaiKey;
      const apiUrl = LOVABLE_API_KEY 
        ? "https://ai.gateway.lovable.dev/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
      const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "gpt-4o-mini";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "You extract LinkedIn signals. Return only valid JSON arrays." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error("[signal-extract] LinkedIn AI error:", await response.text());
        continue;
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";

      content = content.trim();
      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const extracted = JSON.parse(content);

      for (const s of extracted) {
        if (parseFloat(s.confidence) >= 0.5) {
          signals.push({
            user_id: userId,
            raw_input_id: rawInput.id,
            user_story: s.user_story,
            category: s.category || "CAREER",
            type: s.type,
            subtype: s.subtype || "general",
            confidence: mapConfidenceToEnum(s.confidence),
            evidence: s.evidence,
            extraction_method: "ai_lovable_gemini",
            ai_reasoning: s.reasoning || "",
            occurred_at: rawInput.occurred_at,
            metadata: {
              profile_url: profile.profile_url,
              full_name: profile.full_name,
              mode: mode,
            },
          });
        }
      }
    } catch (err) {
      console.error("[signal-extract] LinkedIn parse error:", err);
    }
  }

  return signals;
}

function buildHiringPrompt(profile: any, postsText: string, aboutText: string): string {
  return `You are extracting HIRING SIGNALS from a LinkedIn profile in someone's network.

PROFILE:
Name: ${profile.full_name || "Unknown"}
Headline: ${profile.headline || "N/A"}
Current Role: ${profile.current_role || "N/A"}
Current Company: ${profile.current_company || "N/A"}
Location: ${profile.location || "N/A"}

ABOUT:
${aboutText || "N/A"}

RECENT POSTS:
${postsText || "No recent posts"}

SIGNAL TYPES TO EXTRACT:
1. NETWORK_HIRING_SIGNAL / PUBLIC_HIRING_POST: "We're hiring", "DMs open" in posts
2. NETWORK_HIRING_SIGNAL / FOUNDER_HIRING: "Early hires", "Building the team" from founder/CEO
3. NETWORK_TRANSITION / JOB_CHANGE: "Excited to join", "Starting at" announcements

RULES:
- confidence: 0.5-1.0 (HIGH for founders, MEDIUM for generic posts)
- Evidence must quote directly from content
- Do NOT signal if person is job-seeking themselves
- Return [] if no hiring signals

OUTPUT FORMAT:
[{
  "user_story": "What this hiring opportunity means",
  "category": "CAREER",
  "type": "NETWORK_HIRING_SIGNAL|NETWORK_TRANSITION",
  "subtype": "PUBLIC_HIRING_POST|FOUNDER_HIRING|JOB_CHANGE",
  "confidence": "0.5-1.0",
  "evidence": "quoted text",
  "reasoning": "why this indicates hiring"
}]`;
}

function buildMeetingPrepPrompt(profile: any, postsText: string, aboutText: string): string {
  return `You are extracting MEETING PREP context from a LinkedIn profile.

PROFILE:
Name: ${profile.full_name || "Unknown"}
Headline: ${profile.headline || "N/A"}
Current Role: ${profile.current_role || "N/A"}
Current Company: ${profile.current_company || "N/A"}
Location: ${profile.location || "N/A"}

ABOUT:
${aboutText || "N/A"}

RECENT POSTS:
${postsText || "No recent posts"}

EXTRACT:
1. PERSON_PROFILE / TALKING_POINTS: Topics they're passionate about
2. PERSON_PROFILE / CAREER_CONTEXT: Recent role changes, achievements
3. PERSON_PROFILE / BELIEFS: Strong opinions they've shared

RULES:
- Focus on RECENT content (last 30 days priority)
- Evidence must quote directly
- Prioritize strong opinions and unique perspectives
- Return [] if nothing useful

OUTPUT FORMAT:
[{
  "user_story": "What this tells you about the person",
  "category": "PEOPLE",
  "type": "PERSON_PROFILE",
  "subtype": "TALKING_POINTS|CAREER_CONTEXT|BELIEFS",
  "confidence": "0.5-1.0",
  "evidence": "quoted text",
  "reasoning": "why this is useful for meeting prep"
}]`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { userId, processEmails, processLinkedIn, limit, emailIds } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let emailSignalsCount = 0;
    let linkedInSignalsCount = 0;
    const processLimit = limit || 10;

    // Process emails from raw_inputs
    if (processEmails || (emailIds && emailIds.length > 0)) {
      let query = supabase
        .from("raw_inputs")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "gmail");
      
      // If specific IDs provided, use those; otherwise get unprocessed
      if (emailIds && emailIds.length > 0) {
        query = query.in("id", emailIds);
      } else {
        query = query.eq("processed", false)
          .order("occurred_at", { ascending: false })
          .limit(processLimit);
      }
      
      const { data: emailInputs, error } = await query;
      
      if (error) {
        console.error("[signal-extract] Error fetching email raw_inputs:", error);
      } else if (emailInputs && emailInputs.length > 0) {
        console.log(`[signal-extract] Processing ${emailInputs.length} emails`);
        const emailSignals = await extractEmailSignals(emailInputs, userId, OPENAI_API_KEY);

        if (emailSignals.length > 0) {
          const { error: insertError } = await supabase.from("signals_raw").insert(emailSignals);
          if (insertError) {
            console.error("[signal-extract] Insert error:", insertError);
          } else {
            emailSignalsCount = emailSignals.length;
          }
        }

        // Mark as processed
        const processedIds = emailInputs.map((r) => r.id);
        await supabase
          .from("raw_inputs")
          .update({ processed: true })
          .in("id", processedIds);

        console.log(`[signal-extract] Extracted ${emailSignalsCount} email signals from ${emailInputs.length} emails`);
      }
    }

    // Process LinkedIn raw_inputs
    if (processLinkedIn) {
      const { data: rawInputs, error } = await supabase
        .from("raw_inputs")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "linkedin")
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(processLimit);

      if (error) {
        console.error("[signal-extract] Error fetching LinkedIn raw_inputs:", error);
      } else if (rawInputs && rawInputs.length > 0) {
        const linkedInSignals = await extractLinkedInSignals(rawInputs, userId, OPENAI_API_KEY);

        if (linkedInSignals.length > 0) {
          const { error: insertError } = await supabase.from("signals_raw").insert(linkedInSignals);
          if (insertError) {
            console.error("[signal-extract] LinkedIn insert error:", insertError);
          } else {
            linkedInSignalsCount = linkedInSignals.length;
          }
        }

        // Mark as processed
        const processedIds = rawInputs.map((r) => r.id);
        await supabase
          .from("raw_inputs")
          .update({ processed: true })
          .in("id", processedIds);

        console.log(`[signal-extract] Extracted ${linkedInSignalsCount} LinkedIn signals from ${rawInputs.length} profiles`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted: emailSignalsCount + linkedInSignalsCount,
        emailSignals: emailSignalsCount,
        linkedInSignals: linkedInSignalsCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[signal-extract] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});