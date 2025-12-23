import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Growth rates - slow and deliberate
const IMPACT_GROWTH = 0.15;
const THOUGHT_GROWTH = 0.2;
const DISCRETION_GROWTH = 0.1;
const PULL_GROWTH = 0.25;

// Penalty rates
const DISCRETION_PENALTY = 0.3;
const THOUGHT_PENALTY = 0.15;

// Thresholds
const DISCRETION_FREEZE_THRESHOLD = 20;
const MIN_MESSAGES_FOR_EVALUATION = 5;

interface EvaluationResult {
  impactDelta: number;
  thoughtDelta: number;
  discretionDelta: number;
  pullDelta: number;
  shouldFreeze: boolean;
  reasoning: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { introductionId, userId, trigger } = await req.json();

    if (!introductionId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Evaluating P2P chat: intro=${introductionId}, user=${userId}, trigger=${trigger}`);

    // Get introduction details
    const { data: intro, error: introError } = await supabaseAdmin
      .from('introductions')
      .select('*')
      .eq('id', introductionId)
      .single();

    if (introError || !intro) {
      console.error('Introduction not found:', introError);
      return new Response(JSON.stringify({ error: 'Introduction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Identify the other party
    const otherUserId = intro.user_a_id === userId ? intro.user_b_id : intro.user_a_id;

    // Get chat messages for this introduction
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('user_chats')
      .select('*')
      .eq('introduction_id', introductionId)
      .order('created_at', { ascending: true });

    if (msgError || !messages || messages.length < MIN_MESSAGES_FOR_EVALUATION) {
      console.log(`Insufficient messages for evaluation: ${messages?.length || 0}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Insufficient data for evaluation' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's messages only
    const userMessages = messages.filter(m => m.sender_id === userId);
    const otherMessages = messages.filter(m => m.sender_id === otherUserId);

    if (userMessages.length < 2) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'User has too few messages' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get both users' reputation for context
    const { data: userRep } = await supabaseAdmin
      .from('user_reputation')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: otherRep } = await supabaseAdmin
      .from('user_reputation')
      .select('*')
      .eq('user_id', otherUserId)
      .single();

    // Check who initiated (first message sender)
    const initiator = messages[0]?.sender_id;
    const userInitiated = initiator === userId;

    // Check if this is a returning conversation (messages span multiple days)
    const firstMsgDate = new Date(messages[0].created_at);
    const lastMsgDate = new Date(messages[messages.length - 1].created_at);
    const daySpan = Math.floor((lastMsgDate.getTime() - firstMsgDate.getTime()) / (1000 * 60 * 60 * 24));
    const isReturningConversation = daySpan >= 1;

    // Get chat debrief from other user if exists
    const { data: otherDebrief } = await supabaseAdmin
      .from('chat_debriefs')
      .select('*')
      .eq('introduction_id', introductionId)
      .eq('user_id', otherUserId)
      .single();

    // Perform AI evaluation
    const evaluation = await evaluateChatQuality(
      supabaseAdmin,
      userId,
      userMessages,
      otherMessages,
      {
        userInitiated,
        isReturningConversation,
        daySpan,
        otherUserRep: otherRep ? calculateTotalScore(otherRep) : 0,
        otherDebrief,
      }
    );

