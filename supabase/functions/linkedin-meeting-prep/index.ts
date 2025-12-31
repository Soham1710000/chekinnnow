import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prepare meeting context from LinkedIn profiles
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const { userId, attendeeEmails, attendeeNames, meetingTitle, meetingTime } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Preparing meeting context for user ${userId}, meeting: ${meetingTitle}`);

    const attendeeProfiles: any[] = [];

    // Try to find LinkedIn profiles for attendees
    for (const name of attendeeNames || []) {
      // Search in connections
      const { data: connection } = await supabase
        .from('linkedin_connections')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();

      if (connection) {
        // Check if we have detailed profile data
        const { data: profile } = await supabase
          .from('linkedin_profiles')
          .select('*')
          .eq('user_id', userId)
          .eq('profile_url', connection.profile_url)
          .single();

        attendeeProfiles.push({
          name: connection.name,
          headline: connection.headline || profile?.headline,
          company: connection.company || profile?.current_company,
          role: profile?.role_title,
          profile_url: connection.profile_url,
          recent_posts: profile?.recent_posts,
          is_1st_degree: true,
          source: profile ? 'linkedin_profile' : 'linkedin_connection'
        });
      }
    }

    // Get user's own profile for finding shared context
    const { data: userProfile } = await supabase
      .from('user_linkedin_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Find shared connections, companies, schools
    const sharedContext = findSharedContext(userProfile, attendeeProfiles);

    // Generate talking points using AI if we have attendee data
    let talkingPoints: string[] = [];
    
    if (attendeeProfiles.length > 0 && lovableApiKey) {
      talkingPoints = await generateTalkingPoints(
        lovableApiKey,
        userProfile,
        attendeeProfiles,
        meetingTitle
      );
    }

    const prepData = {
      meeting_title: meetingTitle,
      meeting_time: meetingTime,
      attendees: attendeeProfiles,
      shared_context: sharedContext,
      talking_points: talkingPoints,
      user_context: {
        company: userProfile?.current_company,
        role: userProfile?.role_title,
        skills: userProfile?.skills
      }
    };

    console.log(`Meeting prep complete: ${attendeeProfiles.length} attendees found`);

    return new Response(
      JSON.stringify({ success: true, prep: prepData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('LinkedIn meeting prep error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function findSharedContext(userProfile: any, attendeeProfiles: any[]): any {
  if (!userProfile) return {};

  const shared: any = {
    companies: [],
    skills: [],
    connections: []
  };

  const userCompany = userProfile.current_company?.toLowerCase();
  const userSkills = (userProfile.skills || []).map((s: string) => s.toLowerCase());

  for (const attendee of attendeeProfiles) {
    // Check shared company
    if (attendee.company?.toLowerCase() === userCompany) {
      shared.companies.push(attendee.company);
    }

    // Check shared skills (from recent posts context)
    if (attendee.recent_posts) {
      for (const post of attendee.recent_posts) {
        const postText = (post.text || '').toLowerCase();
        for (const skill of userSkills) {
          if (postText.includes(skill)) {
            if (!shared.skills.includes(skill)) {
              shared.skills.push(skill);
            }
          }
        }
      }
    }
  }

  return shared;
}

async function generateTalkingPoints(
  apiKey: string,
  userProfile: any,
  attendeeProfiles: any[],
  meetingTitle: string
): Promise<string[]> {
  try {
    const attendeeContext = attendeeProfiles.map(a => 
      `${a.name}: ${a.headline || 'Unknown role'} at ${a.company || 'Unknown company'}. Recent activity: ${
        a.recent_posts?.slice(0, 2).map((p: any) => p.text?.substring(0, 100)).join('; ') || 'None'
      }`
    ).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Generate 3-4 concise, actionable talking points for this meeting.

Meeting: ${meetingTitle}

Your context:
- Role: ${userProfile?.role_title || 'Unknown'}
- Company: ${userProfile?.current_company || 'Unknown'}
- Skills: ${(userProfile?.skills || []).slice(0, 5).join(', ')}

Attendees:
${attendeeContext}

Rules:
- Be specific, reference their recent posts/interests
- Focus on potential collaboration or shared interests
- Keep each point to 1-2 sentences
- Avoid generic advice like "be confident"

Output as a JSON array of strings.`
        }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [];
  } catch (error) {
    console.error('Error generating talking points:', error);
    return [];
  }
}
