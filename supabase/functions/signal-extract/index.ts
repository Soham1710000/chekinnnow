import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContextSignal {
  user_id: string;
  domain: "TRAVEL" | "CAREER" | "WORK" | "LEARNING" | "FINANCE" | "SOCIAL";
  pattern: string;
  strength: number;
  evidence: string;
  gmail_message_id: string;
  email_date: string;
}

function parseEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, userId } = await req.json();
    if (!emails || !userId) {
      return new Response(JSON.stringify({ error: "Missing emails or userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const contextSignals: ContextSignal[] = [];

    for (const email of emails) {
      const prompt = `
You are a conservative CONTEXT PATTERN extractor.

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

Return ONLY valid JSON.
`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Extract contextual patterns. Respond with JSON only." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "[]";

      try {
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
        console.error("Context parse error:", err);
      }
    }

    if (contextSignals.length > 0) {
      await supabase.from("email_context_signals").insert(contextSignals);
    }

    return new Response(JSON.stringify({ extracted: contextSignals.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
