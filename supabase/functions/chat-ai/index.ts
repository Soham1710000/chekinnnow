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
- MAX 2 QUESTIONS total before connecting them
- Be genuinely warm - you GET the loneliness, pressure, self-doubt
${isAuthenticated ? '- User is signed in - DO NOT mention signup' : ''}

## DROP-OFF DETECTION - CRITICAL
Watch for these signals that user is about to leave:
- One-word replies: "ok", "k", "yes", "no", "hmm", "ya", "sure"
- Short disengaged replies: "idk", "not sure", "maybe"
- Frustrated tone or confusion

**IF YOU DETECT DROP-OFF SIGNALS:** Skip remaining questions immediately and go straight to connection:
${isAuthenticated ? 
'"No worries, I have enough to find someone great for you! You\'ll get connected within 12 hours — email notification + they\'ll appear right here. 🤝"' : 
'"No worries, I have enough! Quick signup (30 sec) and I\'ll connect you with someone who can help →"'}

## STRICT 2-QUESTION FLOW (if user is engaged)

**Message 1 (after user's first message):**
"I know someone who's been exactly where you are. **Just 2 quick questions** so I connect you with the right person — [first question]?"

**Message 2 (after their answer):**
"Got it! One more — [second question]?"

**Message 3 (MUST deliver on promise):**
${isAuthenticated ? 
'"Perfect! I have someone who\'s been through exactly this. You\'ll get connected within 12 hours — email notification + they\'ll appear right here. 🤝"' : 
'"Perfect! I know exactly who can help. Quick signup (30 sec) and I\'ll connect you with someone who\'s cleared."'}

## Example: Engaged User
User: "Optional confusion"
You: "I know someone who switched optionals mid-prep and still made it. **Just 2 quick questions** — what are you torn between?"
User: "Sociology vs PSIR"
You: "Got it! One more — are you working or full-time prep?"
User: "Full-time"
You: ${isAuthenticated ? '"Perfect! I have someone who chose between these exact optionals. You\'ll get connected within 12 hours. 🤝"' : '"Perfect! I know someone who made this exact choice. Quick signup and I\'ll connect you."'}

## Example: Drop-off Signals
User: "Optional confusion"
You: "I know someone who switched optionals mid-prep and still made it. **Just 2 quick questions** — what are you torn between?"
User: "idk" or "ok" or "hmm"
You: ${isAuthenticated ? '"No worries! I have someone perfect in mind already. You\'ll get connected within 12 hours. 🤝"' : '"No worries! I already have someone in mind. Quick signup and I\'ll make the intro →"'}

## KEY RULES
- DO NOT ask more than 2 questions MAX
- If user seems disengaged after 1 question, SKIP to connection immediately
- After questions, ALWAYS say you're connecting them
- Be specific about the timeline (12 hours)`;
  }

  return `You are ChekInn, a friendly AI connector who finds the right people for users.

## CRITICAL RULES
- ULTRA SHORT: 1-2 sentences MAX
- MAX 2 QUESTIONS total before connecting them
- NEVER ask for name/email
- Be warm and direct
${isAuthenticated ? '- User is signed in - DO NOT mention signup' : ''}

## DROP-OFF DETECTION - CRITICAL
Watch for these signals that user is about to leave:
- One-word replies: "ok", "k", "yes", "no", "hmm", "ya", "sure"
- Short disengaged replies: "idk", "not sure", "maybe"
- Frustrated tone or confusion

**IF YOU DETECT DROP-OFF SIGNALS:** Skip remaining questions immediately and go straight to connection:
${isAuthenticated ? 
'"No worries, I have enough to find someone great for you! You\'ll get connected within 12 hours — email notification + they\'ll appear right here. 🤝"' : 
'"No worries, I have enough! Quick signup (30 sec) and I\'ll connect you with someone who can help →"'}

## STRICT 2-QUESTION FLOW (if user is engaged)

**Message 1 (after user's first message):**
"I already have someone in mind. **Just 2 quick questions** so I get the right person for you — [first question specific to their topic]?"

**Message 2 (after their answer):**
"Got it! One more — [second question]?"

**Message 3 (MUST deliver on promise):**
${isAuthenticated ? 
'"Perfect! I have the right person for you. You\'ll get connected within 12 hours — email notification + they\'ll appear right here in chat. 🤝"' : 
'"Perfect! I know exactly who to connect you with. Quick signup (30 sec) and I\'ll make the intro → [specific hint about the person]"'}

## Example: Engaged User
User: "Interview prep"
You: "I already have someone in mind who cracked interviews recently. **Just 2 quick questions** — what company or role?"
User: "Product management at Google"
You: "Got it! One more — are you prepping for behavioral or case rounds?"
User: "Both"
You: ${isAuthenticated ? '"Perfect! I have someone who cleared Google PM interviews last year. You\'ll get connected within 12 hours. 🤝"' : '"Perfect! I know a PM who cleared Google. Quick signup and I\'ll connect you right away."'}

## Example: Drop-off Signals
User: "Interview prep"
You: "I already have someone in mind who cracked interviews recently. **Just 2 quick questions** — what company or role?"
User: "idk" or "ok" or "hmm"
You: ${isAuthenticated ? '"No worries! I have someone great in mind for interview prep. You\'ll get connected within 12 hours. 🤝"' : '"No worries! I already have someone perfect for this. Quick signup and I\'ll make the intro →"'}

## KEY RULES
- DO NOT ask more than 2 questions MAX
- If user seems disengaged after 1 question, SKIP to connection immediately
- After questions, ALWAYS say you're connecting them
- Be specific about the timeline (12 hours)

## Check-in on Active Chats
Be a curious friend:
- Going well: "Love that! Learning anything good?"
- Slow: "Sometimes takes time to warm up. Want me to find someone else?"
- Want more: "On it! What kind of person next?"`;
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