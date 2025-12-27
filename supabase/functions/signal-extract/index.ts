import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  user_id: string;
  type: "TRAVEL" | "CAREER" | "WORK" | "FINANCE" | "LEARNING" | "SOCIAL";
  subtype: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  intent_hint?: "follow_up" | "prepare" | "decide" | "show_up" | "ignore";
  gmail_message_id: string;
  email_date: string;
}

// Parse RFC 2822 / ISO dates safely
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

    const signals: Signal[] = [];

    for (const email of emails) {
      const prompt = `
You are a conservative life-context extraction engine.

Your job is to extract ONLY clear, factual life contexts from a SINGLE email.
Do NOT infer emotions, urgency, or intent.
If unsure, return [].

EMAIL:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

DOMAINS & SUBTYPES:
- TRAVEL: flight, hotel, visa, conference travel
- CAREER: job application, interview, offer, resignation
- WORK: meeting, commitment, follow-up, project artifact
- FINANCE: salary, bonus, offer compensation, large purchase
- LEARNING: paid course, certification, bootcamp enrollment
- SOCIAL: event invite, community, speaking, public appearance

RULES:
1. Confidence must be ≥ 0.6 (≥ 0.75 for FINANCE or LEARNING)
2. Extract facts only — not tasks
3. Evidence must quote or closely paraphrase a concrete phrase
4. Never extract reminders or advice
5. If expiration is unclear, set expires_at = null

INTENT_HINT (ONLY if obvious from text):
- prepare (something upcoming)
- follow_up (response expected)
- show_up (attendance implied)
- decide (offer / choice present)
- ignore (FYI-only content)

EXPIRY GUIDELINES:
- TRAVEL → start date
- CAREER interview → interview date + 48h
- CAREER offer → 14 days
- WORK meeting → meeting end
- FINANCE → null
- LEARNING → null
- SOCIAL event → event end

OUTPUT:
Return a JSON array:
{
  "type": "...",
  "subtype": "...",
  "confidence": 0.0–1.0,
  "evidence": "...",
  "expires_at": "ISO timestamp or null",
  "intent_hint": "optional"
}

If nothing qualifies, return [].
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
            { role: "system", content: "You extract life context. Respond with JSON only." },
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
          if (s.confidence >= 0.6) {
            signals.push({
              user_id: userId,
              type: s.type,
              subtype: s.subtype || "unknown",
              confidence: s.confidence,
              evidence: s.evidence,
              expires_at: s.expires_at ? parseEmailDate(s.expires_at) : null,
              intent_hint: s.intent_hint,
              gmail_message_id: email.messageId,
              email_date: parseEmailDate(email.date),
            });
          }
        }
      } catch (err) {
        console.error("Parse error:", err);
      }
    }

    // Deduplicate by gmail_message_id (highest confidence wins)
    const deduped = new Map<string, Signal>();
    for (const s of signals) {
      const existing = deduped.get(s.gmail_message_id);
      if (!existing || s.confidence > existing.confidence) {
        deduped.set(s.gmail_message_id, s);
      }
    }

    const uniqueSignals = Array.from(deduped.values());

    if (uniqueSignals.length > 0) {
      const { error } = await supabase.from("email_signals").upsert(
        uniqueSignals.map((s) => ({
          user_id: s.user_id,
          type: s.type,
          subtype: s.subtype,
          confidence: s.confidence,
          evidence: s.evidence,
          expires_at: s.expires_at,
          intent_hint: s.intent_hint,
          gmail_message_id: s.gmail_message_id,
          email_date: s.email_date,
        })),
        { onConflict: "gmail_message_id" },
      );
      if (error) throw error;
    }

    return new Response(JSON.stringify({ extracted: uniqueSignals.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
