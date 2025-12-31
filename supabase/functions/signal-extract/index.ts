import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYER 2: SIGNAL EXTRACTION
 * Model: OpenAI o1-preview (98% precision)
 * 
 * Supports:
 * - Email signals (TRAVEL, CAREER, WORK, LEARNING, FINANCE, SOCIAL)
 * - LinkedIn signals (HIRING_IN_NETWORK, MEETING_PREP)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContextSignal {
  user_id: string;
  domain: string;
  pattern: string;
  strength: number;
  evidence: string;
  gmail_message_id: string;
  email_date: string;
}

interface LinkedInSignal {
  user_id: string;
  raw_input_id: string;
  user_story: string;
  category: string;
  type: string;
  subtype: string;
  confidence: string;
  evidence: string;
  extraction_method: string;
  ai_reasoning: string;
  occurred_at: string;
}

function parseEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Extract signals from emails (existing logic)
async function extractEmailSignals(
  emails: any[],
  userId: string,
  openaiKey: string
): Promise<ContextSignal[]> {
  const contextSignals: ContextSignal[] = [];

  for (const email of emails) {
    const prompt = `You are a conservative CONTEXT PATTERN extractor.

Your job is NOT to extract events or facts.
Your job is to notice **recurring or meaningful life contexts**
suggested by this email.

If the email is purely transactional or informational, return [].

EMAIL:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

DOMAINS:
- TRAVEL: trip planning, logistics, movement
- CAREER: job exploration, role uncertainty, hiring processes
- WORK: ongoing projects, commitments, follow-ups
- LEARNING: courses, preparation, skill building
- FINANCE: compensation, spending, financial decisions
- SOCIAL: events, speaking, community presence

RULES:
1. Do NOT extract facts (no destinations, dates, companies)
2. Do NOT infer decisions or urgency
3. Patterns must be **vague but defensible**
4. Evidence must quote a phrase from the email
5. Strength:
   - 0.3–0.5 → weak signal
   - 0.6–0.8 → strong recurring context
   - 0.9 → clear ongoing focus
6. If unsure, return []

OUTPUT:
Return JSON array:
{
  "domain": "...",
  "pattern": "short human-readable description",
  "strength": 0.0–1.0,
  "evidence": "quoted phrase"
}

Examples:
- "active travel planning"
- "career exploration phase"
- "interview preparation mode"
- "ongoing project coordination"
- "learning-focused period"

Return ONLY valid JSON.`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "o1-preview",
          messages: [{ role: "user", content: prompt }],
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
        if (s.strength >= 0.5) {
          contextSignals.push({
            user_id: userId,
            domain: s.domain,
            pattern: s.pattern,
            strength: s.strength,
            evidence: s.evidence,
            gmail_message_id: email.messageId,
            email_date: parseEmailDate(email.date),
          });
        }
      }
    } catch (err) {
      console.error("[signal-extract] Email parse error:", err);
    }
  }

  return contextSignals;
}

