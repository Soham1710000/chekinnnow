import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { learnings, existingSummaries, chatContext, totalChats } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt
    const systemPrompt = `You are a helpful assistant that summarizes learnings from networking conversations.
Your task is to create a warm, encouraging summary of what the user has learned from their connections.
Focus on:
- Key insights and advice received
- Patterns in the conversations
- Actionable takeaways
- Personal growth moments

Keep the tone conversational, warm, and encouraging. Use "you" to address the user.
Be concise but meaningful - around 2-3 sentences for the summary.
For key learnings, extract 3-5 bullet points.`;

    const userPrompt = `Here's context from the user's connection conversations and debriefs:

Total connections debriefed: ${totalChats}

User's self-reported learnings:
${learnings.length > 0 ? learnings.join("\n- ") : "No specific learnings noted yet."}

${existingSummaries.length > 0 ? `Previous summaries:\n${existingSummaries.join("\n")}` : ""}

${chatContext ? `Recent conversation excerpts:\n${chatContext.slice(0, 2000)}` : ""}

Please provide:
1. A brief, warm summary paragraph (2-3 sentences)
2. 3-5 key takeaways as bullet points

Respond in JSON format:
{
  "summary": "Your personalized summary here...",
  "keyLearnings": ["Learning 1", "Learning 2", ...]
}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let parsed;
    try {
      // Handle potential markdown code block wrapping
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch
        ? jsonMatch[1] || jsonMatch[0]
        : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Fallback response
      parsed = {
        summary:
          "You've been making meaningful connections and learning from each conversation. Keep exploring and growing!",
        keyLearnings: [
          "Every connection brings new perspectives",
          "Sharing experiences helps everyone grow",
        ],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in summarize-learnings:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
