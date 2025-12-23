import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESPONSE_PROMPTS = [
  "What would invalidate this?",
  "Why would most people misread this?",
  "What is the second-order effect if this is true?",
  "What assumption does this rest on?",
  "Who benefits if this is wrong?",
  "What would be the first sign this is shifting?",
];

const MAX_UNDERCURRENTS_PER_WEEK = 2;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, undercurrentId, responseText } = await req.json();
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    switch (action) {
      case 'check_access': {
        // Check if user has unlocked undercurrents
        const { data: reputation } = await supabaseAdmin
          .from('user_reputation')
          .select('undercurrents_unlocked, undercurrents_unlocked_at')
          .eq('user_id', user.id)
          .single();

        if (!reputation?.undercurrents_unlocked) {
          return new Response(JSON.stringify({ hasAccess: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check for pending response requirement
        const { data: pendingInteraction } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .select('*, undercurrents(*)')
          .eq('user_id', user.id)
          .is('response_text', null)
          .order('viewed_at', { ascending: false })
          .limit(1)
          .single();

        if (pendingInteraction) {
          return new Response(JSON.stringify({
            hasAccess: true,
            pendingResponse: {
              id: pendingInteraction.id,
              undercurrent: {
                observation: pendingInteraction.undercurrents.observation,
                interpretation: pendingInteraction.undercurrents.interpretation,
                uncertainty: pendingInteraction.undercurrents.uncertainty_clause,
              },
              prompt: pendingInteraction.response_prompt,
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check weekly limit
        const { count } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('week_number', weekNumber)
          .eq('year', year);

        const canReceiveNew = (count || 0) < MAX_UNDERCURRENTS_PER_WEEK;

        // Check if first time accessing
        const isFirstAccess = reputation.undercurrents_unlocked_at && 
          !pendingInteraction && 
          (count || 0) === 0;

        return new Response(JSON.stringify({
          hasAccess: true,
          canReceiveNew,
          isFirstAccess,
          weeklyCount: count || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_undercurrent': {
        // Verify access and limits
        const { data: reputation } = await supabaseAdmin
          .from('user_reputation')
          .select('undercurrents_unlocked')
          .eq('user_id', user.id)
          .single();

        if (!reputation?.undercurrents_unlocked) {
          return new Response(JSON.stringify({ error: 'Access not unlocked' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check for pending response
        const { data: pending } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .select('id')
          .eq('user_id', user.id)
          .is('response_text', null)
          .limit(1);

        if (pending && pending.length > 0) {
          return new Response(JSON.stringify({ error: 'Respond to current first' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check weekly limit
        const { count } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('week_number', weekNumber)
          .eq('year', year);

        if ((count || 0) >= MAX_UNDERCURRENTS_PER_WEEK) {
          return new Response(JSON.stringify({ error: 'Weekly limit reached' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Generate new undercurrent using AI
        const undercurrent = await generateUndercurrent(supabaseAdmin, user.id);
        
        if (!undercurrent) {
          return new Response(JSON.stringify({ 
            message: 'Nothing to surface right now.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Select random prompt
        const prompt = RESPONSE_PROMPTS[Math.floor(Math.random() * RESPONSE_PROMPTS.length)];

        // Create interaction record
        const { data: interaction, error: interactionError } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .insert({
            user_id: user.id,
            undercurrent_id: undercurrent.id,
            response_prompt: prompt,
            week_number: weekNumber,
            year: year,
          })
          .select()
          .single();

        if (interactionError) throw interactionError;

        return new Response(JSON.stringify({
          undercurrent: {
            observation: undercurrent.observation,
            interpretation: undercurrent.interpretation,
            uncertainty: undercurrent.uncertainty_clause,
          },
          prompt,
          interactionId: interaction.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'submit_response': {
        if (!undercurrentId || !responseText) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update interaction
        const { error: updateError } = await supabaseAdmin
          .from('user_undercurrent_interactions')
          .update({
            response_text: responseText,
            responded_at: now.toISOString(),
          })
          .eq('id', undercurrentId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Evaluate response quality in background (affects reputation silently)
        evaluateResponseQuality(supabaseAdmin, user.id, undercurrentId, responseText);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Undercurrents error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function generateUndercurrent(supabaseAdmin: any, userId: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    // Get some conversation context (anonymized themes)
    const { data: messages } = await supabaseAdmin
      .from('chat_messages')
      .select('content, role')
      .order('created_at', { ascending: false })
      .limit(50);

    const conversationThemes = messages
      ?.filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
      .slice(0, 10)
      .join(' | ') || '';

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an observer of quiet belief shifts forming across trusted conversations.
You do NOT inform, excite, persuade, or speculate loudly.

Generate ONE undercurrent with this exact structure:
1. OBSERVATION (1-2 lines): A pattern you've noticed
2. INTERPRETATION (2-3 lines): What this might suggest
3. UNCERTAINTY (1 line): An acknowledgment of what remains unknown

RULES:
- NO names, sources, timelines, or certainty
- Frame as observations with unresolved edges
- Max 80 words TOTAL
- Tone: calm, discreet, non-urgent

Respond in JSON format:
{
  "observation": "...",
  "interpretation": "...",
  "uncertainty": "..."
}`
          },
          {
            role: 'user',
            content: `Based on these anonymized conversation themes from professional networks, surface a quiet belief shift:

Themes: ${conversationThemes || 'general professional networking and career discussions'}

Generate an undercurrent. Remember: no names, no certainty, under 80 words total.`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('AI generation failed:', await response.text());
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) return null;

    // Parse JSON from response
    let parsed;
    try {
      // Handle markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse undercurrent JSON:', content);
      return null;
    }

    // Store the undercurrent
    const { data: undercurrent, error } = await supabaseAdmin
      .from('undercurrents')
      .insert({
        observation: parsed.observation,
        interpretation: parsed.interpretation,
        uncertainty_clause: parsed.uncertainty,
      })
      .select()
      .single();

    if (error) throw error;
    return undercurrent;

  } catch (error) {
    console.error('Generate undercurrent error:', error);
    return null;
  }
}

async function evaluateResponseQuality(
  supabaseAdmin: any, 
  userId: string, 
  interactionId: string, 
  responseText: string
) {
  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return;

    // Get the prompt that was asked
    const { data: interaction } = await supabaseAdmin
      .from('user_undercurrent_interactions')
      .select('response_prompt')
      .eq('id', interactionId)
      .single();

    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You evaluate the quality of analytical responses. Score from 0-10.
Consider: depth of thinking, nuance, counter-arguments, second-order effects.
Respond with just a number 0-10.`
          },
          {
            role: 'user',
            content: `Prompt: "${interaction?.response_prompt}"
Response: "${responseText}"

Score (0-10):`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const scoreStr = result.choices?.[0]?.message?.content?.trim();
    const score = parseFloat(scoreStr) || 5;

    // Update reputation silently
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/reputation-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        action: 'quality_response',
        userId,
        metadata: { quality_score: score / 10 },
      }),
    });

    // Mark as evaluated
    await supabaseAdmin
      .from('user_undercurrent_interactions')
      .update({ response_evaluated: true })
      .eq('id', interactionId);

  } catch (error) {
    console.error('Evaluate response error:', error);
  }
}
