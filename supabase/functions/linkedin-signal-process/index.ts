import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process unprocessed LinkedIn posts and extract signals
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, processAll } = await req.json();

    let query = supabase
      .from('linkedin_posts')
      .select('*')
      .eq('processed', false)
      .order('extracted_at', { ascending: false })
      .limit(100);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Processing ${posts?.length || 0} LinkedIn posts`);

    const results = {
      processed: 0,
      signals_created: 0,
      errors: 0
    };

    for (const post of posts || []) {
      try {
        const signals = await extractSignalsFromPost(post);
        
        for (const signal of signals) {
          const { error } = await supabase
            .from('signals_raw')
            .insert({
              user_id: post.user_id,
              user_story: signal.user_story,
              category: signal.category,
              type: signal.type,
              subtype: signal.subtype,
              confidence: signal.confidence,
              evidence: signal.evidence,
              metadata: signal.metadata,
              extraction_method: 'linkedin_extension',
              occurred_at: post.posted_at || post.extracted_at
            });

          if (!error) {
            results.signals_created++;
          }
        }

        // Mark post as processed
        await supabase
          .from('linkedin_posts')
          .update({ processed: true })
          .eq('id', post.id);

        results.processed++;
      } catch (err) {
        console.error(`Error processing post ${post.id}:`, err);
        results.errors++;
      }
    }

    console.log(`LinkedIn signal processing complete:`, results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('LinkedIn signal process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface ExtractedSignal {
  user_story: string;
  category: string;
  type: string;
  subtype: string;
  confidence: string;
  evidence: string;
  metadata: Record<string, any>;
}

function extractSignalsFromPost(post: any): ExtractedSignal[] {
  const signals: ExtractedSignal[] = [];
  const text = (post.post_text || '').toLowerCase();
  const authorHeadline = (post.author_headline || '').toLowerCase();

  // Hiring signals
  const hiringPatterns = [
    { pattern: /hiring|we're hiring|now hiring/i, subtype: 'PUBLIC_HIRING_POST', confidence: 'MEDIUM' },
    { pattern: /looking for|seeking|need a/i, subtype: 'ROLE_SEEKING', confidence: 'MEDIUM' },
    { pattern: /join our team|join us/i, subtype: 'TEAM_EXPANSION', confidence: 'MEDIUM' },
    { pattern: /open role|open position|opportunity/i, subtype: 'OPEN_ROLE', confidence: 'MEDIUM' },
    { pattern: /dms? open|reach out/i, subtype: 'DM_OPEN', confidence: 'HIGH' }
  ];

  for (const { pattern, subtype, confidence } of hiringPatterns) {
    if (pattern.test(post.post_text)) {
      const isFounder = /(founder|ceo|co-founder|cto)/i.test(authorHeadline);
      
      signals.push({
        user_story: 'Someone in network is hiring',
        category: 'CAREER',
        type: 'NETWORK_HIRING_SIGNAL',
        subtype: isFounder ? 'FOUNDER_HIRING' : subtype,
        confidence: isFounder ? 'HIGH' : confidence,
        evidence: post.post_text.substring(0, 200),
        metadata: {
          author_name: post.author_name,
          author_profile_url: post.author_profile_url,
          author_headline: post.author_headline,
          is_founder: isFounder,
          post_type: 'hiring'
        }
      });
      break; // Only one hiring signal per post
    }
  }

  // Job change signals
  const jobChangePatterns = [
    { pattern: /excited to (join|announce|share)/i, subtype: 'NEW_ROLE_ANNOUNCEMENT' },
    { pattern: /starting at|starting my/i, subtype: 'NEW_ROLE_START' },
    { pattern: /thrilled to|happy to announce/i, subtype: 'ROLE_CHANGE' },
    { pattern: /new chapter|next adventure/i, subtype: 'CAREER_TRANSITION' }
  ];

  for (const { pattern, subtype } of jobChangePatterns) {
    if (pattern.test(post.post_text)) {
      signals.push({
        user_story: 'Connection started new job',
        category: 'CAREER',
        type: 'NETWORK_JOB_CHANGE',
        subtype,
        confidence: 'HIGH',
        evidence: post.post_text.substring(0, 200),
        metadata: {
          author_name: post.author_name,
          author_profile_url: post.author_profile_url,
          author_headline: post.author_headline,
          post_type: 'job_change'
        }
      });
      break;
    }
  }

  // Event/meetup signals
  const eventPatterns = [
    { pattern: /hosting|organizing|join us for/i, subtype: 'HOSTING_EVENT' },
    { pattern: /meetup|event|conference|workshop/i, subtype: 'EVENT_MENTION' },
    { pattern: /speaking at|presenting at/i, subtype: 'SPEAKING_ENGAGEMENT' }
  ];

  for (const { pattern, subtype } of eventPatterns) {
    if (pattern.test(post.post_text)) {
      signals.push({
        user_story: 'Network event opportunity',
        category: 'SOCIAL',
        type: 'NETWORK_EVENT',
        subtype,
        confidence: 'MEDIUM',
        evidence: post.post_text.substring(0, 200),
        metadata: {
          author_name: post.author_name,
          author_profile_url: post.author_profile_url,
          author_headline: post.author_headline,
          post_type: 'event'
        }
      });
      break;
    }
  }

  return signals;
}
