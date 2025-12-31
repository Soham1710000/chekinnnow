import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from header (set by extension) or auth
    const authHeader = req.headers.get('Authorization');
    const userIdHeader = req.headers.get('x-user-id');
    
    let userId: string | null = null;
    
    if (authHeader) {
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) userId = user.id;
    }
    
    if (!userId && userIdHeader) {
      userId = userIdHeader;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const body = await req.json();

    console.log(`LinkedIn ingest: ${path} for user ${userId}`);

    switch (path) {
      case 'profile':
        return await handleOwnProfile(supabase, userId, body, corsHeaders);
      
      case 'connections':
        return await handleConnections(supabase, userId, body, corsHeaders);
      
      case 'posts':
        return await handlePosts(supabase, userId, body, corsHeaders);
      
      case 'profile-visit':
        return await handleProfileVisit(supabase, userId, body, corsHeaders);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    console.error('LinkedIn ingest error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle user's own LinkedIn profile sync
async function handleOwnProfile(supabase: any, userId: string, data: any, corsHeaders: any) {
  const { name, headline, location, current_company, current_role, education, skills, profile_url } = data;

  const { error } = await supabase
    .from('user_linkedin_profile')
    .upsert({
      user_id: userId,
      name,
      headline,
      location,
      current_company,
      role_title: current_role,
      education,
      skills,
      profile_url,
      synced_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error syncing own profile:', error);
    throw error;
  }

  // Also update the main profiles table
  await supabase
    .from('profiles')
    .update({
      full_name: name,
      role: current_role,
      industry: headline,
      skills,
      linkedin_url: profile_url,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`Synced own LinkedIn profile for user ${userId}`);

  return new Response(
    JSON.stringify({ success: true, message: 'Profile synced' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Handle 1st-degree connections sync
async function handleConnections(supabase: any, userId: string, data: any, corsHeaders: any) {
  const { connections } = data;
  
  if (!connections || !Array.isArray(connections)) {
    return new Response(
      JSON.stringify({ error: 'Invalid connections data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let inserted = 0;
  let updated = 0;

  for (const conn of connections) {
    if (!conn.name || !conn.profile_url) continue;

    const { data: existing } = await supabase
      .from('linkedin_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('profile_url', conn.profile_url)
      .single();

    if (existing) {
      await supabase
        .from('linkedin_connections')
        .update({
          name: conn.name,
          headline: conn.headline,
          company: extractCompany(conn.headline),
          last_seen_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      updated++;
    } else {
      const { error } = await supabase
        .from('linkedin_connections')
        .insert({
          user_id: userId,
          name: conn.name,
          headline: conn.headline,
          profile_url: conn.profile_url,
          company: extractCompany(conn.headline),
          extracted_at: new Date().toISOString()
        });
      if (!error) inserted++;
    }
  }

  console.log(`Synced ${inserted} new, ${updated} updated connections for user ${userId}`);

  return new Response(
    JSON.stringify({ success: true, inserted, updated }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Handle hiring/job change posts from feed
async function handlePosts(supabase: any, userId: string, data: any, corsHeaders: any) {
  const { posts } = data;
  
  if (!posts || !Array.isArray(posts)) {
    return new Response(
      JSON.stringify({ error: 'Invalid posts data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let inserted = 0;

  for (const post of posts) {
    if (!post.author_name || !post.post_text) continue;

    // Check for duplicates
    const { data: existing } = await supabase
      .from('linkedin_posts')
      .select('id')
      .eq('user_id', userId)
      .eq('author_profile_url', post.author_profile_url)
      .eq('post_text', post.post_text.substring(0, 500))
      .single();

    if (existing) continue;

    const { error } = await supabase
      .from('linkedin_posts')
      .insert({
        user_id: userId,
        author_name: post.author_name,
        author_profile_url: post.author_profile_url,
        author_headline: post.author_headline,
        post_text: post.post_text,
        post_type: post.post_type,
        posted_at: post.timestamp || null,
        extracted_at: new Date().toISOString()
      });

    if (!error) {
      inserted++;
      
      // Create raw_input for signal extraction
      await createRawInput(supabase, userId, post);
    }
  }

  console.log(`Inserted ${inserted} new LinkedIn posts for user ${userId}`);

  return new Response(
    JSON.stringify({ success: true, inserted }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Handle profile visit (meeting prep data)
async function handleProfileVisit(supabase: any, userId: string, data: any, corsHeaders: any) {
  const { profile_url, name, headline, location, current_company, current_role, recent_posts, visited_at } = data;

  if (!profile_url || !name) {
    return new Response(
      JSON.stringify({ error: 'Invalid profile data' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Upsert profile data
  const { error } = await supabase
    .from('linkedin_profiles')
    .upsert({
      user_id: userId,
      profile_url,
      name,
      headline,
      location,
      current_company,
      role_title: current_role,
      recent_posts,
      last_fetched: new Date().toISOString()
    }, { onConflict: 'user_id,profile_url' });

  if (error) {
    console.error('Error storing profile visit:', error);
    throw error;
  }

  // Log the fetch
  await supabase
    .from('profile_fetch_log')
    .insert({
      user_id: userId,
      profile_url,
      reason: 'profile_visit',
      context: { visited_at, name },
      success: true
    });

  // Create raw_input for signal extraction (meeting prep context)
  await supabase
    .from('raw_inputs')
    .insert({
      user_id: userId,
      source: 'linkedin_profile_visit',
      external_id: profile_url,
      raw_text: `Visited profile: ${name} - ${headline || ''} at ${current_company || ''}`,
      raw_metadata: {
        profile_url,
        name,
        headline,
        location,
        current_company,
        current_role,
        recent_posts,
        visited_at
      },
      occurred_at: visited_at || new Date().toISOString()
    });

  console.log(`Stored profile visit for ${name} by user ${userId}`);

  return new Response(
    JSON.stringify({ success: true, message: 'Profile visit stored' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper: Extract company from headline
function extractCompany(headline: string | null): string | null {
  if (!headline) return null;
  
  // Common patterns: "Role at Company" or "Role @ Company"
  const atMatch = headline.match(/(?:at|@)\s+(.+?)(?:\s*[-|•]|$)/i);
  if (atMatch) return atMatch[1].trim();
  
  return null;
}

// Helper: Create raw_input for signal extraction
async function createRawInput(supabase: any, userId: string, post: any) {
  const isHiring = /hiring|looking for|join our team|open role|we're growing|DMs open/i.test(post.post_text);
  const isJobChange = /excited to join|new role|starting at|thrilled to announce/i.test(post.post_text);
  
  if (!isHiring && !isJobChange) return;

  await supabase
    .from('raw_inputs')
    .insert({
      user_id: userId,
      source: 'linkedin',
      external_id: `${post.author_profile_url}_${Date.now()}`,
      raw_text: post.post_text,
      raw_metadata: {
        author_name: post.author_name,
        author_profile_url: post.author_profile_url,
        author_headline: post.author_headline,
        post_type: isHiring ? 'hiring' : 'job_change',
        posted_at: post.timestamp
      },
      occurred_at: post.timestamp || new Date().toISOString()
    });
}
