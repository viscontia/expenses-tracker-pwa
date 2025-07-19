import { useState, useCallback, useRef } from 'react';
import { trpc } from '~/trpc/react';

interface PreSubmitUpdateStatus {
  isChecking: boolean;
  isUpdating: boolean;
  lastCheckTime: Date | null;
  needsUpdate: boolean | null;
  updateComplete: boolean;
  error: string | null;
}

interface UsePreSubmitExchangeUpdateOptions {
  enabled?: boolean;
  timeoutMs?: number;
  onUpdateStart?: () => void;
  onUpdateComplete?: (success: boolean, result?: any) => void;
  onUpdateError?: (error: string) => void;
}

/**
 * Hook per aggiornamento valute pre-registrazione spesa
 * Verifica se le valute sono fresche e le aggiorna se necessario
 * before saving an expense
 */
export function usePreSubmitExchangeUpdate(options: UsePreSubmitExchangeUpdateOptions = {}) {
  const {
    enabled = true,
    timeoutMs = 5000, // 5 secondi timeout massimo
    onUpdateStart,
    onUpdateComplete,
    onUpdateError
  } = options;

  const [status, setStatus] = useState<PreSubmitUpdateStatus>({
    isChecking: false,
    isUpdating: false,
    lastCheckTime: null,
    needsUpdate: null,
    updateComplete: false,
    error: null
  });

  // Ref per gestire timeout e evitare aggiornamenti multipli
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Query per verificare se l'aggiornamento è necessario
  const checkLastUpdateQuery = trpc.currency.getLastExchangeRateUpdate.useQuery(
    undefined,
    {
      enabled: false, // Attivata manualmente
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1
    }
  );

  // Mutation per l'aggiornamento
  const updateRatesMutation = trpc.currency.updateDailyExchangeRates.useMutation({
    onMutate: () => {
      console.log('💱 [PreSubmit] Starting exchange rate update...');
      setStatus(prev => ({
        ...prev,
        isUpdating: true,
        error: null
      }));
      onUpdateStart?.();
    },
    onSuccess: (result) => {
      console.log('💱 [PreSubmit] Update completed:', result);
      setStatus(prev => ({
        ...prev,
        isUpdating: false,
        updateComplete: true,
        error: null
      }));
      onUpdateComplete?.(true, result);
    },
    onError: (error) => {
      const errorMessage = error.message || 'Update failed';
      console.error('💱 [PreSubmit] Update failed:', errorMessage);
      setStatus(prev => ({
        ...prev,
        isUpdating: false,
        error: errorMessage
      }));
      onUpdateError?.(errorMessage);
      onUpdateComplete?.(false);
    }
  });

  // Funzione per verificare se è necessario l'aggiornamento
  const checkIfUpdateNeeded = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;

    try {
      setStatus(prev => ({
        ...prev,
        isChecking: true,
        lastCheckTime: new Date(),
        error: null
      }));

      const result = await checkLastUpdateQuery.refetch();
      const lastUpdateDate = result.data?.lastUpdateDate;

      // Considera "fresco" se aggiornato oggi
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const isStale = !lastUpdateDate || new Date(lastUpdateDate) < today;
      
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        needsUpdate: isStale
      }));

      if (isStale) {
        console.log('💱 [PreSubmit] Exchange rates are stale, update needed');
      } else {
        console.log('💱 [PreSubmit] Exchange rates are fresh, no update needed');
      }

      return isStale;
    } catch (error) {
      console.error('💱 [PreSubmit] Failed to check last update:', error);
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        error: 'Failed to check update status'
      }));
      // In caso di errore, assumiamo che non serve aggiornamento per non bloccare
      return false;
    }
  }, [enabled, checkLastUpdateQuery]);

  // Funzione principale: verifica e aggiorna se necessario
  const ensureFreshRates = useCallback(async (): Promise<{
    success: boolean;
    updated: boolean;
    timedOut: boolean;
    error?: string;
  }> => {
    if (!enabled || isProcessingRef.current) {
      return { success: true, updated: false, timedOut: false };
    }

    isProcessingRef.current = true;

    try {
      console.log('💱 [PreSubmit] Ensuring fresh exchange rates...');
      
      // Reset stato
      setStatus(prev => ({
        ...prev,
        updateComplete: false,
        error: null
      }));

      // 1. Verifica se serve aggiornamento
      const needsUpdate = await checkIfUpdateNeeded();
      
      if (!needsUpdate) {
        isProcessingRef.current = false;
        return { success: true, updated: false, timedOut: false };
      }

      // 2. Avvia aggiornamento con timeout
      console.log('💱 [PreSubmit] Starting update with timeout...');
      
      const updatePromise = updateRatesMutation.mutateAsync();
      
      // Promise di timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error('Update timeout'));
        }, timeoutMs);
      });

      try {
        // Race tra aggiornamento e timeout
        const result = await Promise.race([updatePromise, timeoutPromise]);
        
        // Clear timeout se l'aggiornamento è completato
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        console.log('💱 [PreSubmit] Update completed successfully:', result);
        isProcessingRef.current = false;
        return { success: true, updated: true, timedOut: false };
        
      } catch (error) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        const isTimeout = error instanceof Error && error.message === 'Update timeout';
        
        if (isTimeout) {
          console.warn('💱 [PreSubmit] Update timed out, proceeding anyway');
          isProcessingRef.current = false;
          return { success: true, updated: false, timedOut: true };
        } else {
          console.error('💱 [PreSubmit] Update failed:', error);
          isProcessingRef.current = false;
          return { 
            success: false, 
            updated: false, 
            timedOut: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    } catch (error) {
      console.error('💱 [PreSubmit] Unexpected error:', error);
      isProcessingRef.current = false;
      return { 
        success: false, 
        updated: false, 
        timedOut: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [enabled, checkIfUpdateNeeded, updateRatesMutation, timeoutMs]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  return {
    status,
    ensureFreshRates,
    cleanup,
    
    // Stati derivati per facilità d'uso
    isProcessing: status.isChecking || status.isUpdating,
    hasError: !!status.error,
    isReady: !status.isChecking && !status.isUpdating
  };
} 