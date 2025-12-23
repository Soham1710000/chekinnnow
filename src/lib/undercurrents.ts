import { supabase } from "@/integrations/supabase/client";

interface UndercurrentData {
  observation: string;
  interpretation: string;
  uncertainty: string;
}

interface AccessCheckResponse {
  hasAccess: boolean;
  pendingResponse?: {
    id: string;
    undercurrent: UndercurrentData;
    prompt: string;
  };
  canReceiveNew?: boolean;
  isFirstAccess?: boolean;
  weeklyCount?: number;
}

interface UndercurrentResponse {
  undercurrent?: UndercurrentData;
  prompt?: string;
  interactionId?: string;
  message?: string;
  error?: string;
}

export async function checkUndercurrentsAccess(): Promise<AccessCheckResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('undercurrents', {
      body: { action: 'check_access' },
    });

    if (error) throw error;
    return data as AccessCheckResponse;
  } catch (error) {
    console.error('Check undercurrents access error:', error);
    return { hasAccess: false };
  }
}

export async function getUndercurrent(): Promise<UndercurrentResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('undercurrents', {
      body: { action: 'get_undercurrent' },
    });

    if (error) throw error;
    return data as UndercurrentResponse;
  } catch (error: any) {
    console.error('Get undercurrent error:', error);
    return { error: error.message || 'Failed to get undercurrent' };
  }
}

export async function submitUndercurrentResponse(
  undercurrentId: string,
  responseText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('undercurrents', {
      body: {
        action: 'submit_response',
        undercurrentId,
        responseText,
      },
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Submit undercurrent response error:', error);
    return { success: false, error: error.message };
  }
}

// Reputation engine calls (silent, never exposed to user)
export async function trackReputationAction(
  action: 'message_sent' | 'quality_response' | 'profile_complete' | 'connection_made',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.functions.invoke('reputation-engine', {
      body: {
        action,
        userId: user.id,
        metadata,
      },
    });
  } catch (error) {
    // Silent failure - reputation is hidden
    console.error('Reputation tracking error (silent):', error);
  }
}

// Evaluate P2P chat for reputation (called after debrief or chat end)
export async function evaluateP2PChat(
  introductionId: string,
  trigger: 'debrief' | 'chat_end' | 'periodic'
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.functions.invoke('evaluate-p2p-chat', {
      body: {
        introductionId,
        userId: user.id,
        trigger,
      },
    });
  } catch (error) {
    // Silent failure - reputation evaluation is hidden
    console.error('P2P evaluation error (silent):', error);
  }
}
