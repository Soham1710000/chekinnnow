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
    const { password, timeRange } = await req.json();

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
    const funnelStats = {
      page_view: events.filter(e => e.event_type === "page_view").length,
      cta_click: events.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: events.filter(e => e.event_type === "chat_page_loaded").length,
      modal_open: events.filter(e => e.event_type === "modal_open").length,
      auth_start: events.filter(e => e.event_type === "auth_start").length,
      auth_complete: events.filter(e => e.event_type === "auth_complete").length,
      waitlist_success: events.filter(e => e.event_type === "waitlist_success").length,
      unique_sessions: new Set(events.map(e => e.session_id)).size,
      sources: events.reduce((acc, e) => {
        const source = e.source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // Recent events for detailed view
    const recentEvents = events.slice(0, 50);

    return new Response(
      JSON.stringify({ 
        profiles: enrichedProfiles, 
        introductions: introsWithUsers,
        funnelStats,
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
