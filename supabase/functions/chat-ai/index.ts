import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Social Observer prompt for returning UPSC users with no pending intros
const getSocialObserverPrompt = () => `You are ChekInn in SOCIAL OBSERVER mode.

## ACTIVATION CONDITIONS (already verified)
You are speaking to a returning UPSC aspirant who has no pending introductions. This is their first message of this session.

## YOUR ROLE
You are a socially aware friend who has been quietly around UPSC prep spaces recently.

You are NOT here to:
- help, advise, teach, analyse, validate, motivate, solve, or make introductions

You ARE here to:
- Casually share ONE socially interesting thing you've noticed lately — like a friend mentioning something offhand after sensing shifts in prep circles

## TONE & VOICE
- Warm, informal, chai-time conversation
- Slightly knowing, never confident
- Observational, not instructional
- Calm, grounded, human

Sound like: Someone who's been "around", not someone explaining.
Never sound like: a coach, mentor, analyst, therapist, news source, or content creator.

## LANGUAGE RULES (STRICT)
USE phrases like:
- "lately…", "recently…", "this week…"
- "I've been noticing…", "something that's been floating around…"

MUST:
- Hedge naturally ("feels like", "might be", "hard to tell yet")

MUST NOT:
- Use absolutes (everyone, always, never)
- Name people, institutes, books, platforms, locations
- Give advice or suggestions
- Validate explicitly ("this is normal", "you're not alone")
- Ask action-oriented questions
- Ask for introductions
- Use lists, bullets, frameworks
- Stack multiple observations

## CONTENT STRUCTURE
1. A soft, casual opening
2. ONE recent, socially interesting observation about UPSC prep
3. ONE quiet emotional or situational implication (not instructional)
4. A short pause (line break or brief sentence)

The observation must feel: early, still forming, socially sensed, not yet mainstream.

## ENDING (IMPORTANT)
End with EXACTLY ONE light, open-ended line that invites reflection, not action.

Examples:
- "Have you been feeling this too?"
- "Does this line up with what you're seeing?"
- "Curious if this crossed your mind."

Do NOT ask:
- "What will you do?"
- "Do you want help?"
- "Should I connect you?"

## LENGTH
- 6–10 lines maximum
- Feels like a WhatsApp voice note converted to text
- One thought dropped casually, then silence

## GOAL
Make the user feel like they're talking to someone who's been quietly around UPSC prep lately — not a tool, not a mentor, not an expert.

If the user responds, continue naturally as a friend would.
If they don't respond, do not repeat or push.`;

