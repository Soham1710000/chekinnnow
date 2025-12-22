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

    // Verify admin password from secure secret
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
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

    // Fetch all chat messages (AI chats) - paginate to bypass 1000 row limit
    let allChatMessages: any[] = [];
    let lastCreatedAt: string | null = null;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      
      if (lastCreatedAt) {
        query = query.lt("created_at", lastCreatedAt);
      }
      
      const { data: batch, error: chatError } = await query;
      
      if (chatError) {
        console.error("Chat messages error:", chatError);
        break;
      }
      
      if (batch && batch.length > 0) {
        allChatMessages = [...allChatMessages, ...batch];
        lastCreatedAt = batch[batch.length - 1].created_at;
        hasMore = batch.length === 1000;
      } else {
        hasMore = false;
      }
    }
    
    const chatMessages = allChatMessages;
    console.log("Chat messages fetched (all pages):", chatMessages.length);

    // Group chat messages by user
    const chatsByUser: Record<string, any[]> = {};
    (chatMessages || []).forEach((msg) => {
      if (!chatsByUser[msg.user_id]) {
        chatsByUser[msg.user_id] = [];
      }
      chatsByUser[msg.user_id].push(msg);
    });
    
    console.log("Chats grouped by users:", Object.keys(chatsByUser).length, "users with messages");

    // Calculate returning user metrics (users who chatted on multiple days)
    const returningUserStats = {
      total_returning: 0,
      returning_users: [] as { id: string; active_days: number; session_count: number; first_chat: string; last_chat: string }[],
    };

    // Group funnel events by user for session counting (we'll calculate this after fetching funnel_events)
    // For now, calculate active days from chat messages
    const userActiveDays: Record<string, Set<string>> = {};
    (chatMessages || []).forEach((msg) => {
      if (!userActiveDays[msg.user_id]) {
        userActiveDays[msg.user_id] = new Set();
      }
      const date = new Date(msg.created_at).toISOString().split("T")[0];
      userActiveDays[msg.user_id].add(date);
    });

    // Enrich profiles with chat data and returning user status
    const enrichedProfiles = (profiles || []).map((profile) => {
      const messages = chatsByUser[profile.id] || [];
      const activeDays = userActiveDays[profile.id]?.size || 0;
      const isReturning = activeDays > 1;
      
      // Get first and last chat dates
      let firstChat = null;
      let lastChat = null;
      if (messages.length > 0) {
        const sorted = [...messages].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        firstChat = sorted[0]?.created_at;
        lastChat = sorted[sorted.length - 1]?.created_at;
      }

      if (isReturning) {
        returningUserStats.total_returning++;
        returningUserStats.returning_users.push({
          id: profile.id,
          active_days: activeDays,
          session_count: activeDays, // Approximate from days for now
          first_chat: firstChat,
          last_chat: lastChat,
        });
      }

      return {
        ...profile,
        chat_messages: messages,
        message_count: messages.length,
        active_days: activeDays,
        is_returning: isReturning,
        first_chat: firstChat,
        last_chat: lastChat,
      };
    });

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
    
    // UPSC-specific events (variant = "UPSC" in metadata OR page_url contains /upsc)
    const upscEvents = events.filter(e => 
      e.metadata?.variant === "UPSC" || 
      e.page_url?.includes("/upsc")
    );
    
    // CAT-specific events (variant = "CAT" in metadata OR page_url contains /cat)
    const catEvents = events.filter(e => 
      e.metadata?.variant === "CAT" || 
      e.page_url?.includes("/cat")
    );
    
    // Main/Other events (not UPSC or CAT)
    const mainEvents = events.filter(e => 
      e.metadata?.variant !== "UPSC" && 
      e.metadata?.variant !== "CAT" &&
      !e.page_url?.includes("/upsc") &&
      !e.page_url?.includes("/cat")
    );

    // General funnel stats
    const funnelStats = {
      page_view: events.filter(e => e.event_type === "page_view").length,
      cta_click: events.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: events.filter(e => e.event_type === "chat_page_loaded").length,
      modal_open: events.filter(e => e.event_type === "modal_open").length,
      auth_start: events.filter(e => e.event_type === "auth_start").length,
      auth_complete: events.filter(e => e.event_type === "auth_complete").length,
      waitlist_success: events.filter(e => e.event_type === "waitlist_success").length,
      unique_sessions: new Set(events.map(e => e.session_id)).size,
      upsc_cta_clicks: upscEvents.filter(e => e.event_type === "cta_click").length,
      cat_cta_clicks: catEvents.filter(e => e.event_type === "cta_click").length,
      sources: events.reduce((acc, e) => {
        const source = e.source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    // UPSC-specific detailed stats
    const upscStats = {
      page_view: upscEvents.filter(e => e.event_type === "page_view").length,
      cta_click: upscEvents.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: upscEvents.filter(e => e.event_type === "chat_page_loaded").length,
      auth_start: upscEvents.filter(e => e.event_type === "auth_start").length,
      auth_complete: upscEvents.filter(e => e.event_type === "auth_complete").length,
      unique_sessions: new Set(upscEvents.map(e => e.session_id)).size,
      // CTA template breakdown
      templates: upscEvents
        .filter(e => e.event_type === "cta_click" && e.metadata?.template)
        .reduce((acc, e) => {
          const template = e.metadata?.template || "main_cta";
          acc[template] = (acc[template] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      // Recent UPSC events
      recentEvents: upscEvents.slice(0, 20),
    };

    // CAT-specific detailed stats
    const catStats = {
      page_view: catEvents.filter(e => e.event_type === "page_view").length,
      cta_click: catEvents.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: catEvents.filter(e => e.event_type === "chat_page_loaded").length,
      auth_start: catEvents.filter(e => e.event_type === "auth_start").length,
      auth_complete: catEvents.filter(e => e.event_type === "auth_complete").length,
      unique_sessions: new Set(catEvents.map(e => e.session_id)).size,
      // CTA template breakdown
      templates: catEvents
        .filter(e => e.event_type === "cta_click" && e.metadata?.template)
        .reduce((acc, e) => {
          const template = e.metadata?.template || "main_cta";
          acc[template] = (acc[template] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      // Recent CAT events
      recentEvents: catEvents.slice(0, 20),
    };

    // Main page stats for comparison
    const mainStats = {
      page_view: mainEvents.filter(e => e.event_type === "page_view").length,
      cta_click: mainEvents.filter(e => e.event_type === "cta_click").length,
      chat_page_loaded: mainEvents.filter(e => e.event_type === "chat_page_loaded").length,
      auth_start: mainEvents.filter(e => e.event_type === "auth_start").length,
      auth_complete: mainEvents.filter(e => e.event_type === "auth_complete").length,
      unique_sessions: new Set(mainEvents.map(e => e.session_id)).size,
    };

    // Recent events for detailed view
    const recentEvents = events.slice(0, 50);

    // Calculate engagement metrics
    const engagementMetrics = {
      total_users: enrichedProfiles.length,
      users_with_messages: enrichedProfiles.filter(p => p.message_count > 0).length,
      returning_users: returningUserStats.total_returning,
      learning_complete: enrichedProfiles.filter(p => p.learning_complete).length,
      avg_messages_per_user: enrichedProfiles.length > 0 
        ? Math.round(enrichedProfiles.reduce((sum, p) => sum + p.message_count, 0) / enrichedProfiles.length * 10) / 10
        : 0,
      total_messages: (chatMessages || []).length,
      active_intros: (introductions || []).filter(i => i.status === "active").length,
      total_intros: (introductions || []).length,
    };

    return new Response(
      JSON.stringify({ 
        profiles: enrichedProfiles, 
        introductions: introsWithUsers,
        funnelStats,
        upscStats,
        catStats,
        mainStats,
        recentEvents,
        leads: leads || [],
        returningUserStats,
        engagementMetrics,
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