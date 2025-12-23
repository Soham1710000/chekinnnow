import { useState, useEffect, useCallback } from 'react';
import { checkUndercurrentsAccess, getUndercurrent, submitUndercurrentResponse } from '@/lib/undercurrents';

interface Undercurrent {
  observation: string;
  interpretation: string;
  uncertainty: string;
}

interface PendingResponse {
  id: string;
  undercurrent: Undercurrent;
  prompt: string;
}

interface UseUndercurrentsReturn {
  hasAccess: boolean;
  isFirstAccess: boolean;
  currentUndercurrent: Undercurrent | null;
  currentPrompt: string | null;
  currentInteractionId: string | null;
  isLoading: boolean;
  canReceiveNew: boolean;
  weeklyCount: number;
  fetchNewUndercurrent: () => Promise<void>;
  submitResponse: (response: string) => Promise<boolean>;
  dismissFirstAccess: () => void;
}

export function useUndercurrents(): UseUndercurrentsReturn {
  const [hasAccess, setHasAccess] = useState(false);
  const [isFirstAccess, setIsFirstAccess] = useState(false);
  const [currentUndercurrent, setCurrentUndercurrent] = useState<Undercurrent | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [currentInteractionId, setCurrentInteractionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canReceiveNew, setCanReceiveNew] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);

  const checkAccess = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await checkUndercurrentsAccess();
      setHasAccess(result.hasAccess);
      setIsFirstAccess(result.isFirstAccess || false);
      setCanReceiveNew(result.canReceiveNew || false);
      setWeeklyCount(result.weeklyCount || 0);

      if (result.pendingResponse) {
        setCurrentUndercurrent(result.pendingResponse.undercurrent);
        setCurrentPrompt(result.pendingResponse.prompt);
        setCurrentInteractionId(result.pendingResponse.id);
      }
    } catch (error) {
      console.error('Check access error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const fetchNewUndercurrent = useCallback(async () => {
    if (!hasAccess || !canReceiveNew) return;

    setIsLoading(true);
    try {
      const result = await getUndercurrent();
      
      if (result.undercurrent) {
        setCurrentUndercurrent(result.undercurrent);
        setCurrentPrompt(result.prompt || null);
        setCurrentInteractionId(result.interactionId || null);
        setCanReceiveNew(false);
        setWeeklyCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Fetch undercurrent error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasAccess, canReceiveNew]);

  const submitResponse = useCallback(async (response: string): Promise<boolean> => {
    if (!currentInteractionId) return false;

    try {
      const result = await submitUndercurrentResponse(currentInteractionId, response);
      if (result.success) {
        setCurrentUndercurrent(null);
        setCurrentPrompt(null);
        setCurrentInteractionId(null);
        // Refresh access state
        await checkAccess();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Submit response error:', error);
      return false;
    }
  }, [currentInteractionId, checkAccess]);

  const dismissFirstAccess = useCallback(() => {
    setIsFirstAccess(false);
  }, []);

  return {
    hasAccess,
    isFirstAccess,
    currentUndercurrent,
    currentPrompt,
    currentInteractionId,
    isLoading,
    canReceiveNew,
    weeklyCount,
    fetchNewUndercurrent,
    submitResponse,
    dismissFirstAccess,
  };
}
