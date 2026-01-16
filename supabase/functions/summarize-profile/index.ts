import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchLinkedInProfile(linkedinUrl: string, cladoApiKey: string) {
  if (!linkedinUrl) return null;

  try {
    console.log('Fetching LinkedIn profile from Clado:', linkedinUrl);
    const response = await fetch('https://search.clado.ai/api/search/people', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: linkedinUrl, limit: 1 }),
    });

    if (!response.ok) {
      console.error('Clado API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data?.results?.[0] || data?.profiles?.[0] || null;
  } catch (error) {
    console.error('Error fetching LinkedIn profile:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, password } = await req.json();

    // Verify admin password
    const expectedPassword = Deno.env.get('ADMIN_PASSWORD');
    if (password !== expectedPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch LinkedIn data if URL available
    let linkedInData = null;
    const cladoApiKey = Deno.env.get('CLADO_API_KEY');
    if (profile.linkedin_url && cladoApiKey) {
      linkedInData = await fetchLinkedInProfile(profile.linkedin_url, cladoApiKey);
    }

    // Parse onboarding context
    const onboardingContext = profile.onboarding_context || {};

    // Build context for AI summary
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decision posture labels
    const postureLabels: Record<string, string> = {
      talk_to_people: "Talks to people who've lived something similar",
      deep_research: "Goes deep on research and comparisons",
      move_fast: "Moves fast based on instinct",
      sit_with_it: "Sits with it until something forces the call",
      help_others: "Usually helps others decide instead",
    };

    // Ask type labels
    const askTypeLabels: Record<string, string> = {
      clarity: "Seeking clarity between multiple right answers",
      direction: "Needs to decide what to do next",
      opportunity: "Exploring what's possible",
      pressure_testing: "Validating a lean/decision",
      help_others: "Looking to help others who've been there",
    };

    // Decision weight labels
    const weightLabels: Record<string, string> = {
      light: "Light exploration",
      medium: "Affects next few months",
      heavy: "Could change trajectory",
      very_heavy: "Impacts other people too",
    };

    // Build the prompt
    let contextParts: string[] = [];

    // LinkedIn data
    if (linkedInData) {
      contextParts.push(`LINKEDIN PROFILE DATA:
${JSON.stringify(linkedInData, null, 2)}`);
    }

    // Basic profile data
    contextParts.push(`CHEKINN PROFILE:
- Name: ${profile.full_name || 'Not provided'}
- Email: ${profile.email || 'Not provided'}
- Role: ${profile.role || 'Not provided'}
- Industry: ${profile.industry || 'Not provided'}
- Bio: ${profile.bio || 'Not provided'}
- Skills: ${profile.skills?.join(', ') || 'Not provided'}
- Interests: ${profile.interests?.join(', ') || 'Not provided'}
- Looking For: ${profile.looking_for || 'Not provided'}`);

    // Onboarding context (new flow)
    if (onboardingContext.ask_type || onboardingContext.decision_posture) {
      let onboardingSection = `ONBOARDING CONTEXT (Decision Context):`;
      
      if (onboardingContext.decision_posture) {
        onboardingSection += `\n- Decision Style: ${postureLabels[onboardingContext.decision_posture] || onboardingContext.decision_posture}`;
      }
      if (onboardingContext.ask_type) {
        onboardingSection += `\n- Current Intent: ${askTypeLabels[onboardingContext.ask_type] || onboardingContext.ask_type}`;
      }
      if (onboardingContext.lived_context?.length) {
        onboardingSection += `\n- Lived Experience: ${onboardingContext.lived_context.join(', ')}`;
      }
      if (onboardingContext.followup_context?.length) {
        onboardingSection += `\n- Relevant Forks: ${onboardingContext.followup_context.join(', ')}`;
      }
      if (onboardingContext.micro_reason) {
        onboardingSection += `\n- What Makes This Hard: "${onboardingContext.micro_reason}"`;
      }
      if (onboardingContext.decision_weight) {
        onboardingSection += `\n- Decision Weight: ${weightLabels[onboardingContext.decision_weight] || onboardingContext.decision_weight}`;
      }
      if (onboardingContext.stakes_text) {
        onboardingSection += `\n- What's at Stake: "${onboardingContext.stakes_text}"`;
      }
      if (onboardingContext.context_chips?.length) {
        onboardingSection += `\n- Current Constraints: ${onboardingContext.context_chips.join(', ')}`;
      }
      if (onboardingContext.help_style) {
        onboardingSection += `\n- Help Style: ${onboardingContext.help_style}`;
      }
      if (onboardingContext.open_help_text) {
        onboardingSection += `\n- Can Help With: "${onboardingContext.open_help_text}"`;
      }
      
      contextParts.push(onboardingSection);
    }
    // Legacy onboarding context
    else if (onboardingContext.lookingFor) {
      contextParts.push(`ONBOARDING CONTEXT (Legacy):
- Looking For: ${onboardingContext.lookingFor || 'Not specified'}
- Why This Matters: ${onboardingContext.whyOpportunity || 'Not shared'}
- Current Constraint: ${onboardingContext.constraint || 'Not shared'}
- Motivation: ${onboardingContext.motivation || 'Not selected'}`);
    }

    const fullContext = contextParts.join('\n\n');

    console.log('Generating profile summary for user:', userId);

    // Call AI to generate summary
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a professional profile summarizer for ChekInn, a platform that matches professionals based on their decision-making context and lived experience.

Generate a comprehensive but concise profile summary that would help an admin understand:
1. Who this person is professionally
2. What decision/fork they're currently navigating
3. What kind of connections would be most valuable for them
4. What unique perspective or experience they can offer to others

Output valid JSON only with this structure:
{
  "headline": "One-line professional identity (max 100 chars)",
  "narrative": "2-3 sentence story of who they are and what they're navigating",
  "seeking": "What they're looking for in connections (1-2 sentences)",
  "offering": "What unique value they can provide to others (1-2 sentences)",
  "matchKeywords": ["array", "of", "5-8", "keywords", "for", "matching"],
  "decisionContext": "Brief summary of their current decision/fork (1 sentence)",
  "urgency": "low | medium | high",
  "matchTypes": ["types of people who would be good matches"]
}`
          },
          {
            role: 'user',
            content: `Generate a profile summary from this data:\n\n${fullContext}`
          }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const summaryContent = aiData.choices?.[0]?.message?.content;

    if (!summaryContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'No summary generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let summary;
    try {
      summary = JSON.parse(summaryContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e, summaryContent);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save summary to ai_insights
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_insights: {
          ...profile.ai_insights,
          profileSummary: summary,
          linkedInData: linkedInData ? {
            name: linkedInData.name,
            headline: linkedInData.headline,
            company: linkedInData.current_company || linkedInData.company,
            location: linkedInData.location,
            fetchedAt: new Date().toISOString(),
          } : null,
          generatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to save summary:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully generated and saved profile summary for:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        linkedInData: linkedInData ? {
          name: linkedInData.name,
          headline: linkedInData.headline,
          company: linkedInData.current_company || linkedInData.company,
        } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-profile:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
