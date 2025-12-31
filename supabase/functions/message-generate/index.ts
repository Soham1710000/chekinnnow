import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYERS 6-7: PROMPT POLICY + MESSAGE GENERATION
 * Model: GPT-4o-mini ($0.15/1M tokens)
 * 
 * Layer 6: Convert decision → structured prompt constraints
 * Layer 7: Use LLM to craft message within strict policy constraints
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

interface Decision {
  should_message: boolean;
  timing: string;
  intervention_type: string | null;
  priority: string;
  context_needed: string[];
  reasoning: string;
  actionable_signal?: any;
}

interface UserState {
  trust_level: number;
  fatigue_score: number;
  travel_destination?: string;
  next_event_name?: string;
}

interface PromptPolicy {
  tone: 'formal' | 'casual' | 'urgent' | 'friendly';
  max_sentences: number;
  must_include: string[];
  must_avoid: string[];
  call_to_action: string | null;
  personalization_level: 'high' | 'medium' | 'low';
  show_evidence: boolean;
}

// ===== LAYER 6: PROMPT POLICY =====
function compilePromptPolicy(decision: Decision, state: UserState): PromptPolicy {
  const basePolicies: Record<string, Partial<PromptPolicy>> = {
    prepare: {
      tone: 'friendly',
      max_sentences: 6,
      must_include: ['specific_prep_item'],
      must_avoid: ['generic_advice', 'overwhelming_info'],
      call_to_action: 'review_material',
      show_evidence: true,
    },
    connect: {
      tone: 'casual',
      max_sentences: 6,
      must_include: ['connection_name', 'relevance'],
      must_avoid: ['pushy_language', 'spam_feel'],
      call_to_action: 'view_profile',
      show_evidence: false,
    },
    discover: {
      tone: 'friendly',
      max_sentences: 6,
      must_include: ['discovery_hook'],
      must_avoid: ['fomo', 'pressure'],
      call_to_action: null,
      show_evidence: false,
    },
    alert: {
      tone: 'urgent',
      max_sentences: 4,
      must_include: ['time_sensitivity'],
      must_avoid: ['anxiety_inducing'],
      call_to_action: 'acknowledge',
      show_evidence: true,
    },
    remind: {
      tone: 'casual',
      max_sentences: 4,
      must_include: ['gentle_nudge'],
      must_avoid: ['guilt', 'judgment'],
      call_to_action: null,
      show_evidence: false,
    },
  };

  const basePolicy = basePolicies[decision.intervention_type || 'remind'] || basePolicies.remind;

  let personalization_level: 'high' | 'medium' | 'low' = 'medium';
  if (state.trust_level >= 2) {
    personalization_level = 'high';
  } else if (state.trust_level === 0) {
    personalization_level = 'low';
  }

  let tone = basePolicy.tone || 'friendly';
  if (decision.priority === 'critical' && tone !== 'urgent') {
    tone = 'urgent';
  }

  let max_sentences = basePolicy.max_sentences || 3;
  if (state.fatigue_score > 20) {
    max_sentences = Math.max(1, max_sentences - 1);
  }

  return {
    tone: tone as 'formal' | 'casual' | 'urgent' | 'friendly',
    max_sentences,
    must_include: basePolicy.must_include || [],
    must_avoid: basePolicy.must_avoid || [],
    call_to_action: basePolicy.call_to_action || null,
    personalization_level,
    show_evidence: basePolicy.show_evidence || false,
  };
}

