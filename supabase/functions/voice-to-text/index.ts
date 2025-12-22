import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

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

    console.log(`[voice-to-text] Processing audio with OpenAI Whisper, duration: ${duration}s`);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Process audio in chunks to prevent memory issues
    const binaryAudio = processBase64Chunks(audio);
    
    // Prepare form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    // Enable automatic language detection and translation to English
    formData.append('response_format', 'verbose_json');

    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[voice-to-text] OpenAI API error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const transcribedText = result.text || "";
    const detectedLanguage = result.language || "unknown";

    console.log(`[voice-to-text] Transcription successful. Language: ${detectedLanguage}, Text: "${transcribedText.substring(0, 100)}..."`);

    // If non-English, translate using OpenAI translations endpoint
    let finalText = transcribedText;
    if (detectedLanguage !== "english" && detectedLanguage !== "en") {
      console.log(`[voice-to-text] Detected non-English (${detectedLanguage}), translating...`);
      
      const translationFormData = new FormData();
      translationFormData.append('file', blob, 'audio.webm');
      translationFormData.append('model', 'whisper-1');
      
      const translationResponse = await fetch('https://api.openai.com/v1/audio/translations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: translationFormData,
      });
      
      if (translationResponse.ok) {
        const translationResult = await translationResponse.json();
        finalText = translationResult.text || transcribedText;
        console.log(`[voice-to-text] Translation successful: "${finalText.substring(0, 100)}..."`);
      }
    }

    return new Response(
      JSON.stringify({ 
        text: finalText,
        original_text: transcribedText,
        detected_language: detectedLanguage,
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
