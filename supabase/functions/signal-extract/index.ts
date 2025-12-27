import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  user_id: string;
  type: "FLIGHT" | "INTERVIEW" | "EVENT" | "TRANSITION" | "OBSESSION";
  domain: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  gmail_message_id: string;
  email_date: string;
}

// Parse RFC 2822 date format to ISO 8601
function parseEmailDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const signals: Signal[] = [];

    for (const email of emails) {
      const prompt = `
You are a conservative signal extraction engine.

Your job is to extract ONLY clear, factual life signals from a SINGLE email.
If a signal is incomplete or ambiguous, DO NOT extract it.

EMAIL:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

SIGNAL TYPES (STRICT):

FLIGHT
- Only extract if at least TWO of these exist:
  destination, departure date/time, flight number, boarding pass language
- Ignore invoices that lack travel details

INTERVIEW
- Scheduled interviews, screening calls, hiring rounds
- Ignore prep courses or content

EVENT
- Calendar invites, conferences, meetups
- Ignore newsletters unless attendance is explicit

TRANSITION
- ONLY if explicit offer / resignation language exists:
  "offer letter", "we are pleased to offer", "joining date", "resignation"
- Ignore warnings, spam, or advisory emails

OBSESSION
- ONLY for strong commitment:
  paid courses, enrollments, subscriptions
- Confidence must be ≥ 0.75
- Ignore articles, interviews, free newsletters

RULES:
1. Confidence ≥ 0.6 (≥ 0.75 for OBSESSION)
2. Extract facts, NOT interpretations
3. Evidence must quote or closely paraphrase a concrete phrase
4. Never infer emotions, urgency, or decisions
5. If required details are missing, return no signal

EXPIRY:
- FLIGHT → departure time
- INTERVIEW → interview time + 48h
- EVENT → event end
- TRANSITION → 14 days from email date
- OBSESSION → null

OUTPUT:
Return JSON array:
{
  "type": "FLIGHT|INTERVIEW|EVENT|TRANSITION|OBSESSION",
  "domain": "airline, company, or topic",
  "confidence": 0.0-1.0,
  "evidence": "quoted or paraphrased phrase",
  "expires_at": "ISO timestamp or null"
}

If no valid signals exist, return [].
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
            { role: "system", content: "You extract conservative life signals. Respond with JSON only." },
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

        const extractedSignals = JSON.parse(content);

        for (const signal of extractedSignals) {
          if (signal.confidence >= 0.6) {
            signals.push({
              user_id: userId,
              type: signal.type,
              domain: signal.domain || "unknown",
              confidence: signal.confidence,
              evidence: signal.evidence || "",
              expires_at: signal.expires_at ? parseEmailDate(signal.expires_at) : null,
              gmail_message_id: email.messageId,
              email_date: parseEmailDate(email.date),
            });
          }
        }
      } catch (err) {
        console.error("Signal parse error:", err);
      }
    }

    // Deduplicate by gmail_message_id (highest confidence wins)
    if (signals.length > 0) {
      const deduped = new Map<string, Signal>();
      for (const s of signals) {
        const existing = deduped.get(s.gmail_message_id);
        if (!existing || s.confidence > existing.confidence) {
          deduped.set(s.gmail_message_id, s);
        }
      }

      const uniqueSignals = Array.from(deduped.values());

      const { error } = await supabase.from("email_signals").upsert(
        uniqueSignals.map((s) => ({
          user_id: s.user_id,
          type: s.type,
          domain: s.domain,
          confidence: s.confidence,
          evidence: s.evidence,
          expires_at: s.expires_at,
          gmail_message_id: s.gmail_message_id,
          email_date: s.email_date,
        })),
        { onConflict: "gmail_message_id" },
      );

      if (error) throw error;
    }

    return new Response(JSON.stringify({ signals: signals.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
