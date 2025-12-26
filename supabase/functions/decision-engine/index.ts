import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InterventionAction = "none" | "intro";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return json({ action: "none", reason: "Missing userId" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile) {
      return json({ action: "none", reason: "No profile found" });
    }

    // 2. Check if user has completed learning phase
    if (!profile.learning_complete) {
      return json({ action: "none", reason: "Learning not complete" });
    }

    // 3. Check active intros cap (max 3)
    const { count: activeIntros } = await supabase
      .from("introductions")
      .select("*", { count: "exact", head: true })
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .in("status", ["pending", "active"]);

    if ((activeIntros || 0) >= 3) {
      return json({ action: "none", reason: "Active intro limit reached" });
    }

    // 4. Find potential matches based on overlapping interests/goals/industry
    const userInterests = profile.interests || [];
    const userGoals = profile.goals || [];
    const userIndustry = profile.industry;

    // Get other profiles who have completed learning
    const { data: candidates } = await supabase
      .from("profiles")
      .select("id, full_name, role, industry, interests, goals, looking_for")
      .eq("learning_complete", true)
      .neq("id", userId)
      .limit(20);

    if (!candidates || candidates.length === 0) {
      return json({ action: "none", reason: "No candidates available" });
    }

    // Score candidates based on overlap
    const scoredCandidates = candidates.map((c: any) => {
      let score = 0;
      
      // Industry match
      if (c.industry && userIndustry && c.industry.toLowerCase() === userIndustry.toLowerCase()) {
        score += 3;
      }
      
      // Interest overlap
      const candidateInterests = c.interests || [];
      const interestOverlap = userInterests.filter((i: string) => 
        candidateInterests.some((ci: string) => ci.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(ci.toLowerCase()))
      ).length;
      score += interestOverlap * 2;
      
      // Goals overlap
      const candidateGoals = c.goals || [];
      const goalsOverlap = userGoals.filter((g: string) =>
        candidateGoals.some((cg: string) => cg.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(cg.toLowerCase()))
      ).length;
      score += goalsOverlap;
      
      return { ...c, score };
    });

    // Filter to candidates with reasonable match
    const viableCandidates = scoredCandidates
      .filter((c: any) => c.score >= 2)
      .sort((a: any, b: any) => b.score - a.score);

    if (viableCandidates.length === 0) {
      return json({ action: "none", reason: "No suitable matches found" });
    }

    // Check if already have pending/active intro with top candidate
    const topCandidate = viableCandidates[0];
    
    const { data: existingIntro } = await supabase
      .from("introductions")
      .select("id")
      .or(`and(user_a_id.eq.${userId},user_b_id.eq.${topCandidate.id}),and(user_a_id.eq.${topCandidate.id},user_b_id.eq.${userId})`)
      .in("status", ["pending", "active"])
      .single();

    if (existingIntro) {
      // Try next candidate
      const nextCandidate = viableCandidates[1];
      if (!nextCandidate) {
        return json({ action: "none", reason: "Already connected with best match" });
      }
    }

    const matchCandidate = existingIntro ? viableCandidates[1] : topCandidate;
    if (!matchCandidate) {
      return json({ action: "none", reason: "No available matches" });
    }

    // 5. Generate intro message
    const introMessage = generateIntroMessage(profile, matchCandidate);

    // 6. Create the introduction
    const { data: intro, error: introError } = await supabase
      .from("introductions")
      .insert({
        user_a_id: userId,
        user_b_id: matchCandidate.id,
        status: "pending",
        intro_message: introMessage,
      })
      .select()
      .single();

    if (introError) {
      console.error("Failed to create intro:", introError);
      return json({ action: "none", reason: "Failed to create intro" });
    }

    console.log(`Created intro ${intro.id} between ${userId} and ${matchCandidate.id}`);

    return json({
      action: "intro",
      introId: intro.id,
      matchedWith: matchCandidate.id,
      matchScore: matchCandidate.score,
    });

  } catch (error) {
    console.error("[decision-engine]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function generateIntroMessage(userA: any, userB: any): string {
  const sharedInterests = (userA.interests || []).filter((i: string) =>
    (userB.interests || []).some((bi: string) => 
      bi.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(bi.toLowerCase())
    )
  );

  const sameIndustry = userA.industry && userB.industry && 
    userA.industry.toLowerCase() === userB.industry.toLowerCase();

  let message = `You're both navigating similar paths`;
  
  if (sameIndustry) {
    message += ` in ${userA.industry}`;
  }
  
  if (sharedInterests.length > 0) {
    message += ` with shared interest in ${sharedInterests.slice(0, 2).join(" and ")}`;
  }
  
  message += `.\n\nNo pressure to have answers — just shared context.`;
  
  return message;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
