import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { linkedinUrl, userId } = await req.json();

    if (!linkedinUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'LinkedIn URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Scraping service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate LinkedIn URL format
    let formattedUrl = linkedinUrl.trim();
    if (!formattedUrl.includes('linkedin.com')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid LinkedIn profile URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping LinkedIn profile:', formattedUrl);

    // Step 1: Scrape the LinkedIn profile with Firecrawl
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for JS to render
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not access LinkedIn profile. Make sure the profile is public.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profileContent = scrapeData.data?.markdown || scrapeData.markdown || '';
    
    if (!profileContent || profileContent.length < 100) {
      console.log('Scraped content too short:', profileContent.length);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract profile data. The profile may be private or incomplete.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully scraped profile, content length:', profileContent.length);

    // Step 2: Use AI to extract structured data
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
            content: `You are extracting professional profile data from LinkedIn content. Extract the following fields and return valid JSON only, no markdown:
{
  "full_name": "string or null",
  "role": "current job title or null",
  "industry": "industry they work in or null", 
  "bio": "professional summary or about section, max 300 chars or null",
  "skills": ["array of skills mentioned, max 10"],
  "interests": ["professional interests, causes, or topics they engage with, max 5"],
  "goals": ["career goals or what they're working towards if mentioned, max 3"],
  "looking_for": "what kind of connections/opportunities they seek if mentioned or null",
  "communication_style": "infer from content: formal, casual, technical, creative, or null"
}`
          },
          {
            role: 'user',
            content: `Extract profile data from this LinkedIn content:\n\n${profileContent.substring(0, 8000)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const aiError = await aiResponse.text();
      console.error('AI extraction error:', aiResponse.status, aiError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to analyze profile data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI extracted:', extractedText.substring(0, 500));

    // Parse the JSON from AI response
    let profileData;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanJson = extractedText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      profileData = JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, extractedText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse profile data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Update the user's profile in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: Record<string, any> = {
      linkedin_url: formattedUrl,
      updated_at: new Date().toISOString(),
    };

    // Only update fields that have values
    if (profileData.full_name) updateData.full_name = profileData.full_name;
    if (profileData.role) updateData.role = profileData.role;
    if (profileData.industry) updateData.industry = profileData.industry;
    if (profileData.bio) updateData.bio = profileData.bio;
    if (profileData.skills?.length) updateData.skills = profileData.skills;
    if (profileData.interests?.length) updateData.interests = profileData.interests;
    if (profileData.goals?.length) updateData.goals = profileData.goals;
    if (profileData.looking_for) updateData.looking_for = profileData.looking_for;
    if (profileData.communication_style) updateData.communication_style = profileData.communication_style;

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save profile data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully enriched profile for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: profileData,
        message: 'Profile enriched successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enrich-linkedin:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
