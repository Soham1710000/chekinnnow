import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

// Minimum confidence and scrape limits
const MIN_CONFIDENCE = 0.7;
const MAX_SCRAPES_PER_RUN = 5;

interface EmailSignals {
  intents: string[];
  urgency: string[];
  loops: string[];
  opportunities: string[];
  entities: string[];
}

async function scrapeWithFirecrawl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.error("[scrape-gmail] FIRECRAWL_API_KEY not set");
    return null;
  }
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error("[scrape-gmail] Firecrawl error:", await response.text());
      return null;
    }
    const data = await response.json();
    return data.data?.markdown || null;
  } catch (error) {
    console.error("[scrape-gmail] scrape error:", error);
    return null;
  }
}

async function extractSignalsFromContent(content: string): Promise<EmailSignals> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `
You analyze EMAIL content to infer high-level life signals used for personalized conversational context.

Extract ONLY the following:
1. Intents — actions the user may be considering (quitting, switching roles, moving cities, career pivot)
2. Urgency — deadlines, schedule constraints, expiring events
3. Loops — signs the same topic is repeating or revisited
4. Opportunities — job reach-outs, events, invitations
5. Entities — companies, roles, cities (generic, no personal names)

Rules:
- Do NOT include personal names or identify specific private details.
- Do NOT quote emails.
- Use concise 1–4 word phrases.
- If unsure, return empty lists.

Respond in strict JSON:
{
  "intents": [],
  "urgency": [],
  "loops": [],
  "opportunities": [],
  "entities": []
}
`,
        },
        {
          role: "user",
          content: content.slice(0, 4000),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    console.error("[scrape-gmail] signal extraction failed");
    return { intents: [], urgency: [], loops: [], opportunities: [], entities: [] };
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { intents: [], urgency: [], loops: [], opportunities: [], entities: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase
      .from("inferred_social_profiles")
      .select("*")
      .eq("scrape_status", "pending")
      .gte("confidence", MIN_CONFIDENCE)
      .order("confidence", { ascending: false })
      .limit(MAX_SCRAPES_PER_RUN);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: profiles, error } = await query;
    if (error || !profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ success: true, scraped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scrapedCount = 0;
    let signalsCreated = 0;

    for (const profile of profiles) {
      const content = await scrapeWithFirecrawl(profile.profile_url);

      if (!content) {
        await supabase
          .from("inferred_social_profiles")
          .update({
            scrape_status: "failed",
            scraped_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
        continue;
      }

      const signals = await extractSignalsFromContent(content);

      const signalTypes = [
        { type: "intent", values: signals.intents, weight: 1.0 },
        { type: "urgency", values: signals.urgency, weight: 1.2 },
        { type: "loop", values: signals.loops, weight: 1.3 },
        { type: "opportunity", values: signals.opportunities, weight: 1.1 },
        { type: "entity", values: signals.entities, weight: 0.6 },
      ];

      for (const { type, values, weight } of signalTypes) {
        for (const value of values) {
          const { data: existing } = await supabase
            .from("social_signals")
            .select("id")
            .eq("user_id", profile.user_id)
            .eq("signal_type", type)
            .eq("signal_value", value)
            .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString());

          if (existing?.length) continue;

          const { error } = await supabase.from("social_signals").insert({
            user_id: profile.user_id,
            profile_id: profile.id,
            signal_type: type,
            signal_value: value,
            confidence: Math.min(profile.confidence * weight, 1),
            evidence: `Inferred from ${profile.platform} profile`,
            expires_at: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          });

          if (!error) signalsCreated++;
        }
      }

      await supabase
        .from("inferred_social_profiles")
        .update({
          scrape_status: "scraped",
          scraped_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      scrapedCount++;
    }

    return new Response(JSON.stringify({ success: true, scraped: scrapedCount, signalsCreated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "signal extraction error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
