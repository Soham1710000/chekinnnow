import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Match hiring signals from network with user's skills/interests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile with skills and interests
    const { data: profile } = await supabase
      .from('profiles')
      .select('skills, interests, role, industry')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ matches: [], message: 'No profile data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's LinkedIn profile for additional context
    const { data: linkedinProfile } = await supabase
      .from('user_linkedin_profile')
      .select('skills, headline, current_company')
      .eq('user_id', userId)
      .single();

    // Combine all keywords for matching
    const userKeywords = [
      ...(profile.skills || []),
      ...(profile.interests || []),
      ...(linkedinProfile?.skills || []),
      profile.role,
      profile.industry
    ].filter(Boolean).map(k => k.toLowerCase());

    console.log(`Matching hiring signals for user ${userId} with keywords:`, userKeywords);

    // Get recent hiring signals from user's network
    const { data: hiringSignals } = await supabase
      .from('signals_raw')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'NETWORK_HIRING_SIGNAL')
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false });

    const matches: any[] = [];

    for (const signal of hiringSignals || []) {
      const evidence = (signal.evidence || '').toLowerCase();
      const metadata = signal.metadata as any || {};
      const headline = (metadata.author_headline || '').toLowerCase();

      // Check keyword matches
      const matchedKeywords = userKeywords.filter(keyword => 
        evidence.includes(keyword) || headline.includes(keyword)
      );

      if (matchedKeywords.length > 0) {
        // Check if this is a 1st-degree connection
        const { data: connection } = await supabase
          .from('linkedin_connections')
          .select('name, headline')
          .eq('user_id', userId)
          .eq('profile_url', metadata.author_profile_url)
          .single();

        matches.push({
          signal_id: signal.id,
          author_name: metadata.author_name,
          author_profile_url: metadata.author_profile_url,
          author_headline: metadata.author_headline,
          evidence: signal.evidence,
          is_founder: metadata.is_founder || false,
          is_1st_degree: !!connection,
          matched_keywords: matchedKeywords,
          match_score: calculateMatchScore(matchedKeywords, metadata.is_founder, !!connection),
          subtype: signal.subtype,
          occurred_at: signal.occurred_at
        });
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.match_score - a.match_score);

    console.log(`Found ${matches.length} hiring matches for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        matches: matches.slice(0, 10), // Top 10
        total_signals: hiringSignals?.length || 0,
        user_keywords: userKeywords 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('LinkedIn match hiring error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateMatchScore(
  matchedKeywords: string[], 
  isFounder: boolean, 
  is1stDegree: boolean
): number {
  let score = matchedKeywords.length * 20; // Base score per keyword match
  
  if (isFounder) score += 30; // Founders are high-value connections
  if (is1stDegree) score += 25; // 1st degree = warm intro possible
  
  return Math.min(score, 100);
}
