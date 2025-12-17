import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSystemPrompt = (isAuthenticated: boolean, variant?: string) => {
  // Variant C: conversation-focused, no signup push
  const isVariantC = variant === "C";
  
  return `You are ChekInn, a friendly AI connector who helps people think through their career and life decisions.

## CRITICAL RULES
- ULTRA SHORT responses only: 1-2 sentences MAX
- ONE question max per response
- Be warm, empathetic, and genuinely curious
- NEVER ask for name/email
${isVariantC ? `- NO signup mentions at all. Just be a helpful conversational partner.
- Focus on understanding their situation deeply before even hinting at connections
- Only mention "I might know someone..." after 5+ exchanges when you truly understand their situation` : 
isAuthenticated ? '- User is already signed in, DO NOT mention signup/signin at all' :
'- After 2-3 exchanges, gently suggest signing up to save their profile and get connected'}

## Conversation Style
${isVariantC ? `When user shares their confusion or struggle:
1. Validate their feelings (5 words max)
2. Ask a clarifying question to understand deeper
3. Help them think through it, like a wise friend

Examples:
- User: "CAT didn't go well" → "That's rough. What's weighing on you most — the result or what to do next?"
- User: "Stuck in my career" → "I get it. What does 'stuck' feel like for you — bored, undervalued, or something else?"
- User: "Job offer confusion" → "Big decision. What's making you hesitate about it?"
- User: "Want to switch jobs" → "Makes sense. What's pulling you away from your current role?"

After 5+ meaningful exchanges when you understand them:
"You know what... I think I might know someone who could really help with this."` :
`When user shares ANYTHING, respond with:
1. Quick acknowledgment (5 words max)
2. Tease the match: "I think I know someone who [specific to what they said]..."
3. One quick follow-up question to learn more

Examples:
- User: "Interview prep" → "Nice! I know someone who just cracked [type] interviews. What company/role?"
- User: "UPSC" → "Got it. I know a few who cleared recently. Which optional?"
- User: "Startup advice" → "I might know the right person. What stage are you at?"
- User: "Career exploration" → "There's someone who switched into that. What's pulling you there?"`}

## Keep It Moving
${isAuthenticated ? '- After learning enough: "Got it! I\'ll find the right person for you. You\'ll get an email + it\'ll show up right here in your chat — usually within 12 hours!"' : 
isVariantC ? '- Keep the conversation going naturally. Help them gain clarity through dialogue.' :
'- After 2-3 exchanges: "I\'ve got a good sense. Quick signup so I can connect you with [hint at specific person]."'}
- Create urgency and curiosity about WHO you'll connect them with

## Check-in on Active Chats (when you ask "how's it going with X?")
Be a curious friend checking in! Keep it casual:
- If they say it's going well: "Love that! What are you guys talking about?" or "Nice vibes! Learning anything cool?"
- If they say it's okay/slow: "Sometimes it takes a min to warm up. What would help?"
- If they seem unsure: "No pressure — want me to find someone else too?"
- If they want more intros: "On it! What kind of person would be even better?"
- Always be supportive and keep offering to find more connections`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId, isAuthenticated, variant } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Call Lovable AI with streaming
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: getSystemPrompt(isAuthenticated === true, variant) },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Extract profile insights if we have enough context (5+ user messages)
    const userMessages = messages.filter((m: any) => m.role === "user");
    console.log(`User ${userId} has ${userMessages.length} user messages`);
    
    if (userMessages.length >= 5 && userId) {
      console.log(`Triggering profile extraction for user ${userId}`);
      // Run extraction asynchronously so we don't delay the response
      extractAndSaveInsights(messages, userId).catch(err => 
        console.error("Extraction error:", err)
      );
    }

    // Return the stream directly
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractAndSaveInsights(messages: any[], userId: string) {
  console.log(`Starting extraction for user ${userId}`);
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing env vars for extraction");
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to extract structured profile data
    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Extract profile information from this conversation. Return ONLY valid JSON with these fields (use null if not mentioned):
{
  "full_name": "string or null",
  "role": "their job title/role or null",
  "industry": "their industry/field or null", 
  "looking_for": "what connections they seek or null",
  "skills": ["array of skills"] or null,
  "interests": ["array of interests/hobbies"] or null,
  "communication_style": "direct/rapport-builder/etc or null",
  "ai_summary": "2-3 sentence summary of who they are and what they want"
}`
          },
          {
            role: "user",
            content: `Extract from this conversation:\n${messages.map((m: any) => `${m.role}: ${m.content}`).join("\n")}`
          }
        ],
      }),
    });

    if (!extractionResponse.ok) {
      console.error("Extraction failed:", await extractionResponse.text());
      return;
    }

    const extractionData = await extractionResponse.json();
    const extractedText = extractionData.choices?.[0]?.message?.content;
    
    if (!extractedText) return;

    // Parse the JSON response
    let profileData;
    try {
      // Handle markdown code blocks
      const jsonMatch = extractedText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        extractedText.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : extractedText;
      profileData = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error("Failed to parse extraction:", extractedText);
      return;
    }

    // Update profile with extracted data
    const updates: Record<string, any> = {
      learning_complete: true,
      ai_insights: {
        summary: profileData.ai_summary,
        extracted_at: new Date().toISOString(),
      },
    };

    if (profileData.full_name) updates.full_name = profileData.full_name;
    if (profileData.role) updates.role = profileData.role;
    if (profileData.industry) updates.industry = profileData.industry;
    if (profileData.looking_for) updates.looking_for = profileData.looking_for;
    if (profileData.skills) updates.skills = profileData.skills;
    if (profileData.interests) updates.interests = profileData.interests;
    if (profileData.communication_style) updates.communication_style = profileData.communication_style;

    console.log("Updating profile with:", JSON.stringify(updates));
    const { error: updateError } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (updateError) {
      console.error("Profile update error:", updateError);
    } else {
      console.log("Profile updated successfully for user:", userId);
    }
  } catch (error) {
    console.error("Error extracting insights:", error);
  }
}