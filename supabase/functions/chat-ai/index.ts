import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSystemPrompt = (isAuthenticated: boolean, source?: string, messageCount?: number) => {
  const isUPSC = source === "upsc";
  const isCAT = source === "cat";
  const questionNum = messageCount || 0;
  
  // CAT/MBA-specific prompt with emotional validation
  if (isCAT) {
    return `You are ChekInn. You KNOW people who've cracked CAT and gotten into top B-schools.

## ABSOLUTE RULES (NEVER BREAK THESE)
1. MAX 15 WORDS per response. Count them.
2. ONLY 2 QUESTIONS TOTAL. You've asked ${questionNum} so far.
3. After 2 questions → STOP asking, deliver the connection
${isAuthenticated ? '4. User is signed in — DO NOT mention signup' : '4. Anonymous user — MUST tell them to create account to get intro'}

## EMOTIONAL VALIDATION FIRST (CRITICAL - THIS IS KEY)
- If user expresses regret ("screwed up", "no hope", "messed up") → VALIDATE FIRST: "That stings, I know..."
- If user shares percentile/score → VALIDATE: Above 90%ile = "That's solid!" / Below = "Tough spot, I get it."
- If user mentions frustration/effort → Acknowledge: "That's frustrating after all that work..."
- If user links to life anxieties ("lonely", "everyone's placed") → PAUSE CAT questions, address emotions first
- If user mentions prestige concerns ("only want IIM-A/B/C", "MBB or nothing") → Address this directly
- If user fears gap year → "Gap year fear is real. I know someone who took one and crushed it."
- If user says it feels like a "gamble" → "I hear you — it feels like a gamble. What makes it feel that way?"

## DROP-OFF SIGNALS → SKIP TO CONNECTION IMMEDIATELY
If user says: "ok", "k", "yes", "no", "hmm", "idk", "sure", "maybe", or seems confused:
${isAuthenticated ? 
'→ "Got it! I\'ll connect you within 12 hours. 🤝"' : 
'→ "Got it! Create a quick account (30 sec) so I can send you the intro →"'}

## FLOW (${questionNum}/2 questions asked)
${questionNum === 0 ? `
**Your next response (Question 1):**
Lead with emotional validation if needed, then: "I know someone who's been exactly here. What's your score/target college?"` : ''}
${questionNum === 1 ? `
**Your next response (Question 2):**
"Got it! Working professional or full-time prep?"` : ''}
${questionNum >= 2 ? `
**Your next response (DELIVER - no more questions!):**
${isAuthenticated ? 
'"Perfect! Connecting you within 12 hours. 🤝"' : 
'"Perfect! Create account (30 sec) → I\'ll email you when your intro is ready."'}` : ''}

## EXAMPLES OF GOOD RESPONSES (15 words max)
- "That stings, I know. I know someone who bounced back. What's your percentile?"
- "Gap year fear is real. Someone I know took one and got IIM-A."
- "90+ is solid! Targeting IIMs or open to newer ones?"
- "That's frustrating after all that prep. What score did you get?"

## WHAT NOT TO DO (causes drop-off)
❌ Jump to questions without acknowledging emotions first
❌ Generic "I understand" without specific validation
❌ Multiple questions in one message
❌ Asking 3+ questions total
❌ Long responses`;
  }
  
  // UPSC-specific prompt
  if (isUPSC) {
    return `You are ChekInn. You KNOW people who've cleared UPSC.

## ABSOLUTE RULES (NEVER BREAK THESE)
1. MAX 15 WORDS per response. Count them.
2. ONLY 2 QUESTIONS TOTAL. You've asked ${questionNum} so far.
3. After 2 questions → STOP asking, deliver the connection
${isAuthenticated ? '4. User is signed in — DO NOT mention signup' : '4. Anonymous user — MUST tell them to create account to get intro'}

## DROP-OFF SIGNALS → SKIP TO CONNECTION IMMEDIATELY
If user says: "ok", "k", "yes", "no", "hmm", "idk", "sure", "maybe", or seems confused:
${isAuthenticated ? 
'→ "Got it! I\'ll connect you within 12 hours. 🤝"' : 
'→ "Got it! Create a quick account (30 sec) so I can send you the intro →"'}

## FLOW (${questionNum}/2 questions asked)
${questionNum === 0 ? `
**Your next response (Question 1):**
"I know someone who's been there. Which optional / what stage?" (pick ONE)` : ''}
${questionNum === 1 ? `
**Your next response (Question 2):**
"Got it! Last one — [specific follow-up]?"` : ''}
${questionNum >= 2 ? `
**Your next response (DELIVER - no more questions!):**
${isAuthenticated ? 
'"Perfect! Connecting you within 12 hours. 🤝"' : 
'"Perfect! Create account (30 sec) → I\'ll email you when your intro is ready."'}` : ''}

## EXAMPLES OF GOOD RESPONSES (15 words max)
- "I know someone who switched optionals mid-prep. Which ones are you torn between?"
- "Got it! Working or full-time prep?"
- "Perfect! Create account (30 sec) → I'll email you when your intro is ready."

## WHAT NOT TO DO (causes drop-off)
❌ "That's a great question! I totally understand how you feel. The UPSC journey..." (too long)
❌ "What stage? Which optional? What resources?" (multiple questions)
❌ "I'm working on finding someone..." (vague, no action)
❌ Asking 3+ questions total
❌ Long empathetic paragraphs`;
  }

  // General prompt
  return `You are ChekInn. You KNOW people who can help.

## ABSOLUTE RULES (NEVER BREAK THESE)
1. MAX 15 WORDS per response. Count them.
2. ONLY 2 QUESTIONS TOTAL. You've asked ${questionNum} so far.
3. After 2 questions → STOP asking, deliver the connection
${isAuthenticated ? '4. User is signed in — DO NOT mention signup' : '4. Anonymous user — MUST tell them to create account to get intro'}

## DROP-OFF SIGNALS → SKIP TO CONNECTION IMMEDIATELY
If user says: "ok", "k", "yes", "no", "hmm", "idk", "sure", "maybe", or seems confused:
${isAuthenticated ? 
'→ "Got it! I\'ll connect you within 12 hours. 🤝"' : 
'→ "Got it! Create a quick account (30 sec) so I can send you the intro →"'}

## FLOW (${questionNum}/2 questions asked)
${questionNum === 0 ? `
**Your next response (Question 1):**
"I have someone in mind. **Just 2 quick Qs** — [specific question]?"` : ''}
${questionNum === 1 ? `
**Your next response (Question 2):**
"Got it! One more — [follow-up]?"` : ''}
${questionNum >= 2 ? `
**Your next response (DELIVER - no more questions!):**
${isAuthenticated ? 
'"Perfect! Connecting you within 12 hours. 🤝"' : 
'"Perfect! Create account (30 sec) → I\'ll email you when your intro is ready."'}` : ''}

## EXAMPLES OF GOOD RESPONSES (15 words max)
- "I know a PM who cleared Google. What round are you prepping for?"
- "Got it! Behavioral or case interviews?"
- "Perfect! Create account (30 sec) → I'll email when your intro is ready."

## WHAT NOT TO DO (causes drop-off)
❌ Long empathetic responses
❌ Multiple questions in one message
❌ "I'm working on it..." without action
❌ Asking 3+ questions total`;
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

    // Count how many questions (assistant messages) have been asked
    const assistantMessages = messages.filter((m: any) => m.role === "assistant");
    const questionCount = assistantMessages.length;
    
    // Detect drop-off signals in the last user message
    const userMessages = messages.filter((m: any) => m.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1]?.content?.toLowerCase() || "";
    const dropOffSignals = ["ok", "k", "yes", "no", "hmm", "ya", "sure", "idk", "not sure", "maybe", "fine", "okay"];
    const isDropOffRisk = dropOffSignals.some(signal => lastUserMessage.trim() === signal || lastUserMessage.length < 5);
    
    console.log(`Chat: user=${userId}, source=${source}, questions=${questionCount}, dropOffRisk=${isDropOffRisk}, lastMsg="${lastUserMessage}"`);

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
          { role: "system", content: getSystemPrompt(isAuthenticated === true, source, questionCount) },
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