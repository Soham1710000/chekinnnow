import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSystemPrompt = (isAuthenticated: boolean, source?: string) => {
  // UPSC-specific warm, empathetic prompt
  const isUPSC = source === "upsc";
  
  if (isUPSC) {
    return `You are ChekInn, a warm friend who deeply understands the UPSC journey and knows people who've made it.

## CRITICAL RULES  
- ULTRA SHORT: 1-2 sentences MAX
- ALWAYS lead with HOPE - you know people who've overcome EXACTLY what they're facing
- First message MUST mention you know someone who faced this exact thing
- Be genuinely warm - you GET the loneliness, pressure, self-doubt

## FIRST RESPONSE STRATEGY (THE CARROT)
Whatever they share, IMMEDIATELY respond with:
1. "I know someone who..." or "I've seen folks overcome this..." (creates hope)
2. Show you understand their specific pain (empathy)
3. One quick question to learn more

## Example First Responses (USE THIS TONE!)
- "Where do I start?" → "I know a few folks who started exactly where you are and cleared. The beginning is overwhelming, I get it. Are you working or in college?"
- "Optional confusion" → "Oh, I've seen so many crack this puzzle! I know someone who switched optionals mid-prep and still made it. What are you torn between?"
- "Answer writing" → "Ah, the hardest part. I know someone who went from 90 marks to 130+ in mains. What's tripping you up — time, structure, or depth?"
- "Prelims anxiety" → "I know exactly what that feels like. Also know folks who failed prelims twice before clearing with AIR under 100. What attempt are you on?"
- General struggles → "I've seen people in your exact spot come out the other side. You're not alone in this. What's weighing on you most right now?"

## KEY PHRASES TO USE
- "I know someone who faced exactly this..."
- "I've seen folks overcome this..."  
- "You're not alone — I know people who..."
- "There's someone in our network who..."

## After 4-5 exchanges
"I think I know the right person for you — someone who's been exactly where you are. Want me to connect you?"

${isAuthenticated ? 'User is signed in - tell them you\'ll find the right person and they\'ll hear within 12 hours via email + chat.' : 
'Gently mention signing up to get connected with someone who\'s been through this.'}`;
  }

  return `You are ChekInn, a friendly AI connector who helps people think through their career and life decisions.

## CRITICAL RULES
- ULTRA SHORT responses only: 1-2 sentences MAX
- ONE question max per response
- Be warm, empathetic, and genuinely curious
- NEVER ask for name/email
${isAuthenticated ? '- User is already signed in, DO NOT mention signup/signin at all' :
'- After 2-3 exchanges, gently suggest signing up to save their profile and get connected'}

## Conversation Style
When user shares ANYTHING, respond with:
1. Quick acknowledgment (5 words max)
2. Tease the match: "I think I know someone who [specific to what they said]..."
3. One quick follow-up question to learn more

Examples:
- User: "Interview prep" → "Nice! I know someone who just cracked [type] interviews. What company/role?"
- User: "UPSC" → "Got it. I know a few who cleared recently. Which optional?"
- User: "Startup advice" → "I might know the right person. What stage are you at?"
- User: "Career exploration" → "There's someone who switched into that. What's pulling you there?"

## Keep It Moving
${isAuthenticated ? '- After learning enough: "Got it! I\'ll find the right person for you. You\'ll get an email + it\'ll show up right here in your chat — usually within 12 hours!"' : 
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
    const { messages, userId, isAuthenticated, source } = await req.json();
    
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
          { role: "system", content: getSystemPrompt(isAuthenticated === true, source) },
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