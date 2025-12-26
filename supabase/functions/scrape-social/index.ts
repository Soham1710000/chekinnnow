import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// Minimum confidence to scrape
const MIN_CONFIDENCE = 0.7;
// Max profiles to scrape per run
const MAX_SCRAPES_PER_RUN = 5;

interface ScrapedContent {
  topics: string[];
  themes: string[];
  obsessions: string[];
  transitions: string[];
}

async function scrapeWithFirecrawl(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    console.error('[scrape-social] FIRECRAWL_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      console.error('[scrape-social] Firecrawl error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data?.markdown || null;
  } catch (error) {
    console.error('[scrape-social] Scrape error:', error);
    return null;
  }
}

async function extractSignalsFromContent(content: string, platform: string): Promise<ScrapedContent> {
  // Use LLM to extract structured signals from scraped content
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing social media profiles to understand a person's interests, obsessions, and career transitions.

Extract ONLY the following from this ${platform} profile content:
1. Topics: Subjects they discuss frequently (max 5)
2. Themes: Recurring patterns in their posts/activity (max 3)
3. Obsessions: Things they seem deeply passionate about (max 3)
4. Transitions: Any career/life changes mentioned (max 2)

Be concise. Each item should be 2-5 words max.
Do NOT include personal information, names, or private details.
Focus on professional interests and publicly expressed passions.

Respond in JSON format:
{
  "topics": ["topic1", "topic2"],
  "themes": ["theme1"],
  "obsessions": ["obsession1"],
  "transitions": ["transition1"]
}`
        },
        {
          role: 'user',
          content: content.slice(0, 4000) // Limit content to save tokens
        }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    console.error('[scrape-social] LLM extraction failed');
    return { topics: [], themes: [], obsessions: [], transitions: [] };
  }

  const data = await response.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      topics: parsed.topics || [],
      themes: parsed.themes || [],
      obsessions: parsed.obsessions || [],
      transitions: parsed.transitions || [],
    };
  } catch {
    return { topics: [], themes: [], obsessions: [], transitions: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build query for pending profiles
    let query = supabase
      .from('inferred_social_profiles')
      .select('*')
      .eq('scrape_status', 'pending')
      .gte('confidence', MIN_CONFIDENCE)
      .order('confidence', { ascending: false })
      .limit(MAX_SCRAPES_PER_RUN);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: profiles, error } = await query;

    if (error) {
      throw error;
    }

    if (!profiles || profiles.length === 0) {
      console.log('[scrape-social] No profiles to scrape');
      return new Response(JSON.stringify({ success: true, scraped: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[scrape-social] Scraping ${profiles.length} profiles`);

    let scrapedCount = 0;
    let signalsCreated = 0;

    for (const profile of profiles) {
      console.log(`[scrape-social] Scraping ${profile.platform}: ${profile.profile_url}`);

      const content = await scrapeWithFirecrawl(profile.profile_url);

      if (!content) {
        // Mark as failed
        await supabase
          .from('inferred_social_profiles')
          .update({ 
            scrape_status: 'failed',
            scraped_at: new Date().toISOString()
          })
          .eq('id', profile.id);
        continue;
      }

      // Extract signals from content
      const signals = await extractSignalsFromContent(content, profile.platform);

      // Store signals
      const signalTypes = [
        { type: 'topic', values: signals.topics },
        { type: 'theme', values: signals.themes },
        { type: 'obsession', values: signals.obsessions },
        { type: 'transition', values: signals.transitions },
      ];

      for (const { type, values } of signalTypes) {
        for (const value of values) {
          const { error: insertError } = await supabase
            .from('social_signals')
            .insert({
              user_id: profile.user_id,
              profile_id: profile.id,
              signal_type: type,
              signal_value: value,
              confidence: profile.confidence * 0.9, // Slightly reduce confidence for derived signals
              evidence: `Extracted from ${profile.platform} profile`,
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            });

          if (!insertError) {
            signalsCreated++;
          }
        }
      }

      // Update profile status
      await supabase
        .from('inferred_social_profiles')
        .update({ 
          scrape_status: 'scraped',
          scraped_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      scrapedCount++;

      // Small delay between scrapes to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[scrape-social] Scraped ${scrapedCount} profiles, created ${signalsCreated} signals`);

    return new Response(JSON.stringify({ 
      success: true,
      scraped: scrapedCount,
      signalsCreated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[scrape-social] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});