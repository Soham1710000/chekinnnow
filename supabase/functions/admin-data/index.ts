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

    // Fetch all introductions
    const { data: introductions, error: introsError } = await supabase
      .from("introductions")
      .select("*")
      .order("created_at", { ascending: false });

    if (introsError) throw introsError;

    // Enrich introductions with user data
    const introsWithUsers = await Promise.all(
      (introductions || []).map(async (intro) => {
        const userA = profiles?.find(p => p.id === intro.user_a_id);
        const userB = profiles?.find(p => p.id === intro.user_b_id);
        return { ...intro, user_a: userA, user_b: userB };
      })
    );

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

    // Calculate funnel stats
    const events = funnelEvents || [];
    const funnelStats = {
      page_view: events.filter(e => e.event_type === "page_view").length,
      cta_click: events.filter(e => e.event_type === "cta_click").length,
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
        profiles, 
        introductions: introsWithUsers,
        funnelStats,
        recentEvents,
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