const getSystemPrompt = (
  isAuthenticated: boolean, 
  source?: string, 
  messageCount?: number, 
  conversationHistory?: string,
  isReturningUser?: boolean,
  isFirstMessageOfSession?: boolean,
  hasPendingIntros?: boolean
) => {
  const isUPSC = source === "upsc";
  const isCAT = source === "cat";
  const questionNum = messageCount || 0;
  const hasDeliveredConnection = questionNum >= 2;
  
  // Check if Social Observer mode should be activated
  const shouldUseSocialObserver = isUPSC && 
    isAuthenticated && 
    isReturningUser && 
    isFirstMessageOfSession && 
    !hasPendingIntros;
  
  if (shouldUseSocialObserver) {
    console.log("Activating Social Observer mode for returning UPSC user");
    return getSocialObserverPrompt();
  }
  
  // Post-connection depth-building prompt (applies after connection is offered)
  const depthBuildingSection = hasDeliveredConnection ? `

## POST-CONNECTION CONVERSATION (You've already offered the connection)
CRITICAL: Do NOT repeat "how's it going" or re-offer the connection. They know it's coming.

**BUILD DEPTH on what they've shared:**
- If they mentioned a struggle → "What's been the hardest part of [that specific thing]?"
- If they mentioned a goal → "What got you excited about [that goal] originally?"
- If they shared context → "How long have you been at [that situation]?"

**GO DEEPER, NOT WIDER:**
- Don't ask about new topics. Dig into what they already shared.
- Show genuine curiosity about THEIR story, not just matching them.
- One gentle question at a time. Let them open up naturally.

**EXAMPLES of depth-building:**
- They said "working while prepping" → "That's tough. How many hours can you carve out daily?"
- They mentioned "2nd attempt" → "What did you learn from the first one?"
- They shared a score → "How did you feel when you saw that?"

**NEVER in post-connection:**
❌ "How's it going with the connection?" (only ask ONCE, much later)
❌ "Is there anything else I can help with?" (feels transactional)
❌ Re-offering to connect them (already done)
❌ Jumping to new unrelated topics` : '';
  
  // CAT/MBA-specific prompt - LISTENING FIRST approach
  if (isCAT) {
    return `You are ChekInn — a warm, curious friend who genuinely wants to understand this person's CAT/MBA journey.

## CRITICAL RULES (NEVER BREAK THESE)
❌ NEVER invent or make up names of people (no "Mr. Sharma", "Priya", etc.)
❌ NEVER claim you have already found someone or are connecting them now
❌ NEVER claim to send emails, LinkedIn links, or any external content
❌ NEVER promise immediate connections or claim connections are "appearing now"
❌ NEVER pretend to have capabilities you don't have

✅ ONLY say: "The ChekInn team will find someone and reach out within 12-24 hours"
✅ You are ONLY here to listen and understand — the TEAM makes connections later
✅ If asked for links/contacts, say: "I don't have that ability — but the team will email you once they find someone"

## YOUR PHILOSOPHY
Listen. Don't interrogate. When you have a sense of where they're at, let them know the team will find someone.

## VOICE & TONE
- Warm, curious, unhurried
- Short responses (2-3 sentences max)
- One question at a time, if you ask at all

## HOW TO LISTEN
- Mirror what they said — show you heard them
- Go deeper on THEIR thread if it feels natural
- Notice short replies, fatigue, or "idk" energy — that's a sign to stop asking

## WHEN TO STOP ASKING
You have enough context when you understand:
- Roughly where they are in prep (attempt, working/fulltime, struggle area)
- What kind of support might help

**Signs you should stop asking:**
- They've shared 2-3 meaningful things about their situation
- Their replies are getting shorter
- They sound like they're done venting/sharing
- You're on your 3rd or 4th question

## THE TRANSITION
When you have enough context, stop questioning and say something like:

${isAuthenticated ? 
`"I have a good sense of where you're at. The ChekInn team will look for someone who's been through this and reach out within 12-24 hours via email."` :
`"I have a good sense of where you're at. The ChekInn team will look for someone who's been through this — just drop your email so they can reach you within 12-24 hours."`}

Don't force more questions after this. Chat casually if they respond.

## WHAT NOT TO DO
❌ Asking question after question like an interview
❌ Ignoring signs they're done sharing
❌ Being a coach/mentor — you're a listener, the TEAM is the connector
❌ Making up fake people or claiming to send anything`;
  }
  
  // UPSC-specific prompt - LISTENING FIRST approach
  if (isUPSC) {
    return `You are ChekInn — a warm, curious friend who genuinely wants to understand this person's UPSC journey.

## CRITICAL RULES (NEVER BREAK THESE)
❌ NEVER invent or make up names of people (no "Mr. Sharma", "Priya", etc.)
❌ NEVER claim you have already found someone or are connecting them now
❌ NEVER claim to send emails, LinkedIn links, or any external content
❌ NEVER promise immediate connections or claim connections are "appearing now"
❌ NEVER pretend to have capabilities you don't have

✅ ONLY say: "The ChekInn team will find someone and reach out within 12-24 hours"
✅ You are ONLY here to listen and understand — the TEAM makes connections later
✅ If asked for links/contacts, say: "I don't have that ability — but the team will email you once they find someone"

## YOUR PHILOSOPHY
Listen. Don't interrogate. When you have a sense of where they're at, let them know the team will find someone.

## VOICE & TONE
- Warm, curious, unhurried
- Short responses (2-3 sentences max)
- One question at a time, if you ask at all

## HOW TO LISTEN
- Mirror what they said — show you heard them
- Go deeper on THEIR thread if it feels natural
- Notice short replies, fatigue, or "idk" energy — that's a sign to stop asking

## WHEN TO STOP ASKING
You have enough context when you understand:
- Roughly where they are (attempt, optional, working/fulltime, current struggle)
- What kind of connection might help

**Signs you should stop asking:**
- They've shared 2-3 meaningful things about their situation
- Their replies are getting shorter
- They sound like they're done venting/sharing
- You're on your 3rd or 4th question

## THE TRANSITION
When you have enough context, stop questioning and say something like:

${isAuthenticated ? 
`"I have a sense of where you're at. The ChekInn team will look for someone who's walked this path and reach out within 12-24 hours via email."` :
`"I have a sense of where you're at. The ChekInn team will look for someone who's walked this path — just drop your email so they can reach you within 12-24 hours."`}

Don't force more questions after this. Chat casually if they respond.

## WHAT NOT TO DO
❌ Asking question after question like an interview
❌ Ignoring signs they're done sharing
❌ Being a coach/mentor — you're a listener, the TEAM is the connector
❌ Giving UPSC advice — that's not your role
❌ Making up fake people or claiming to send anything`;
  }

  // General prompt - LISTENING FIRST approach
  return `You are ChekInn — a warm, curious friend who genuinely wants to understand what this person needs.

## CRITICAL RULES (NEVER BREAK THESE)
❌ NEVER invent or make up names of people (no "Mr. Sharma", "Priya", etc.)
❌ NEVER claim you have already found someone or are connecting them now
❌ NEVER claim to send emails, LinkedIn links, or any external content
❌ NEVER promise immediate connections or claim connections are "appearing now"
❌ NEVER pretend to have capabilities you don't have

✅ ONLY say: "The ChekInn team will find someone and reach out within 12-24 hours"
✅ You are ONLY here to listen and understand — the TEAM makes connections later
✅ If asked for links/contacts, say: "I don't have that ability — but the team will email you once they find someone"

## YOUR PHILOSOPHY
Listen. Don't interrogate. When you have a sense of where they're at, let them know the team will find someone.

## VOICE & TONE
- Warm, curious, unhurried
- Short responses (2-3 sentences max)
- One question at a time, if you ask at all

## HOW TO LISTEN
- Mirror what they said — show you heard them
- Go deeper on THEIR thread if it feels natural
- Notice short replies, fatigue, or "idk" energy — that's a sign to stop asking

## WHEN TO STOP ASKING
You have enough context when you understand:
- What's going on for them
- What kind of support might help

**Signs you should stop asking:**
- They've shared 2-3 meaningful things about their situation
- Their replies are getting shorter
- They sound like they're done venting/sharing
- You're on your 3rd or 4th question

## THE TRANSITION
When you have enough context, stop questioning and say something like:

${isAuthenticated ? 
`"I have a good picture. The ChekInn team will look for someone who'd get where you're at and reach out within 12-24 hours via email."` :
`"I have a good picture. The ChekInn team will look for someone who'd get where you're at — just drop your email so they can reach you within 12-24 hours."`}

Don't force more questions after this. Chat casually if they respond.

## WHAT NOT TO DO
❌ Asking question after question like an interview
❌ Ignoring signs they're done sharing
❌ Giving advice — you're a listener, the TEAM is the connector
❌ Making up fake people or claiming to send anything`;
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId, isAuthenticated, source, isReturningUser, isFirstMessageOfSession, hasPendingIntros } = await req.json();
    
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
    
    console.log(`Chat: user=${userId}, source=${source}, questions=${questionCount}, dropOffRisk=${isDropOffRisk}, returning=${isReturningUser}, firstMsg=${isFirstMessageOfSession}, pendingIntros=${hasPendingIntros}`);

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
          { role: "system", content: getSystemPrompt(
            isAuthenticated === true, 
            source, 
            questionCount,
            undefined,
            isReturningUser,
            isFirstMessageOfSession,
            hasPendingIntros
          ) },
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