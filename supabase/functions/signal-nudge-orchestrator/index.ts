import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * SIGNAL-NUDGE ORCHESTRATOR
 * 
 * Full pipeline: state-derive → nudge-gating → judgment-engine → message-generate
 * 
 * Triggered for users with unprocessed signals or on schedule.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PipelineResult {
  userId: string;
  stage: string;
  success: boolean;
  stateResult?: any;
  gatingResult?: any;
  judgmentResult?: any;
  messageResult?: any;
  error?: string;
}

async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${functionName} failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function runPipeline(supabase: any, userId: string): Promise<PipelineResult> {
  const result: PipelineResult = {
    userId,
    stage: 'init',
    success: false,
  };

  try {
    // STAGE 1: State Derive
    console.log(`[orchestrator] Stage 1: state-derive for ${userId}`);
    result.stage = 'state-derive';
    
    const stateResult = await callEdgeFunction('state-derive', { userId });
    result.stateResult = stateResult;
    
    if (!stateResult.success) {
      throw new Error('state-derive failed: ' + JSON.stringify(stateResult));
    }
    
    console.log(`[orchestrator] State derived: career=${stateResult.state?.career_state}, travel=${stateResult.state?.travel_state}`);

    // STAGE 2: Nudge Gating
    console.log(`[orchestrator] Stage 2: nudge-gating for ${userId}`);
    result.stage = 'nudge-gating';
    
    const gatingResult = await callEdgeFunction('nudge-gating', { 
      userId,
      intents: stateResult.intents,
    });
    result.gatingResult = gatingResult;
    
    console.log(`[orchestrator] Gating result: should_judge=${gatingResult.should_judge}, reason=${gatingResult.trigger_reason || gatingResult.block_reason}`);
    
    if (!gatingResult.should_judge) {
      console.log(`[orchestrator] Gating blocked: ${gatingResult.block_reason}`);
      result.stage = 'gated';
      result.success = true;
      return result;
    }

    // STAGE 3: Judgment Engine
    console.log(`[orchestrator] Stage 3: judgment-engine for ${userId}`);
    result.stage = 'judgment-engine';
    
    const judgmentResult = await callEdgeFunction('judgment-engine', { 
      userId,
      intents: stateResult.intents,
    });
    result.judgmentResult = judgmentResult;
    
    console.log(`[orchestrator] Judgment result: should_message=${judgmentResult.decision?.should_message}, type=${judgmentResult.decision?.intervention_type}`);
    
    if (!judgmentResult.decision?.should_message) {
      console.log(`[orchestrator] Judgment: no message needed - ${judgmentResult.decision?.reasoning}`);
      result.stage = 'judged-silent';
      result.success = true;
      return result;
    }

    // STAGE 4: Message Generation
    console.log(`[orchestrator] Stage 4: message-generate for ${userId}`);
    result.stage = 'message-generate';
    
    // Get the actionable signal if specified
    let actionableSignal = null;
    if (judgmentResult.decision?.actionable_signal_id) {
      const { data: signal } = await supabase
        .from('signals_raw')
        .select('*')
        .eq('id', judgmentResult.decision.actionable_signal_id)
        .maybeSingle();
      actionableSignal = signal;
    }
    
    const messageResult = await callEdgeFunction('message-generate', { 
      userId,
      decision: {
        ...judgmentResult.decision,
        actionable_signal: actionableSignal,
      },
      context: {
        intents: stateResult.intents,
        state: stateResult.state,
      },
    });
    result.messageResult = messageResult;
    
    if (messageResult.message) {
      console.log(`[orchestrator] Message generated: "${messageResult.message.slice(0, 50)}..."`);
      
      // Store the generated message in chat_messages for the chat UI
      const { error: chatError } = await supabase.from('chat_messages').insert({
        user_id: userId,
        role: 'assistant',
        content: messageResult.message,
        message_type: 'nudge',
        metadata: {
          intervention_type: judgmentResult.decision?.intervention_type,
          priority: judgmentResult.decision?.priority,
          timing: judgmentResult.decision?.timing,
          generated_by: 'signal-nudge-orchestrator',
          actionable_signal_id: judgmentResult.decision?.actionable_signal_id,
        },
      });
      
      if (chatError) {
        console.error(`[orchestrator] Failed to insert chat message:`, chatError);
      } else {
        console.log(`[orchestrator] Chat message stored successfully`);
      }
      
      // Update user_state nudges count
      await supabase
        .from('user_state')
        .update({ 
          nudges_24h: (stateResult.state?.nudges_24h || 0) + 1,
          last_interaction_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      // Log interaction
      await supabase.from('interaction_log').insert({
        user_id: userId,
        interaction_type: 'message_queued',
        intent: judgmentResult.decision?.reasoning,
        metadata: {
          intervention_type: judgmentResult.decision?.intervention_type,
          priority: judgmentResult.decision?.priority,
          timing: judgmentResult.decision?.timing,
        },
      });
    } else {
      console.log(`[orchestrator] No message generated (policy violation or skip)`);
    }

    result.stage = 'complete';
    result.success = true;
    return result;

  } catch (error) {
    console.error(`[orchestrator] Pipeline failed at stage ${result.stage}:`, error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { userId, processAll } = body;

    const results: PipelineResult[] = [];

    if (userId) {
      // Single user mode
      console.log(`[orchestrator] Running pipeline for user: ${userId}`);
      const result = await runPipeline(supabase, userId);
      results.push(result);
    } else if (processAll) {
      // Batch mode: process all users with recent signals
      console.log(`[orchestrator] Batch mode: finding users with recent signals`);
      
      const { data: usersWithSignals } = await supabase
        .from('signals_raw')
        .select('user_id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
      
      const uniqueUserIds = [...new Set((usersWithSignals || []).map((s: any) => s.user_id))];
      console.log(`[orchestrator] Found ${uniqueUserIds.length} users with recent signals`);
      
      for (const uid of uniqueUserIds.slice(0, 10)) { // Limit to 10 per run
        console.log(`[orchestrator] Processing user: ${uid}`);
        const result = await runPipeline(supabase, uid as string);
        results.push(result);
        
        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      return new Response(JSON.stringify({ error: 'userId or processAll required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      messaged: results.filter(r => r.messageResult?.message).length,
      gated: results.filter(r => r.stage === 'gated').length,
      judgedSilent: results.filter(r => r.stage === 'judged-silent').length,
    };

    console.log(`[orchestrator] Complete:`, summary);

    return new Response(JSON.stringify({ 
      summary,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[orchestrator] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