// Extract signals from LinkedIn data (new logic)
async function extractLinkedInSignals(
  rawInputs: any[],
  userId: string,
  openaiKey: string
): Promise<LinkedInSignal[]> {
  const signals: LinkedInSignal[] = [];

  for (const rawInput of rawInputs) {
    const linkedInData = JSON.parse(rawInput.raw_text);
    const mode = rawInput.raw_metadata?.mode || "NETWORK_HIRING";
    const profile = linkedInData.profile;
    const posts = linkedInData.posts || [];
    const aboutText = linkedInData.about_text || "";

    // Build context for extraction
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
          model: "o1-preview",
          messages: [{ role: "user", content: prompt }],
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
            category: s.category,
            type: s.type,
            subtype: s.subtype || "general",
            confidence: s.confidence,
            evidence: s.evidence,
            extraction_method: "ai_o1_preview",
            ai_reasoning: s.reasoning || "",
            occurred_at: rawInput.occurred_at,
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
Name: ${profile.full_name}
Headline: ${profile.headline || "N/A"}
Current Role: ${profile.current_role || "N/A"}
Current Company: ${profile.current_company || "N/A"}
Location: ${profile.location || "N/A"}

ABOUT:
${aboutText || "N/A"}

RECENT POSTS:
${postsText || "No recent posts"}

EXTRACTION RULES:
1. Look for HIRING INTENT signals:
   - "We're hiring" / "Join our team" / "Open roles"
   - "Early hires" / "Building the team" / "Growing fast"
   - "DMs open" for opportunities
   - Founder/CEO/Leader roles (higher likelihood of hiring)

2. For each signal found, output:
   - user_story: One sentence describing the hiring opportunity
   - category: "HIRING"
   - type: "PUBLIC_POST" | "FOUNDER_SIGNAL" | "HEADLINE_SIGNAL"
   - subtype: "early_hire" | "team_growth" | "open_role" | "dm_open"
   - confidence: "0.5" to "1.0" (string)
   - evidence: Direct quote from post/headline
   - reasoning: Why this indicates hiring intent

3. Do NOT signal if:
   - Person is job-seeking themselves
   - Generic motivational posts
   - Old/outdated signals

Return ONLY valid JSON array:
[{
  "user_story": "...",
  "category": "HIRING",
  "type": "...",
  "subtype": "...",
  "confidence": "0.8",
  "evidence": "quoted text",
  "reasoning": "..."
}]

If no hiring signals, return [].`;
}

function buildMeetingPrepPrompt(profile: any, postsText: string, aboutText: string): string {
  return `You are extracting MEETING PREP context from a LinkedIn profile.

PROFILE:
Name: ${profile.full_name}
Headline: ${profile.headline || "N/A"}
Current Role: ${profile.current_role || "N/A"}
Current Company: ${profile.current_company || "N/A"}
Location: ${profile.location || "N/A"}

ABOUT:
${aboutText || "N/A"}

RECENT POSTS:
${postsText || "No recent posts"}

EXTRACTION RULES:
1. Extract TALKING POINTS and CONTEXT:
   - Current focus/projects
   - Recent announcements
   - Opinions/perspectives shared
   - Interests/passions
   - Achievements/milestones

2. For each signal found, output:
   - user_story: One sentence describing the talking point
   - category: "MEETING_PREP"
   - type: "FOCUS" | "ANNOUNCEMENT" | "OPINION" | "INTEREST" | "ACHIEVEMENT"
   - subtype: specific topic
   - confidence: "0.5" to "1.0" (string)
   - evidence: Direct quote from post/about
   - reasoning: Why this is useful for meeting prep

3. Prioritize:
   - Recent content (last 30 days)
   - Strong opinions they've shared
   - Topics they seem passionate about

Return ONLY valid JSON array:
[{
  "user_story": "...",
  "category": "MEETING_PREP",
  "type": "...",
  "subtype": "...",
  "confidence": "0.8",
  "evidence": "quoted text",
  "reasoning": "..."
}]

If no useful signals, return [].`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { emails, userId, processLinkedIn } = body;

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

    // Process emails if provided
    if (emails && emails.length > 0) {
      const contextSignals = await extractEmailSignals(emails, userId, OPENAI_API_KEY);

      if (contextSignals.length > 0) {
        await supabase.from("email_context_signals").insert(contextSignals);
        emailSignalsCount = contextSignals.length;
      }

      console.log(`[signal-extract] Extracted ${emailSignalsCount} email signals`);
    }

    // Process LinkedIn raw_inputs if requested
    if (processLinkedIn) {
      const { data: rawInputs, error } = await supabase
        .from("raw_inputs")
        .select("*")
        .eq("user_id", userId)
        .eq("source", "linkedin")
        .eq("processed", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("[signal-extract] Error fetching raw_inputs:", error);
      } else if (rawInputs && rawInputs.length > 0) {
        const linkedInSignals = await extractLinkedInSignals(rawInputs, userId, OPENAI_API_KEY);

        if (linkedInSignals.length > 0) {
          await supabase.from("signals_raw").insert(linkedInSignals);
          linkedInSignalsCount = linkedInSignals.length;
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
