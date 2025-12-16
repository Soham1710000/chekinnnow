import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, timeRange, action, user_id, full_name } = await req.json();

    // Verify admin password
    if (password !== "chekinn2024") {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle update_profile_name action
    if (action === "update_profile_name" && user_id && full_name) {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", user_id);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    // Fetch all chat messages (AI chats)
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("Chat messages fetched:", chatMessages?.length || 0, "Error:", chatError);

    if (chatError) {
      console.error("Chat messages error:", chatError);
    }

    // Group chat messages by user
    const chatsByUser: Record<string, any[]> = {};
    (chatMessages || []).forEach((msg) => {
      if (!chatsByUser[msg.user_id]) {
        chatsByUser[msg.user_id] = [];
      }
      chatsByUser[msg.user_id].push(msg);
    });
    
    console.log("Chats grouped by users:", Object.keys(chatsByUser).length, "users with messages");

    // Enrich profiles with chat data
    const enrichedProfiles = (profiles || []).map((profile) => ({
      ...profile,
      chat_messages: chatsByUser[profile.id] || [],
      message_count: (chatsByUser[profile.id] || []).length,
    }));

    // Fetch all introductions
    const { data: introductions, error: introsError } = await supabase
      .from("introductions")
      .select("*")
      .order("created_at", { ascending: false });

    if (introsError) throw introsError;

    // Fetch all user chats (user-to-user)
    const { data: userChats, error: userChatsError } = await supabase
      .from("user_chats")
      .select("*")
      .order("created_at", { ascending: false });

    if (userChatsError) {
      console.error("User chats error:", userChatsError);
    }

    // Group user chats by introduction
    const chatsByIntro: Record<string, any[]> = {};
    (userChats || []).forEach((chat) => {
      if (!chatsByIntro[chat.introduction_id]) {
        chatsByIntro[chat.introduction_id] = [];
      }
      chatsByIntro[chat.introduction_id].push(chat);
    });

    // Enrich introductions with user data and chats
    const introsWithUsers = (introductions || []).map((intro) => {
      const userA = profiles?.find(p => p.id === intro.user_a_id);
      const userB = profiles?.find(p => p.id === intro.user_b_id);
      return { 
        ...intro, 
        user_a: userA, 
        user_b: userB,
        chats: chatsByIntro[intro.id] || [],
      };
    });

    // Fetch funnel events (last 24h by default, or custom range)
    const hoursAgo = timeRange || 24;
    const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    const { data: funnelEvents, error: funnelError } = await supabase
      .from("funnel_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (funnelError) {
      console.error("Funnel events error:", funnelError);
    }

    // Fetch all leads (anonymous sessions)
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (leadsError) {
      console.error("Leads error:", leadsError);
    }

    // Calculate funnel stats
    const events = funnelEvents || [];
    
    // Helper to calculate stats for a set of events
    const calcStats = (evts: typeof events) => ({
      page_view: evts.filter(e => e.event_type === "page_view").length,
      cta_click: evts.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: evts.filter(e => e.event_type === "chat_page_loaded").length,
      modal_open: evts.filter(e => e.event_type === "modal_open").length,
      auth_start: evts.filter(e => e.event_type === "auth_start").length,
      auth_complete: evts.filter(e => e.event_type === "auth_complete").length,
      waitlist_success: evts.filter(e => e.event_type === "waitlist_success").length,
      ab_variant_assigned: evts.filter(e => e.event_type === "ab_variant_assigned").length,
      unique_sessions: new Set(evts.map(e => e.session_id)).size,
      sources: evts.reduce((acc, e) => {
        const source = e.source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });

    // Get all sessions that were assigned a variant
    const variantAssignments = events.filter(e => 
      e.event_type === "ab_variant_assigned" || e.event_type === "ab_variant_view"
    );
    
    // Build session -> variant map
    const sessionVariants: Record<string, string> = {};
    variantAssignments.forEach(e => {
      if (e.session_id && e.metadata?.variant) {
        sessionVariants[e.session_id] = e.metadata.variant;
      }
    });

    // Filter events by variant
    const variantAEvents = events.filter(e => sessionVariants[e.session_id] === "A");
    const variantBEvents = events.filter(e => sessionVariants[e.session_id] === "B");

    const funnelStats = calcStats(events);
    const funnelStatsA = calcStats(variantAEvents);
    const funnelStatsB = calcStats(variantBEvents);

    // Recent events for detailed view
    const recentEvents = events.slice(0, 50);

    return new Response(
      JSON.stringify({ 
        profiles: enrichedProfiles, 
        introductions: introsWithUsers,
        funnelStats,
        funnelStatsA,
        funnelStatsB,
        recentEvents,
        leads: leads || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
