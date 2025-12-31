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

// Email signal extraction prompt based on JBTD taxonomy
function buildEmailPrompt(email: any): string {
  return `You are extracting LIFE SIGNALS from emails using a comprehensive taxonomy.

EMAIL:
Subject: ${email.subject || "N/A"}
From: ${email.from || "N/A"}
Date: ${email.date || "N/A"}
Body: ${(email.body || "").slice(0, 4000)}

SIGNAL CATEGORIES (extract signals matching these patterns):

1. CAREER SIGNALS:
   - CAREER_SWITCH_INTENT / ROLE_APPLICATION: "Thank you for applying", "Application received"
   - CAREER_INTENSITY / APPLICATION_SPIKE: Multiple applications in short window
   - CAREER_EVENT / INTERVIEW_CONFIRMED: "Interview scheduled", "Next round"
   - CAREER_FRICTION / PROCESS_DELAY: "Rescheduled", "Pushed"
   - MARKET_DEMAND_SIGNAL / RECRUITER_INTERESTED: "Came across your profile", "Quick chat"
   - CAREER_EVENT / OFFER_STAGE: "Offer letter", "CTC", "Compensation"
   - DECISION_PRESSURE / TIME_BOUND_OFFER: "48 hours", "Please confirm"
   - NETWORK_HIRING_SIGNAL / KNOWN_CONTACT_HIRING: "We're hiring" from known contact

2. TRAVEL SIGNALS:
   - TRAVEL_CONFIRMED / UPCOMING_TRIP: Flight booking confirmation, airline, PNR
   - TRAVEL_CONFIRMED / IMMINENT_TRIP: Boarding pass, check-in complete
   - STAY_CONTEXT / LOCATION_ANCHOR: Hotel/Airbnb booking with address
   - ARRIVAL_CONTEXT / GROUND_TRANSPORT: Uber, airport transfer, pickup time

3. EVENT SIGNALS:
   - EVENT_ATTENDANCE / RSVP_CONFIRMED: Luma, Eventbrite RSVP
   - EVENT_SCHEDULED / TIME_BOUND: Calendar invite (ICS) with location+time
   - EVENT_INVITE / PRIVATE: "You're invited" to exclusive event
   - EVENT_SIGNAL / SPEAKER_EVENT: "Speaking at" mention

4. MEETING SIGNALS:
   - UPCOMING_MEETING / EXTERNAL: External meeting with non-org attendees
   - MEETING_CONTEXT / FIRST_MEETING: Meeting with unknown contact
   - MEETING_CONTEXT / COMPLEX_THREAD: Long email threads (>5 replies)
   - MEETING_CONTEXT / MATERIAL_REVIEW: Decks, docs attachments

5. LIFESTYLE SIGNALS:
   - TASTE_PROFILE / FOOD: Food delivery, restaurant bookings
   - TASTE_PROFILE / VENUE: Cafe, venue photos
   - BEHAVIORAL_SIGNAL / CONSUMPTION: Subscriptions (Zomato, BookMyShow)

6. LIFE_OPS SIGNALS:
   - FOLLOW_UP_GAP / MISSED_REPLY: Important unreplied mail (5-7 days)
   - DECISION_DELAY / STALLED_CHOICE: "Will get back", no follow-up

EXTRACTION RULES:
1. Only extract signals with confidence >= 0.5
2. Evidence MUST quote directly from the email
3. Return [] if no signals found
4. Do NOT hallucinate - only extract what's clearly in the email
5. Confidence levels:
   - 0.9-1.0 = VERY_HIGH (explicit confirmation)
   - 0.7-0.8 = HIGH (strong indicator)
   - 0.5-0.6 = MEDIUM (suggestive but not certain)

OUTPUT FORMAT (JSON array):
[{
  "user_story": "One sentence describing what this signal means",
  "category": "CAREER|TRAVEL|EVENTS|MEETINGS|LIFESTYLE|LIFE_OPS|SOCIAL",
  "type": "SIGNAL_TYPE from above",
  "subtype": "SIGNAL_SUBTYPE from above",
  "confidence": "0.5-1.0",
  "evidence": "exact quote from email",
  "reasoning": "why this indicates the signal"
}]

If no meaningful signals, return [].`;
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

    const prompt = buildEmailPrompt(email);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You extract life signals from emails. Return only valid JSON arrays. Be conservative - only extract clear signals." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        console.error("[signal-extract] OpenAI error:", await response.text());
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
            category: s.category,
            type: s.type,
            subtype: s.subtype || "general",
            confidence: s.confidence,
            evidence: s.evidence,
            extraction_method: "ai_gpt4o_mini",
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
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You extract LinkedIn signals. Return only valid JSON arrays." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        console.error("[signal-extract] LinkedIn OpenAI error:", await response.text());
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
            confidence: s.confidence,
            evidence: s.evidence,
            extraction_method: "ai_gpt4o_mini",
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
    const { userId, processEmails, processLinkedIn, limit } = body;

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
    if (processEmails) {
      const { data: emailInputs, error } = await supabase
        .from("raw_inputs")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "gmail")
        .eq("processed", false)
        .order("occurred_at", { ascending: false })
        .limit(processLimit);

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