// ===== LAYER 7: MESSAGE GENERATION =====
function buildSystemPrompt(policy: PromptPolicy): string {
  return `You are a personal AI assistant that surfaces timely, relevant information to help users navigate important life moments.

CRITICAL CONSTRAINTS:
- Tone: ${policy.tone}
- Maximum ${policy.max_sentences} sentences (HARD LIMIT)
- Must include: ${policy.must_include.join(', ') || 'none specified'}
- NEVER use: ${policy.must_avoid.join(', ') || 'none specified'}
${policy.call_to_action ? `- End with: ${policy.call_to_action}` : '- No call-to-action needed'}
- Personalization: ${policy.personalization_level}

TONE GUIDELINES:
- formal: Professional, respectful, clear
- casual: Friendly, conversational, natural
- urgent: Direct, time-focused, action-oriented (but not alarming)
- friendly: Warm, supportive, personal

PERSONALIZATION LEVELS:
- high: Use user's context, reference specific details, conversational
- medium: Some context, but keep it professional
- low: Generic, informative, minimal personal reference

BANNED PHRASES (NEVER USE):
- "Just wanted to..."
- "I hope this message finds you well"
- "Don't miss out"
- "Act now"
- "You should really..."
- "Congratulations on..."
- "Exciting news!"
- Any emoji

OUTPUT REQUIREMENTS:
- Plain text only, no markdown, no formatting
- Start directly with the relevant information
- Be specific, not vague
- If showing evidence, weave it naturally into the message
- If no good message can be generated within constraints, output: SKIP

Remember: Silence is better than a mediocre message.`;
}

function buildUserPrompt(decision: Decision, context: any): string {
  let prompt = `SITUATION: ${decision.reasoning}

INTERVENTION TYPE: ${decision.intervention_type}

`;

  if (decision.actionable_signal) {
    prompt += `ACTIONABLE SIGNAL:
- Category: ${decision.actionable_signal.category}
- Type: ${decision.actionable_signal.type}
- Evidence: ${decision.actionable_signal.evidence}
- Metadata: ${JSON.stringify(decision.actionable_signal.metadata || {})}

`;
  }

  if (context) {
    prompt += `ADDITIONAL CONTEXT:
${JSON.stringify(context, null, 2)}

`;
  }

  prompt += `Craft a message for the user based on this situation. Remember your constraints.`;

  return prompt;
}

function validateMessage(message: string, policy: PromptPolicy): { valid: boolean; reason?: string } {
  if (message === 'SKIP' || message.trim() === '') {
    return { valid: false, reason: 'AI chose to skip' };
  }

  // Check sentence count
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > policy.max_sentences) {
    return { valid: false, reason: `Too many sentences: ${sentences.length} > ${policy.max_sentences}` };
  }

  // Check for banned phrases
  const bannedPhrases = [
    'just wanted to',
    'hope this message finds you',
    "don't miss out",
    'act now',
    'you should really',
    'congratulations on',
    'exciting news',
  ];
  
  const messageLower = message.toLowerCase();
  for (const banned of bannedPhrases) {
    if (messageLower.includes(banned)) {
      return { valid: false, reason: `Contains banned phrase: ${banned}` };
    }
  }

  return { valid: true };
}

async function generateMessage(
  decision: Decision,
  policy: PromptPolicy,
  context: any
): Promise<string | null> {
  if (!decision.should_message) {
    return null;
  }

  const systemPrompt = buildSystemPrompt(policy);
  const userPrompt = buildUserPrompt(decision, context);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[message-generate] OpenAI API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || '';

    const validation = validateMessage(message, policy);
    if (!validation.valid) {
      console.warn('[message-generate] Message validation failed:', validation.reason);
      return null;
    }

    console.log('[message-generate] Generated message using gpt-4o-mini');
    return message;
  } catch (e) {
    console.error('[message-generate] Error:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { userId, decision, context } = body;

    if (!userId || !decision) {
      return new Response(JSON.stringify({ error: 'userId and decision required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user state for policy compilation
    const { data: state } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!decision.should_message) {
      return new Response(JSON.stringify({ 
        message: null,
        reason: 'Decision indicated no message needed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compile prompt policy
    const policy = compilePromptPolicy(decision, state || { trust_level: 0, fatigue_score: 0 });
    console.log('[message-generate] Policy:', policy);

    // Generate message
    const message = await generateMessage(decision, policy, context);

    if (message) {
      // Log interaction
      await supabase.from('interaction_log').insert({
        user_id: userId,
        interaction_type: 'nudge_sent',
        intent: decision.reasoning,
        metadata: {
          intervention_type: decision.intervention_type,
          priority: decision.priority,
          model: 'gpt-4o-mini',
        },
      });
    }

    console.log('[message-generate] Generated message:', message?.slice(0, 100) || 'null');

    return new Response(JSON.stringify({ 
      message,
      policy: {
        tone: policy.tone,
        max_sentences: policy.max_sentences,
        personalization: policy.personalization_level,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[message-generate] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
