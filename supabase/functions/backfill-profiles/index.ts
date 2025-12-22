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
    const { password, dryRun = true } = await req.json();

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

    // Fetch profiles with empty/minimal insights
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, role, industry, ai_insights, learning_complete")
      .or("ai_insights.is.null,ai_insights.eq.{}");

    if (profilesError) throw profilesError;

    console.log(`Found ${profiles?.length || 0} profiles with empty insights`);

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

    const results: { userId: string; messageCount: number; status: string; insights?: any }[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    for (const profile of profiles || []) {
      const userMessages = messagesByUser[profile.id] || [];
      const userOnlyMessages = userMessages.filter((m) => m.role === "user");

      // Skip if user has fewer than 3 messages (not enough context)
      if (userOnlyMessages.length < 3) {
        results.push({
          userId: profile.id,
          messageCount: userOnlyMessages.length,
          status: "skipped_low_messages",
        });
        continue;
      }

      // Build conversation for AI extraction
      const conversationText = userMessages
        .slice(-20) // Last 20 messages for context
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      if (dryRun) {
        results.push({
          userId: profile.id,
          messageCount: userOnlyMessages.length,
          status: "would_process",
        });
        continue;
      }

      // Extract insights using AI
      try {
        const extractionPrompt = `Analyze this conversation and extract a user profile. Return ONLY valid JSON with these fields:
{
  "full_name": "string or null",
  "role": "their job/role or null",
  "industry": "their field/industry or null", 
  "skills": ["skill1", "skill2"],
  "interests": ["interest1", "interest2"],
  "looking_for": "what they're seeking (mentorship, connections, etc.) or null",
  "summary": "2-3 sentence summary of who they are and what they need"
}

Conversation:
${conversationText}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a profile extraction assistant. Return only valid JSON." },
              { role: "user", content: extractionPrompt },
            ],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          console.error(`AI error for ${profile.id}:`, await response.text());
          results.push({
            userId: profile.id,
            messageCount: userOnlyMessages.length,
            status: "ai_error",
          });
          continue;
        }

        const aiData = await response.json();
        let extractedText = aiData.choices?.[0]?.message?.content || "";
        
        // Clean markdown code blocks if present
        extractedText = extractedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let extracted;
        try {
          extracted = JSON.parse(extractedText);
        } catch {
          console.error(`JSON parse error for ${profile.id}:`, extractedText);
          results.push({
            userId: profile.id,
            messageCount: userOnlyMessages.length,
            status: "parse_error",
          });
          continue;
        }

        // Update profile with extracted insights
        const updateData: any = {
          ai_insights: {
            summary: extracted.summary || null,
            extracted_at: new Date().toISOString(),
            backfilled: true,
          },
          learning_complete: true,
        };

        // Only update fields that are currently empty
        if (!profile.full_name && extracted.full_name) {
          updateData.full_name = extracted.full_name;
        }
        if (!profile.role && extracted.role) {
          updateData.role = extracted.role;
        }
        if (!profile.industry && extracted.industry) {
          updateData.industry = extracted.industry;
        }
        if (extracted.skills?.length > 0) {
          updateData.skills = extracted.skills;
        }
        if (extracted.interests?.length > 0) {
          updateData.interests = extracted.interests;
        }
        if (extracted.looking_for) {
          updateData.looking_for = extracted.looking_for;
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", profile.id);

        if (updateError) {
          console.error(`Update error for ${profile.id}:`, updateError);
          results.push({
            userId: profile.id,
            messageCount: userOnlyMessages.length,
            status: "update_error",
          });
        } else {
          results.push({
            userId: profile.id,
            messageCount: userOnlyMessages.length,
            status: "success",
            insights: extracted,
          });
        }

        // Rate limit - wait 500ms between API calls
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Error processing ${profile.id}:`, err);
        results.push({
          userId: profile.id,
          messageCount: userOnlyMessages.length,
          status: "error",
        });
      }
    }

    // Summary stats
    const summary = {
      total: results.length,
      processed: results.filter((r) => r.status === "success").length,
      skipped: results.filter((r) => r.status === "skipped_low_messages").length,
      wouldProcess: results.filter((r) => r.status === "would_process").length,
      errors: results.filter((r) => r.status.includes("error")).length,
      dryRun,
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
