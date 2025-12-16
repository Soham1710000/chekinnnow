import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// How long before we nudge (in minutes)
const STALE_CHAT_MINUTES = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find active introductions
    const { data: activeIntros, error: introsError } = await supabase
      .from("introductions")
      .select("id, user_a_id, user_b_id, created_at")
      .eq("status", "active");

    if (introsError) {
      console.error("Error fetching intros:", introsError);
      throw introsError;
    }

    console.log(`Found ${activeIntros?.length || 0} active introductions`);

    const nudgesSent: string[] = [];
    const cutoffTime = new Date(Date.now() - STALE_CHAT_MINUTES * 60 * 1000).toISOString();

    for (const intro of activeIntros || []) {
      // Get the last message in this intro's chat
      const { data: lastMessage } = await supabase
        .from("user_chats")
        .select("created_at, sender_id")
        .eq("introduction_id", intro.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no messages yet or last message is old, nudge both users
      const lastMessageTime = lastMessage?.created_at || intro.created_at;
      
      if (lastMessageTime < cutoffTime) {
        console.log(`Intro ${intro.id} is stale (last activity: ${lastMessageTime})`);

        // Get both users' profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [intro.user_a_id, intro.user_b_id]);

        const userAProfile = profiles?.find(p => p.id === intro.user_a_id);
        const userBProfile = profiles?.find(p => p.id === intro.user_b_id);

        // Check if we already sent a nudge recently (in last hour)
        const recentNudgeCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // Nudge user A about user B
        const { data: recentNudgeA } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("user_id", intro.user_a_id)
          .eq("role", "assistant")
          .ilike("content", `%${userBProfile?.full_name || ""}%`)
          .gte("created_at", recentNudgeCutoff)
          .limit(1)
          .maybeSingle();

        if (!recentNudgeA) {
          const nudgeMessages = [
            `Hey! How's it going with ${userBProfile?.full_name || "your connection"}? 👀`,
            `Quick check — chatted with ${userBProfile?.full_name || "your match"} yet?`,
            `Just checking in! How's ${userBProfile?.full_name || "the connection"} going?`,
          ];
          const randomNudge = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];

          await supabase.from("chat_messages").insert({
            user_id: intro.user_a_id,
            role: "assistant",
            content: randomNudge,
            message_type: "nudge",
            metadata: { intro_id: intro.id, nudge_type: "stale_chat" },
          });

          nudgesSent.push(`${intro.user_a_id} about ${userBProfile?.full_name}`);
          console.log(`Nudged user ${intro.user_a_id}`);
        }

        // Nudge user B about user A
        const { data: recentNudgeB } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("user_id", intro.user_b_id)
          .eq("role", "assistant")
          .ilike("content", `%${userAProfile?.full_name || ""}%`)
          .gte("created_at", recentNudgeCutoff)
          .limit(1)
          .maybeSingle();

        if (!recentNudgeB) {
          const nudgeMessages = [
            `Hey! How's it going with ${userAProfile?.full_name || "your connection"}? 👀`,
            `Quick check — chatted with ${userAProfile?.full_name || "your match"} yet?`,
            `Just checking in! How's ${userAProfile?.full_name || "the connection"} going?`,
          ];
          const randomNudge = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];

          await supabase.from("chat_messages").insert({
            user_id: intro.user_b_id,
            role: "assistant",
            content: randomNudge,
            message_type: "nudge",
            metadata: { intro_id: intro.id, nudge_type: "stale_chat" },
          });

          nudgesSent.push(`${intro.user_b_id} about ${userAProfile?.full_name}`);
          console.log(`Nudged user ${intro.user_b_id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        nudgesSent: nudgesSent.length,
        details: nudgesSent 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Nudge error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
