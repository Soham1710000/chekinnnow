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
      const prompt = `You are a signal extraction engine. Analyze this email and extract RICH, SPECIFIC signals.

EMAIL CONTENT:
Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}
Body: ${email.body}

SIGNAL TYPES:
- FLIGHT: Flight bookings, travel itineraries, boarding passes, check-in reminders
- INTERVIEW: Job interviews, screening calls, hiring process emails
- EVENT: Conferences, meetups, webinars, calendar invites
- TRANSITION: Job offers, resignations, role changes, promotions, job decisions
- OBSESSION: Repeated interest in a topic (newsletters, courses, research)

EXTRACTION RULES:
1. Only extract signals with confidence >= 0.6
2. Be conservative - if unsure, don't extract
3. Set appropriate expiration (flights: departure time, interviews: interview time, events: event time)

CRITICAL - DOMAIN FIELD REQUIREMENTS:
- For FLIGHT: Include the DESTINATION CITY (e.g., "Jaipur", "Delhi", "Mumbai"), NOT the airline name
- For INTERVIEW: Include the COMPANY NAME
- For EVENT: Include the EVENT NAME or topic
- For TRANSITION: Include what the transition is about (e.g., "job offers decision", "resignation from X")
- For OBSESSION: Include the specific TOPIC of interest

CRITICAL - EVIDENCE FIELD REQUIREMENTS:
The evidence field should be DETAILED and ACTIONABLE. Include:
- For FLIGHT: Destination, flight number, dates, booking reference, airline
- For INTERVIEW: Company, role, interview time, round (phone screen, onsite, etc.)
- For EVENT: Event name, date, location, what it's about
- For TRANSITION: Specific details about the offers/change, companies involved
- For OBSESSION: What topic, why it seems like an interest

EXAMPLES:
Flight email → domain: "Jaipur", evidence: "Air India flight AI 1719 to Jaipur on Dec 26, booking ref 8TCPQN, web check-in available"
Interview email → domain: "Stripe", evidence: "Final round interview with Stripe for Senior Engineer role, scheduled Jan 5"
Transition email → domain: "job offers - Flipkart vs Google", evidence: "User is deciding between Flipkart and Google offers, mentioned in email to mentor"

Respond with a JSON array of signals. Each signal:
{
  "type": "FLIGHT|INTERVIEW|EVENT|TRANSITION|OBSESSION",
  "domain": "specific destination/company/topic - BE SPECIFIC",
  "confidence": 0.0-1.0,
  "evidence": "DETAILED explanation with specific dates, names, and actionable context",
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

    // Store signals in database - deduplicate by gmail_message_id + type combination
    if (signals.length > 0) {
      // Keep one signal per gmail_message_id+type pair (highest confidence wins)
      const deduped = new Map<string, Signal>();
      for (const s of signals) {
        const key = `${s.gmail_message_id}:${s.type}`;
        const existing = deduped.get(key);
        if (!existing || s.confidence > existing.confidence) {
          deduped.set(key, s);
        }
      }
      const uniqueSignals = Array.from(deduped.values());

      // Upsert with a composite key approach - delete old and insert new
      for (const signal of uniqueSignals) {
        // Check if this exact signal exists
        const { data: existing } = await supabase
          .from('email_signals')
          .select('id')
          .eq('gmail_message_id', signal.gmail_message_id)
          .eq('type', signal.type)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('email_signals')
            .update({
              domain: signal.domain,
              confidence: signal.confidence,
              evidence: signal.evidence,
              expires_at: signal.expires_at,
              email_date: signal.email_date,
            })
            .eq('id', existing.id);
        } else {
          // Insert new
          const { error } = await supabase
            .from('email_signals')
            .insert({
              user_id: signal.user_id,
              type: signal.type,
              domain: signal.domain,
              confidence: signal.confidence,
              evidence: signal.evidence,
              expires_at: signal.expires_at,
              gmail_message_id: signal.gmail_message_id,
              email_date: signal.email_date,
            });

          if (error) {
            console.error('Failed to insert signal:', error);
          }
        }
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
