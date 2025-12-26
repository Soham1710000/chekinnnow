import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signal {
  user_id: string;
  type: 'FLIGHT' | 'INTERVIEW' | 'EVENT' | 'TRANSITION' | 'OBSESSION';
  domain: string;
  confidence: number;
  evidence: string;
  expires_at: string | null;
  gmail_message_id: string;
  email_date: string;
}

// Parse RFC 2822 date format to ISO 8601
function parseEmailDate(dateStr: string): string {
  try {
    // Try parsing as-is first (might be ISO already)
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    // Return current time as fallback
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emails, userId } = await req.json();
    
    if (!emails || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing emails or userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const signals: Signal[] = [];

    // Process emails in batches to avoid rate limits
    for (const email of emails) {
      const prompt = `You are a signal extraction engine. Analyze this email and extract structured signals.

EMAIL CONTENT:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

SIGNAL TYPES:
- FLIGHT: Flight bookings, travel itineraries, boarding passes
- INTERVIEW: Job interviews, screening calls, hiring process emails
- EVENT: Conferences, meetups, webinars, calendar invites
- TRANSITION: Job offers, resignations, role changes, promotions
- OBSESSION: Repeated interest in a topic (newsletters, courses, research)

RULES:
1. Only extract signals with confidence >= 0.6
2. Be conservative - if unsure, don't extract
3. Set appropriate expiration (flights: departure time, interviews: interview time, events: event time)
4. For OBSESSION, look for patterns (this is a single email, so only if very clear interest)

Respond with a JSON array of signals. Each signal:
{
  "type": "FLIGHT|INTERVIEW|EVENT|TRANSITION|OBSESSION",
  "domain": "company or topic domain",
  "confidence": 0.0-1.0,
  "evidence": "brief explanation why this is a signal",
  "expires_at": "ISO timestamp or null"
}

If no signals found, return empty array [].
Return ONLY valid JSON, no other text.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a precise signal extraction engine. Always respond with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('Rate limited, waiting before retry...');
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        console.error('AI gateway error:', response.status);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        
        const extractedSignals = JSON.parse(cleanContent);
        
        for (const signal of extractedSignals) {
          if (signal.confidence >= 0.6) {
            signals.push({
              user_id: userId,
              type: signal.type,
              domain: signal.domain || 'unknown',
              confidence: signal.confidence,
              evidence: signal.evidence || '',
              expires_at: signal.expires_at ? parseEmailDate(signal.expires_at) : null,
              gmail_message_id: email.messageId,
              email_date: parseEmailDate(email.date),
            });
          }
        }
      } catch (parseError) {
        console.error('Failed to parse signal extraction response:', parseError);
      }
    }

    // Store signals in database - deduplicate by gmail_message_id first
    if (signals.length > 0) {
      // Keep only one signal per gmail_message_id (the one with highest confidence)
      const deduped = new Map<string, Signal>();
      for (const s of signals) {
        const existing = deduped.get(s.gmail_message_id);
        if (!existing || s.confidence > existing.confidence) {
          deduped.set(s.gmail_message_id, s);
        }
      }
      const uniqueSignals = Array.from(deduped.values());

      const { error } = await supabase
        .from('email_signals')
        .upsert(
          uniqueSignals.map(s => ({
            user_id: s.user_id,
            type: s.type,
            domain: s.domain,
            confidence: s.confidence,
            evidence: s.evidence,
            expires_at: s.expires_at,
            gmail_message_id: s.gmail_message_id,
            email_date: s.email_date,
          })),
          { onConflict: 'gmail_message_id' }
        );

      if (error) {
        console.error('Failed to store signals:', error);
        throw error;
      }
      
      console.log(`Stored ${uniqueSignals.length} unique signals (from ${signals.length} total)`);
    }

    console.log(`Extracted ${signals.length} signals for user ${userId}`);

    return new Response(
      JSON.stringify({ signals: signals.length, extracted: signals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Signal extraction error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
