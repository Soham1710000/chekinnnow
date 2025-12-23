import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reputation thresholds (never exposed)
const UNDERCURRENTS_UNLOCK_THRESHOLD = 15; // Total score needed to unlock
const DECAY_RATE = 0.02; // 2% decay per day of inactivity
const GROWTH_RATE = 0.1; // Small incremental growth per quality action

interface ReputationUpdate {
  action: 'message_sent' | 'quality_response' | 'profile_complete' | 'connection_made' | 'decay_check' | 'misuse';
  userId: string;
  metadata?: Record<string, unknown>;
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

    const { action, userId, metadata } = await req.json() as ReputationUpdate;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get current reputation
    let { data: reputation, error: fetchError } = await supabaseAdmin
      .from('user_reputation')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Initialize if doesn't exist
    if (!reputation) {
      const { data: newRep, error: insertError } = await supabaseAdmin
        .from('user_reputation')
        .insert({ user_id: userId })
        .select()
        .single();
      
      if (insertError) throw insertError;
      reputation = newRep;
    }

    // Check if frozen
    const now = new Date();
    if (reputation.frozen_until && new Date(reputation.frozen_until) > now) {
      console.log(`User ${userId} reputation frozen until ${reputation.frozen_until}`);
      return new Response(JSON.stringify({ success: true, frozen: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let updates: Record<string, unknown> = {
      last_active_at: now.toISOString(),
    };

    // Apply action-specific updates
    switch (action) {
      case 'message_sent':
        // Small impact growth for engagement
        updates.impact_score = Math.min(100, reputation.impact_score + GROWTH_RATE);
        break;

      case 'quality_response':
        // Larger thought quality bump for thoughtful undercurrent responses
        const qualityBoost = metadata?.quality_score ? (metadata.quality_score as number) * 0.5 : 0.3;
        updates.thought_quality = Math.min(100, reputation.thought_quality + qualityBoost);
        updates.discretion_score = Math.min(100, reputation.discretion_score + GROWTH_RATE);
        break;

      case 'profile_complete':
        // One-time boost for completing profile
        updates.pull_score = Math.min(100, reputation.pull_score + 2);
        break;

      case 'connection_made':
        // Growth for successful connections
        updates.pull_score = Math.min(100, reputation.pull_score + GROWTH_RATE * 2);
        updates.impact_score = Math.min(100, reputation.impact_score + GROWTH_RATE);
        break;

      case 'decay_check':
        // Apply decay if inactive
        const lastActive = new Date(reputation.last_active_at);
        const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceActive > 3) { // Start decay after 3 days
          const decayMultiplier = Math.min(daysSinceActive - 3, 30) * DECAY_RATE; // Cap at 30 days decay
          updates.impact_score = Math.max(0, reputation.impact_score * (1 - decayMultiplier));
          updates.pull_score = Math.max(0, reputation.pull_score * (1 - decayMultiplier));
          // Thought quality and discretion decay slower
          updates.thought_quality = Math.max(0, reputation.thought_quality * (1 - decayMultiplier * 0.5));
          updates.discretion_score = Math.max(0, reputation.discretion_score * (1 - decayMultiplier * 0.5));
        }
        break;

      case 'misuse':
        // Freeze reputation for 7 days, don't drop
        updates.frozen_until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        console.log(`User ${userId} reputation frozen for misuse`);
        break;
    }

    // Calculate total score for unlock check
    const totalScore = (updates.impact_score ?? reputation.impact_score) +
                       (updates.thought_quality ?? reputation.thought_quality) +
                       (updates.discretion_score ?? reputation.discretion_score) +
                       (updates.pull_score ?? reputation.pull_score);

    // Check for undercurrents unlock (quiet, no notification)
    if (!reputation.undercurrents_unlocked && totalScore >= UNDERCURRENTS_UNLOCK_THRESHOLD) {
      updates.undercurrents_unlocked = true;
      updates.undercurrents_unlocked_at = now.toISOString();
      console.log(`User ${userId} unlocked undercurrents (score: ${totalScore})`);
    }

    // Update reputation
    const { error: updateError } = await supabaseAdmin
      .from('user_reputation')
      .update(updates)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reputation engine error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