    if (!evaluation) {
      console.log('AI evaluation returned null - no change');
      return new Response(JSON.stringify({ success: true, message: 'No evaluation change' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Evaluation result:', evaluation);

    // Final check: Would a thoughtful, discreet person respect this judgment?
    if (Math.abs(evaluation.impactDelta) < 0.05 && 
        Math.abs(evaluation.thoughtDelta) < 0.05 &&
        Math.abs(evaluation.discretionDelta) < 0.05 &&
        Math.abs(evaluation.pullDelta) < 0.05) {
      console.log('Changes too small - making no update');
      return new Response(JSON.stringify({ success: true, message: 'No significant change' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Apply updates to reputation (silently, never notify)
    const updates: Record<string, unknown> = {
      last_active_at: new Date().toISOString(),
    };

    if (userRep) {
      // Apply deltas with bounds
      if (evaluation.impactDelta !== 0) {
        updates.impact_score = Math.max(0, Math.min(100, 
          userRep.impact_score + evaluation.impactDelta));
      }
      if (evaluation.thoughtDelta !== 0) {
        updates.thought_quality = Math.max(0, Math.min(100, 
          userRep.thought_quality + evaluation.thoughtDelta));
      }
      if (evaluation.discretionDelta !== 0) {
        updates.discretion_score = Math.max(0, Math.min(100, 
          userRep.discretion_score + evaluation.discretionDelta));
      }
      if (evaluation.pullDelta !== 0) {
        updates.pull_score = Math.max(0, Math.min(100, 
          userRep.pull_score + evaluation.pullDelta));
      }

      // Check for discretion freeze
      const newDiscretion = updates.discretion_score ?? userRep.discretion_score;
      if (evaluation.shouldFreeze || newDiscretion < DISCRETION_FREEZE_THRESHOLD) {
        updates.frozen_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        console.log(`Freezing user ${userId} reputation due to discretion violation`);
      }

      // Check for undercurrents unlock
      const totalScore = (updates.impact_score ?? userRep.impact_score) +
                         (updates.thought_quality ?? userRep.thought_quality) +
                         (updates.discretion_score ?? userRep.discretion_score) +
                         (updates.pull_score ?? userRep.pull_score);

      if (!userRep.undercurrents_unlocked && totalScore >= 15) {
        updates.undercurrents_unlocked = true;
        updates.undercurrents_unlocked_at = new Date().toISOString();
        console.log(`User ${userId} unlocked undercurrents via P2P chat (score: ${totalScore})`);
      }

      const { error: updateError } = await supabaseAdmin
        .from('user_reputation')
        .update(updates)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update reputation:', updateError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('P2P evaluation error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculateTotalScore(rep: any): number {
  return (rep.impact_score || 0) + 
         (rep.thought_quality || 0) + 
         (rep.discretion_score || 0) + 
         (rep.pull_score || 0);
}

async function evaluateChatQuality(
  supabaseAdmin: any,
  userId: string,
  userMessages: any[],
  otherMessages: any[],
  context: {
    userInitiated: boolean;
    isReturningConversation: boolean;
    daySpan: number;
    otherUserRep: number;
    otherDebrief: any;
  }
): Promise<EvaluationResult | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    // Prepare conversation for analysis
    const userContent = userMessages.map(m => m.content).join('\n---\n');
    const otherContent = otherMessages.map(m => m.content).join('\n---\n');

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
            content: `You are evaluating a professional conversation for reputation signals. You must be extremely conservative - when unsure, return zeros.

EVALUATION CRITERIA:

1. IMPACT SCORE
Increase ONLY when:
- The other user references earlier advice in later messages
- The other user states a decision or directional action
- The other user explicitly thanks for clarity/direction
- The conversation reduced uncertainty demonstrably

Do NOT reward: verbosity, motivational language, confidence without consequence

2. THOUGHT QUALITY
Increase ONLY when:
- User reframes the problem insightfully
- User explains tradeoffs clearly
- User tailors advice to specific context
- User acknowledges uncertainty appropriately
- User thinks in second-order effects

Decrease when:
- Advice is generic
- Absolutist language ("always", "never", "definitely")
- Overconfident without nuance

3. DISCRETION SCORE
Decrease when:
- People/companies are named unnecessarily
- Speculation presented as fact
- Certainty implied where ambiguity exists
- Gossip or unverified claims

Increase when:
- Language is restrained
- Boundaries acknowledged
- Advice scoped carefully

4. PULL SCORE
Consider:
- Did the other party initiate? (signal of being sought)
- Did other party return across multiple days?
- Reputation level of initiator (higher = stronger signal)

CONTEXT:
- User initiated: ${context.userInitiated}
- Returning conversation (multi-day): ${context.isReturningConversation} (${context.daySpan} days)
- Other party's reputation score: ${context.otherUserRep}
- Other party's debrief: ${context.otherDebrief ? `Rating: ${context.otherDebrief.rating}, Would chat again: ${context.otherDebrief.would_chat_again}` : 'Not submitted'}

RESPONSE FORMAT (JSON only):
{
  "impactDelta": number (-1 to 1, usually 0 to 0.2),
  "thoughtDelta": number (-1 to 1, usually 0 to 0.2),
  "discretionDelta": number (-1 to 1, usually 0 to 0.1),
  "pullDelta": number (-1 to 1, usually 0 to 0.3),
  "shouldFreeze": boolean (true only for serious discretion violations),
  "reasoning": "brief explanation"
}

CRITICAL RULES:
1. Reputation grows SLOWLY - most deltas should be 0 to 0.2
2. When unsure, return all zeros
3. Silence is NOT a penalty
4. Never optimize for engagement
5. Final check: Would a thoughtful, discreet person respect this judgment?`
          },
          {
            role: 'user',
            content: `Evaluate this user's messages in the conversation.

USER'S MESSAGES:
${userContent.slice(0, 3000)}

OTHER PARTY'S MESSAGES (for context):
${otherContent.slice(0, 2000)}

Return JSON evaluation. Be conservative.`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('AI evaluation failed:', await response.text());
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) return null;

    // Parse JSON
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content];
      const jsonStr = jsonMatch[1] || content;
      const parsed = JSON.parse(jsonStr.trim());

      // Clamp values
      return {
        impactDelta: Math.max(-1, Math.min(1, parsed.impactDelta || 0)) * IMPACT_GROWTH,
        thoughtDelta: Math.max(-1, Math.min(1, parsed.thoughtDelta || 0)) * THOUGHT_GROWTH,
        discretionDelta: Math.max(-1, Math.min(1, parsed.discretionDelta || 0)) * 
          (parsed.discretionDelta < 0 ? DISCRETION_PENALTY : DISCRETION_GROWTH),
        pullDelta: Math.max(-1, Math.min(1, parsed.pullDelta || 0)) * PULL_GROWTH,
        shouldFreeze: Boolean(parsed.shouldFreeze),
        reasoning: parsed.reasoning || '',
      };
    } catch (e) {
      console.error('Failed to parse evaluation JSON:', content);
      return null;
    }

  } catch (error) {
    console.error('Evaluation error:', error);
    return null;
  }
}