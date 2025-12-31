import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LINKEDIN SCRAPER
 * Extracts structured data: profile + posts (last 30-60 days) + about snippet
 * Stores in raw_inputs for signal-extract to process
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

interface LinkedInProfile {
  profile_url: string;
  full_name: string;
  headline: string | null;
  current_role: string | null;
  current_company: string | null;
  location: string | null;
}

interface LinkedInPost {
  post_url: string;
  post_text: string;
  posted_at: string | null;
  media_type: "text" | "image" | "video" | "article" | null;
  external_links?: string[];
  is_reshare?: boolean;
}

interface LinkedInRawData {
  profile: LinkedInProfile;
  posts: LinkedInPost[];
  about_text?: string;
}

async function scrapeLinkedInProfile(profileUrl: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.error("[linkedin-scrape] FIRECRAWL_API_KEY not set");
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
        url: profileUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    if (!response.ok) {
      console.error("[linkedin-scrape] Firecrawl error:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || null;
  } catch (error) {
    console.error("[linkedin-scrape] Scrape error:", error);
    return null;
  }
}

async function extractStructuredData(
  rawContent: string,
  profileUrl: string
): Promise<LinkedInRawData | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[linkedin-scrape] LOVABLE_API_KEY not set");
    return null;
  }

  const prompt = `Extract structured LinkedIn profile data from this content.

RAW CONTENT:
${rawContent.slice(0, 8000)}

EXTRACT THIS STRUCTURE:
1. profile: { profile_url, full_name, headline, current_role, current_company, location }
2. posts: array of recent posts (last 30-60 days) with { post_url, post_text, posted_at, media_type, external_links, is_reshare }
3. about_text: first ~300 chars of the About section

RULES:
- For posts, focus on AUTHORED posts (not reshares unless clearly indicated)
- media_type: "text" | "image" | "video" | "article" | null
- If a field is unclear, use null
- Do NOT invent data - only extract what's visible
- post_text should be the full post content, not truncated
- external_links: any URLs mentioned in posts

Return ONLY valid JSON:
{
  "profile": { ... },
  "posts": [ ... ],
  "about_text": "..."
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("[linkedin-scrape] AI extraction error:", await response.text());
      return null;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(content);
    
    // Ensure profile_url is set
    if (parsed.profile) {
      parsed.profile.profile_url = profileUrl;
    }

    return parsed as LinkedInRawData;
  } catch (error) {
    console.error("[linkedin-scrape] Parse error:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { profileUrls, userId, mode } = body;

    if (!profileUrls || !Array.isArray(profileUrls) || !userId) {
      return new Response(
        JSON.stringify({ error: "profileUrls (array) and userId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate mode
    const validModes = ["NETWORK_HIRING", "MEETING_PREP"];
    const scrapeMode = validModes.includes(mode) ? mode : "NETWORK_HIRING";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results = {
      scraped: 0,
      failed: 0,
      stored: 0,
    };

    for (const profileUrl of profileUrls) {
      console.log(`[linkedin-scrape] Scraping: ${profileUrl}`);

      // Check if we already scraped this recently (within 7 days)
      const { data: existing } = await supabase
        .from("raw_inputs")
        .select("id")
        .eq("user_id", userId)
        .eq("source", "linkedin")
        .eq("external_id", profileUrl)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[linkedin-scrape] Skipping ${profileUrl} - recently scraped`);
        continue;
      }

      const rawContent = await scrapeLinkedInProfile(profileUrl);
      if (!rawContent) {
        results.failed++;
        continue;
      }

      results.scraped++;

      const structuredData = await extractStructuredData(rawContent, profileUrl);
      if (!structuredData) {
        results.failed++;
        continue;
      }

      // Store in raw_inputs
      const { error: insertError } = await supabase.from("raw_inputs").insert({
        user_id: userId,
        source: "linkedin",
        external_id: profileUrl,
        raw_text: JSON.stringify(structuredData),
        raw_metadata: {
          mode: scrapeMode,
          fetched_at: new Date().toISOString(),
          posts_count: structuredData.posts?.length || 0,
          has_about: !!structuredData.about_text,
        },
        occurred_at: new Date().toISOString(),
        processed: false,
      });

      if (insertError) {
        console.error("[linkedin-scrape] Insert error:", insertError);
        results.failed++;
      } else {
        results.stored++;
        console.log(`[linkedin-scrape] Stored: ${profileUrl} with ${structuredData.posts?.length || 0} posts`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[linkedin-scrape] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
