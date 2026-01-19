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
    const { password, dryRun = true, minMessages = 4 } = await req.json();

    // Verify admin password
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPassword || password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, role, industry, ai_insights, learning_complete, email, bio, skills, interests, looking_for, linkedin_url, onboarding_context");

    if (profilesError) throw profilesError;

    // Fetch all chat messages
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("user_id, role, content, created_at")
      .order("created_at", { ascending: true });

    if (chatError) throw chatError;

    // Group messages by user
    const messagesByUser: Record<string, any[]> = {};
    (chatMessages || []).forEach((msg) => {
      if (!messagesByUser[msg.user_id]) {
        messagesByUser[msg.user_id] = [];
      }
      messagesByUser[msg.user_id].push(msg);
    });

    // Filter profiles that need backfill:
    // - Have 4+ user messages
    // - Don't have a profileSummary in ai_insights
    const profilesToProcess = (profiles || []).filter((profile) => {
      const userMessages = messagesByUser[profile.id] || [];
      const userOnlyMessages = userMessages.filter((m) => m.role === "user");
      const hasEnoughMessages = userOnlyMessages.length >= minMessages;
      
      // Check if already has a profileSummary
      const aiInsights = profile.ai_insights as Record<string, any> || {};
      const hasProfileSummary = !!aiInsights.profileSummary;
      
      return hasEnoughMessages && !hasProfileSummary;
    });

    console.log(`Found ${profilesToProcess.length} profiles with ${minMessages}+ messages needing summary`);

    const results: { userId: string; email: string; messageCount: number; status: string; summary?: any }[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    for (const profile of profilesToProcess) {
      const userMessages = messagesByUser[profile.id] || [];
      const userOnlyMessages = userMessages.filter((m) => m.role === "user");

      // Build conversation for AI extraction
      const conversationText = userMessages
        .slice(-30) // Last 30 messages for context
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      if (dryRun) {
        results.push({
          userId: profile.id,
          email: profile.email || "no email",
          messageCount: userOnlyMessages.length,
          status: "would_process",
        });
        continue;
      }

      // Generate profile summary using AI
      try {
        // Build context from profile and chat
        const onboardingContext = profile.onboarding_context || {};
        
        let contextParts: string[] = [];
        
        // Basic profile data
        contextParts.push(`PROFILE DATA:
- Name: ${profile.full_name || 'Not provided'}
- Email: ${profile.email || 'Not provided'}
- Role: ${profile.role || 'Not provided'}
- Industry: ${profile.industry || 'Not provided'}
- Bio: ${profile.bio || 'Not provided'}
- Skills: ${profile.skills?.join(', ') || 'Not provided'}
- Interests: ${profile.interests?.join(', ') || 'Not provided'}
- Looking For: ${profile.looking_for || 'Not provided'}
- LinkedIn: ${profile.linkedin_url || 'Not provided'}`);

        // Onboarding context
        if (Object.keys(onboardingContext).length > 0) {
          contextParts.push(`ONBOARDING CONTEXT:
${JSON.stringify(onboardingContext, null, 2)}`);
        }

        // Chat history
        contextParts.push(`CHAT HISTORY (${userOnlyMessages.length} user messages):
${conversationText}`);

        const fullContext = contextParts.join('\n\n');

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a professional profile summarizer for ChekInn, a platform that matches professionals.

Generate a comprehensive profile summary from chat history and profile data.

Output valid JSON only with this structure:
{
  "headline": "One-line professional identity (max 100 chars)",
  "narrative": "3-4 sentence story of who they are and what they're working on",
  "seeking": "What they're looking for (1-2 sentences)",
  "offering": "What unique value they can provide (1-2 sentences)",
  "matchKeywords": ["array", "of", "8-12", "keywords"],
  "decisionContext": "Current situation or challenge they're navigating",
  "urgency": "low | medium | high",
  "matchTypes": ["ideal match types"]
}`
              },
              {
                role: "user",
                content: `Generate a profile summary from this data:\n\n${fullContext}`
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI error for ${profile.id}:`, await aiResponse.text());
          results.push({
            userId: profile.id,
            email: profile.email || "no email",
            messageCount: userOnlyMessages.length,
            status: "ai_error",
          });
          continue;
        }

        const aiData = await aiResponse.json();
        let summaryContent = aiData.choices?.[0]?.message?.content || "";
        
        // Clean markdown code blocks if present
        summaryContent = summaryContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let summary;
        try {
          summary = JSON.parse(summaryContent);
        } catch {
          console.error(`JSON parse error for ${profile.id}:`, summaryContent);
          results.push({
            userId: profile.id,
            email: profile.email || "no email",
            messageCount: userOnlyMessages.length,
            status: "parse_error",
          });
          continue;
        }

        // Update profile with summary in ai_insights
        const existingInsights = (profile.ai_insights as Record<string, any>) || {};
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            ai_insights: {
              ...existingInsights,
              profileSummary: summary,
              generatedAt: new Date().toISOString(),
              backfilled: true,
            },
            learning_complete: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error(`Update error for ${profile.id}:`, updateError);
          results.push({
            userId: profile.id,
            email: profile.email || "no email",
            messageCount: userOnlyMessages.length,
            status: "update_error",
          });
        } else {
          results.push({
            userId: profile.id,
            email: profile.email || "no email",
            messageCount: userOnlyMessages.length,
            status: "success",
            summary,
          });
        }

        // Rate limit - wait 500ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing ${profile.id}:`, err);
        results.push({
          userId: profile.id,
          email: profile.email || "no email",
          messageCount: userOnlyMessages.length,
          status: "error",
        });
      }
    }

    // Summary stats
    const summary = {
      total: results.length,
      processed: results.filter((r) => r.status === "success").length,
      wouldProcess: results.filter((r) => r.status === "would_process").length,
      errors: results.filter((r) => r.status.includes("error")).length,
      dryRun,
      minMessages,
    };

    console.log("Backfill complete:", summary);

    return new Response(
      JSON.stringify({ summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
