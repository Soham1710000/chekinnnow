import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  industry: string | null;
  looking_for: string | null;
  skills: string[] | null;
  interests: string[] | null;
  learning_complete: boolean | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, action } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Action: Check if we should create an intro for this user
    if (action === 'check_intro') {
      console.log(`[decision-engine] Checking intro opportunities for user ${userId}`);

      // Get user's profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !userProfile) {
        console.log(`[decision-engine] No profile found for user ${userId}`);
        return new Response(
          JSON.stringify({ action: 'none', reason: 'No profile found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if learning is complete
      if (!userProfile.learning_complete) {
        console.log(`[decision-engine] User ${userId} still in learning phase`);
        return new Response(
          JSON.stringify({ action: 'none', reason: 'Learning not complete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already has pending/active intros (max 3 active at a time)
      const { data: existingIntros, error: introError } = await supabase
        .from('introductions')
        .select('id, status')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .in('status', ['pending', 'accepted_a', 'accepted_b', 'active']);

      if (introError) throw introError;

      const activeCount = existingIntros?.length || 0;
      if (activeCount >= 3) {
        console.log(`[decision-engine] User ${userId} already has ${activeCount} active intros`);
        return new Response(
          JSON.stringify({ action: 'none', reason: 'Max active intros reached' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find potential matches - users who are also learning complete
      // Simple matching: look for users with overlapping interests or complementary needs
      const { data: candidates, error: candidatesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('learning_complete', true)
        .neq('id', userId)
        .limit(50);

      if (candidatesError) throw candidatesError;

      if (!candidates || candidates.length === 0) {
        console.log(`[decision-engine] No candidates found for user ${userId}`);
        return new Response(
          JSON.stringify({ action: 'none', reason: 'No candidates available' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get IDs of users we've already matched with (to avoid duplicates)
      const { data: pastIntros } = await supabase
        .from('introductions')
        .select('user_a_id, user_b_id')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

      const alreadyMatchedIds = new Set<string>();
      pastIntros?.forEach(intro => {
        if (intro.user_a_id === userId) {
          alreadyMatchedIds.add(intro.user_b_id);
        } else {
          alreadyMatchedIds.add(intro.user_a_id);
        }
      });

      // Simple scoring: find someone with overlapping interests or who's looking for what user offers
      let bestMatch: UserProfile | null = null;
      let bestScore = 0;
      let matchReason = '';

      for (const candidate of candidates) {
        if (alreadyMatchedIds.has(candidate.id)) continue;

        let score = 0;
        let reasons: string[] = [];

        // Interest overlap
        const userInterests = userProfile.interests || [];
        const candidateInterests = candidate.interests || [];
        const sharedInterests = userInterests.filter((i: string) => 
          candidateInterests.includes(i)
        );
        if (sharedInterests.length > 0) {
          score += sharedInterests.length * 2;
          reasons.push(`shared interests: ${sharedInterests.slice(0, 2).join(', ')}`);
        }

        // Skill match - does candidate have skills user is looking for?
        const userLookingFor = userProfile.looking_for?.toLowerCase() || '';
        const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
        if (candidateSkills.some((s: string) => userLookingFor.includes(s))) {
          score += 3;
          reasons.push('has skills you need');
        }

        // Industry match
        if (userProfile.industry && candidate.industry === userProfile.industry) {
          score += 2;
          reasons.push(`both in ${userProfile.industry}`);
        }

        // Role complementarity - different roles can learn from each other
        if (userProfile.role && candidate.role && userProfile.role !== candidate.role) {
          score += 1;
          reasons.push('different perspectives');
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
          matchReason = reasons.join(', ');
        }
      }

      // Only create intro if we have a reasonable match (score >= 2)
      if (!bestMatch || bestScore < 2) {
        console.log(`[decision-engine] No good match found for user ${userId} (best score: ${bestScore})`);
        return new Response(
          JSON.stringify({ action: 'none', reason: 'No suitable match found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the intro
      const introMessage = generateIntroMessage(userProfile, bestMatch, matchReason);

      const { data: newIntro, error: createError } = await supabase
        .from('introductions')
        .insert({
          user_a_id: userId,
          user_b_id: bestMatch.id,
          intro_message: introMessage,
          status: 'pending',
        })
        .select()
        .single();

      if (createError) throw createError;

      console.log(`[decision-engine] Created intro ${newIntro.id} between ${userId} and ${bestMatch.id}`);

      return new Response(
        JSON.stringify({
          action: 'intro_created',
          introId: newIntro.id,
          matchedWith: bestMatch.full_name,
          reason: matchReason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: just acknowledge
    return new Response(
      JSON.stringify({ action: 'none', reason: 'No action specified' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[decision-engine] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateIntroMessage(userA: UserProfile, userB: UserProfile, reason: string): string {
  const nameA = userA.full_name || 'Someone';
  const nameB = userB.full_name || 'someone';
  const roleA = userA.role || 'a professional';
  const roleB = userB.role || 'another professional';

  const templates = [
    `Hey! Meet ${nameB}. They're ${roleB}. You two might have interesting things to talk about — ${reason}.`,
    `I think you'd get along with ${nameB} (${roleB}). ${reason.charAt(0).toUpperCase() + reason.slice(1)}.`,
    `Here's an intro to ${nameB}. They're ${roleB}, and I noticed ${reason}. Worth a chat?`,
    `${nameB} is ${roleB}. You both have ${reason}. Thought you should connect.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}
