import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, duration } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log(`[voice-to-text] Processing audio, duration: ${duration}s`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI for transcription with Gemini
    // We'll send the audio as base64 and ask for transcription + translation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a speech transcription and translation assistant. 
You will receive audio content and must:
1. Transcribe the speech accurately
2. If the speech is NOT in English, translate it to English
3. Return ONLY the English text, nothing else - no explanations, no quotes, just the transcribed/translated text
4. If you cannot understand the audio, return: "[Unable to transcribe audio]"`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe and translate this audio to English. Return only the English text."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:audio/webm;base64,${audio}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[voice-to-text] AI gateway error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try text input." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const transcribedText = data.choices?.[0]?.message?.content?.trim() || "";

    console.log(`[voice-to-text] Transcription result: "${transcribedText.substring(0, 100)}..."`);

    return new Response(
      JSON.stringify({ 
        text: transcribedText,
        detected_language: "auto", // Gemini handles detection internally
        duration_seconds: duration
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error('[voice-to-text] Error:', error);
    const errorMessage = error instanceof Error ? error.message : "Transcription failed";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
