import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Role: You are a thoughtful, human-first social intelligence assistant.
Your job is to find the few conversations that genuinely make sense — including ones they'd NEVER think of.

You will receive:
1. A user's ask (intent, desired outcome, credibility, constraints)
2. The user's LinkedIn profile data (if available)
3. A list of candidate profiles from search

Your tasks:
1. EXTRACT USER'S THESIS from their LinkedIn profile and ask
2. Generate internal context identity for the user
3. Filter and rank candidates into:
   a) OBVIOUS MATCHES (max 3): Direct fits based on intent
   b) WILDCARD MATCHES (1-2): Unexpected but valuable connections they'd never think of

Output JSON:
{
  "userContext": {
    "userNarrative": "string - brief story of who this user is",
    "extractedThesis": "string - their core mission/thesis",
    "problemPatterns": ["array of problems they likely face"],
    "intentSummary": "string - what they're really looking for",
    "background": "string - professional background summary",
    "strengths": ["array of key strengths"],
    "careerPivots": ["array of career changes/transitions"],
    "programs": ["array of notable programs/affiliations"],
    "avoidProfiles": ["types of profiles to avoid"],
    "urgency": "low | medium | high",
    "idealConversationType": "string"
  },
  "matches": [{
    "name": "string",
    "title": "string",
    "company": "string",
    "matchType": "obvious | wildcard",
    "whyUnexpected": "string - only for wildcards",
    "thesisAlignment": "string - how their work aligns",
    "whoTheyAre": "string - brief bio",
    "whyThisMakesSense": ["strings - reasons for match"],
    "whyYoureRelevant": "string - why user matters to them",
    "sharedGround": ["strings - common ground"],
    "warmPath": "string - warm intro suggestion",
    "coldPath": "string - cold outreach angle",
    "suggestedMessage": "string - ready-to-send DM",
    "linkedinUrl": "string",
    "confidence": "high | medium | low"
  }],
  "reasoning": "string - overall reasoning for selections"
}`;

async function fetchUserLinkedInProfile(linkedinUrl: string, cladoApiKey: string) {
  if (!linkedinUrl) return null;

  try {
    console.log('Fetching LinkedIn profile:', linkedinUrl);
    const response = await fetch('https://search.clado.ai/api/search/people', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cladoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: linkedinUrl, limit: 1 }),
    });

    if (!response.ok) {
      console.error('Failed to fetch LinkedIn profile:', response.status);
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
    const { userAsk, candidates, userProfile: dbProfile, onboardingContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const CLADO_API_KEY = Deno.env.get('CLADO_API_KEY');
    
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    console.log('Generating match context for:', userAsk.askType);
    console.log('Number of candidates:', candidates?.length || 0);
    console.log('Has DB profile:', !!dbProfile);
    console.log('Has onboarding context:', !!onboardingContext);

    // Fetch user's LinkedIn profile if URL provided
    let linkedInProfile = null;
    if (userAsk.linkedinUrl && CLADO_API_KEY) {
      linkedInProfile = await fetchUserLinkedInProfile(userAsk.linkedinUrl, CLADO_API_KEY);
    }

    // Build user profile section from multiple sources
    let userProfileSection = '';
    
    if (linkedInProfile) {
      userProfileSection += `USER'S LINKEDIN PROFILE:\n${JSON.stringify(linkedInProfile, null, 2)}\n\n`;
    }
    
    if (dbProfile) {
      userProfileSection += `USER'S CHEKINN PROFILE:
- Name: ${dbProfile.full_name || 'Not provided'}
- Role: ${dbProfile.role || 'Not provided'}
- Industry: ${dbProfile.industry || 'Not provided'}
- Looking For: ${dbProfile.looking_for || 'Not provided'}
- Skills: ${dbProfile.skills?.join(', ') || 'Not provided'}
- Interests: ${dbProfile.interests?.join(', ') || 'Not provided'}
${dbProfile.ai_insights ? `- AI Insights: ${JSON.stringify(dbProfile.ai_insights)}` : ''}
\n`;
    }
    
    if (onboardingContext) {
      const motivationLabels: Record<string, string> = {
        building: "Building something meaningful",
        recognition: "Recognition & status",
        financial: "Financial freedom",
        mastery: "Mastery & learning",
        stability: "Stability",
        impact: "Impact on others",
      };
      
      userProfileSection += `USER'S ONBOARDING CONTEXT:
- Contrarian Belief: ${onboardingContext.contrarianBelief || 'Not shared'}
- Career Inflection Point: ${onboardingContext.careerInflection || 'Not shared'}
- Primary Motivation: ${onboardingContext.motivation ? motivationLabels[onboardingContext.motivation] || onboardingContext.motivation : 'Not selected'}
- Motivation Explanation: ${onboardingContext.motivationExplanation || 'Not provided'}
- Current Constraint: ${onboardingContext.constraint || 'Not shared'}
\n`;
    }
    
    if (!userProfileSection) {
      userProfileSection = "USER PROFILE: Limited information available - rely on the ask details\n";
    }

    const userPrompt = `
USER'S ASK:
- Ask Type: ${userAsk.askType}
- Intent: ${userAsk.intent}
- Desired Outcome: ${userAsk.outcome}
- Credibility: ${userAsk.credibility}
- Constraints: ${userAsk.constraints || 'None'}

${userProfileSection}

CANDIDATE PROFILES (${candidates?.length || 0} candidates):
${JSON.stringify(candidates?.slice(0, 30), null, 2)}

Analyze these candidates and return ONLY valid JSON matching the schema.
Focus on quality over quantity - max 5 matches total.
Consider the user's onboarding context (contrarian beliefs, motivations, constraints) when finding matches.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    const parsed = JSON.parse(content);
    console.log('Generated matches:', parsed.matches?.length || 0);

    return new Response(JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error generating context:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
