import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InterventionAction = "none" | "reflect" | "intro";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return json({ action: "none", reason: "Missing userId" });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    /**
     * 1. Load the most recent active decision thread
     */
    const { data: thread } = await supabase
      .from("decision_threads")
      .select("*")
      .eq("user_id", userId)
      .order("last_active_at", { ascending: false })
      .limit(1)
      .single();

    if (!thread) {
      return json({ action: "none", reason: "No active decision thread" });
    }

    /**
     * 2. Hard gates — most users exit here
     */
    if (thread.message_count < 3) {
      return json({ action: "none", reason: "Insufficient context" });
    }

    if (thread.return_count < 1) {
      return json({ action: "none", reason: "No temporal recurrence yet" });
    }

    /**
     * 3. Reflection phase (before ANY intros)
     */
    if (thread.clarity_score < 0.6) {
      // Avoid repeating reflections too often
      if (
        thread.last_reflection_at &&
        Date.now() - new Date(thread.last_reflection_at).getTime() < 48 * 60 * 60 * 1000
      ) {
        return json({ action: "none", reason: "Reflection recently sent" });
      }

      const reflection = generateReflection(thread);

      // Persist reflection timestamp
      await supabase
        .from("decision_threads")
        .update({ last_reflection_at: new Date().toISOString() })
        .eq("id", thread.id);

      return json({
        action: "reflect",
        message: reflection,
        threadId: thread.id,
      });
    }

    /**
     * 4. Safety gates before intros
     */
    if (thread.emotional_volatility > 0.6) {
      return json({ action: "none", reason: "Emotional volatility high" });
    }

    if (thread.intro_readiness < 0.7) {
      return json({ action: "none", reason: "Intro readiness low" });
    }

    /**
     * 5. Check active intros cap (max 2–3)
     */
    const { count: activeIntros } = await supabase
      .from("introductions")
      .select("*", { count: "exact", head: true })
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .in("status", ["pending", "active"]);

    if ((activeIntros || 0) >= 3) {
      return json({ action: "none", reason: "Active intro limit reached" });
    }

    /**
     * 6. Find intro candidate by DECISION SIMILARITY
     *    (not interests / skills)
     */
    const { data: candidates } = await supabase
      .from("decision_threads")
      .select("id, user_id, topic")
      .eq("topic", thread.topic)
      .neq("user_id", userId)
      .order("first_seen_at", { ascending: true })
      .limit(5);

    if (!candidates || candidates.length === 0) {
      return json({ action: "none", reason: "No relevant decision peers" });
    }

    const match = candidates[0];

    /**
     * 7. Create intro with heavy context
     */
    const introMessage = generateIntroMessage(thread.topic);

    const { data: intro } = await supabase
      .from("introductions")
      .insert({
        user_a_id: userId,
        user_b_id: match.user_id,
        status: "pending",
        intro_message: introMessage,
        decision_thread_id: thread.id,
      })
      .select()
      .single();

    return json({
      action: "intro",
      introId: intro.id,
      threadId: thread.id,
    });
  } catch (error) {
    console.error("[intervention-engine]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

/* ---------------- helpers ---------------- */

function generateReflection(thread: any): string {
  return `You’ve been circling this decision for a while.
The options haven’t changed — just time.

That usually means the tradeoff matters more than the choice.`;
}

function generateIntroMessage(topic: string): string {
  return `You’re both dealing with the same decision — ${topic} — at different points in time.

One of you has already walked this path.

No advice expected. Just shared context.`;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
