import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * LAYER 8: CHAT ORCHESTRATION
 * 
 * Purpose: Tie everything together - the main chat endpoint
 * 
 * Flow:
 * 1. Fetch recent signals
 * 2. Infer intents (ephemeral)
 * 3. Get/update state
 * 4. Judge whether to intervene
 * 5. If intervention needed, generate message
 * 6. Handle user queries
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

interface Signal {
  id: string;
  user_id: string;
  user_story: string;
  category: string;
  type: string;
  subtype: string;
  confidence: string;
  evidence: string;
  metadata: any;
  occurred_at: string;
}

interface UserState {
  user_id: string;
  career_state: string;
  travel_state: string;
  travel_destination: string;
  event_state: string;
  next_event_name: string;
  trust_level: number;
  fatigue_score: number;
}

// Build context for AI response
function buildChatContext(signals: Signal[], state: UserState | null): string {
  let context = '';
  
  if (state) {
    if (state.career_state !== 'IDLE') {
      context += `User is in ${state.career_state} mode for their career. `;
    }
    if (state.travel_state !== 'NONE' && state.travel_destination) {
      context += `User has travel to ${state.travel_destination} (${state.travel_state}). `;
    }
    if (state.event_state !== 'NONE' && state.next_event_name) {
      context += `User has event: ${state.next_event_name} (${state.event_state}). `;
    }
  }
  
  // Add recent signals as context
  const relevantSignals = signals.slice(0, 5);
  if (relevantSignals.length > 0) {
    context += '\n\nRecent signals:\n';
    for (const sig of relevantSignals) {
      const metadata = sig.metadata || {};
      const details = [
        metadata.destination,
        metadata.company,
        metadata.event_name,
        metadata.airline,
      ].filter(Boolean).join(', ');
      
      context += `- ${sig.user_story} (${sig.category}/${sig.subtype})${details ? `: ${details}` : ''}\n`;
      if (sig.evidence) {
        context += `  Evidence: "${sig.evidence.slice(0, 100)}..."\n`;
      }
    }
  }
  
  return context;
}

async function handleUserQuery(
  supabase: any,
  userId: string,
  userMessage: string,
  signals: Signal[],
  state: UserState | null
): Promise<ReadableStream> {
  const context = buildChatContext(signals, state);
  
  const systemPrompt = `You are a helpful personal assistant with context about the user's life.

USER CONTEXT:
${context || 'No specific context available.'}

PERSONALITY:
- Be helpful, warm, and concise
- Reference the user's context when relevant
- If you know about their travel, career, or events, mention it naturally
- Don't be creepy or overly intrusive
- Keep responses focused and actionable

RULES:
- If asked about travel, reference their destination from signals
- If asked about career/interviews, reference their career state
- If you don't have relevant context, just be helpful
- Never invent information - only use what you have`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('AI API error: ' + await response.text());
  }

  // Store user message
  await supabase.from('chat_messages').insert({
    user_id: userId,
    role: 'user',
    content: userMessage,
  });

  // Log interaction
  await supabase.from('interaction_log').insert({
    user_id: userId,
    interaction_type: 'user_responded',
    intent: 'user_query',
    metadata: { message_preview: userMessage.slice(0, 100) },
  });

  return response.body!;
}

async function getProactiveMessage(supabase: any, userId: string): Promise<{ message: string | null; decision: any }> {
  // Call judgment engine
  const judgmentResponse = await fetch(`${SUPABASE_URL}/functions/v1/judgment-engine`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  if (!judgmentResponse.ok) {
    console.error('[chat-orchestrator] Judgment engine failed');
    return { message: null, decision: null };
  }

  const { decision } = await judgmentResponse.json();

  if (!decision?.should_message) {
    return { message: null, decision };
  }

  // Call message generator
  const messageResponse = await fetch(`${SUPABASE_URL}/functions/v1/message-generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, decision }),
  });

  if (!messageResponse.ok) {
    console.error('[chat-orchestrator] Message generation failed');
    return { message: null, decision };
  }

  const { message } = await messageResponse.json();
  return { message, decision };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get auth user if available
    const authHeader = req.headers.get('Authorization');
    let authUserId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      authUserId = user?.id || null;
    }

    const body = await req.json().catch(() => ({}));
    const { userId, message: userMessage, action } = body;

    const effectiveUserId = userId || authUserId;

    if (!effectiveUserId) {
      return new Response(JSON.stringify({ error: 'userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map auth user to chekinn user
    let chekinnUserId = effectiveUserId;
    const { data: chekinnUser } = await supabase
      .from('chekinn_users')
      .select('id')
      .eq('id', effectiveUserId)
      .maybeSingle();
    
    if (!chekinnUser) {
      // Try to find by email
      const { data: { user } } = await supabase.auth.admin.getUserById(effectiveUserId);
      if (user?.email) {
        const { data: byEmail } = await supabase
          .from('chekinn_users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (byEmail) {
          chekinnUserId = byEmail.id;
        }
      }
    }

    // Fetch recent signals
    const { data: signals } = await supabase
      .from('signals_raw')
      .select('*')
      .eq('user_id', chekinnUserId)
      .gte('occurred_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(20);

    const allSignals = (signals || []) as Signal[];

    // Fetch user state
    const { data: state } = await supabase
      .from('user_state')
      .select('*')
      .eq('user_id', chekinnUserId)
      .maybeSingle();

    // Handle different actions
    if (action === 'check_proactive') {
      // Just check if there's a proactive message to send
      const { message, decision } = await getProactiveMessage(supabase, chekinnUserId);
      
      return new Response(JSON.stringify({ 
        proactive_message: message,
        decision: decision ? {
          intervention_type: decision.intervention_type,
          priority: decision.priority,
          reasoning: decision.reasoning,
        } : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (userMessage) {
      // Handle user query with streaming
      const stream = await handleUserQuery(supabase, chekinnUserId, userMessage, allSignals, state);
      
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Default: return current context
    return new Response(JSON.stringify({ 
      signals_count: allSignals.length,
      state: state ? {
        career_state: state.career_state,
        travel_state: state.travel_state,
        travel_destination: state.travel_destination,
        event_state: state.event_state,
        trust_level: state.trust_level,
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[chat-orchestrator] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
