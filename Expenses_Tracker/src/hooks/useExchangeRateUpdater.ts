import { useEffect, useRef, useState } from 'react';
import { trpc } from '~/trpc/react';
import { exchangeRateNotifications } from '~/components/ExchangeRateNotifications';

interface ExchangeRateUpdateStatus {
  isUpdating: boolean;
  lastUpdateAttempt: Date | null;
  lastUpdateSuccess: Date | null;
  error: string | null;
}

interface UseExchangeRateUpdaterOptions {
  enabled?: boolean;
  delayMs?: number;
  onUpdateStart?: () => void;
  onUpdateSuccess?: (result: any) => void;
  onUpdateError?: (error: string) => void;
}

/**
 * Hook per l'aggiornamento automatico dei tassi di cambio
 * Esegue l'aggiornamento in background senza bloccare l'UI
 */
export function useExchangeRateUpdater(options: UseExchangeRateUpdaterOptions = {}) {
  const {
    enabled = true,
    delayMs = 2000, // 2 secondi di delay predefinito
    onUpdateStart,
    onUpdateSuccess,
    onUpdateError
  } = options;

  const [status, setStatus] = useState<ExchangeRateUpdateStatus>({
    isUpdating: false,
    lastUpdateAttempt: null,
    lastUpdateSuccess: null,
    error: null
  });

  // Ref per evitare esecuzioni multiple
  const hasTriggeredUpdate = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mutation per invalidare cache quando i tassi vengono aggiornati
  const invalidateCacheMutation = trpc.currency.invalidateCache.useMutation();

  // Mutation per l'aggiornamento (non-bloccante)
  const updateRatesMutation = trpc.currency.updateDailyExchangeRates.useMutation({
    onMutate: () => {
      console.log('💱 [ExchangeRateUpdater] Starting background update...');
      setStatus(prev => ({
        ...prev,
        isUpdating: true,
        lastUpdateAttempt: new Date(),
        error: null
      }));
      onUpdateStart?.();
    },
    onSuccess: (result) => {
      console.log('💱 [ExchangeRateUpdater] Update completed:', result);
      setStatus(prev => ({
        ...prev,
        isUpdating: false,
        lastUpdateSuccess: new Date(),
        error: null
      }));
      onUpdateSuccess?.(result);
      
      // Mostra notifica basata sul risultato
      if (result.skipped) {
        console.log('💱 Exchange rates already updated today - skipped');
        // Non mostriamo notifica per skip, è normale
      } else if (result.updatedRates && result.updatedRates > 0) {
        console.log(`💱 Exchange rates updated: ${result.updatedRates} rates`);
        exchangeRateNotifications.success(result.updatedRates);
        
        // Invalida cache per garantire tassi freschi
        invalidateCacheMutation.mutate({ clearAll: true });
        console.log('💾 Cache invalidated after exchange rate update');
      }
    },
    onError: (error) => {
      const errorMessage = error.message || 'Unknown error';
      console.error('💱 [ExchangeRateUpdater] Update failed:', errorMessage);
      setStatus(prev => ({
        ...prev,
        isUpdating: false,
        error: errorMessage
      }));
      onUpdateError?.(errorMessage);
      
      // Mostra notifica di errore solo per l'aggiornamento automatico iniziale
      // Non per gli aggiornamenti silenziosi
      exchangeRateNotifications.error(errorMessage);
    }
  });

  // Effect principale per l'aggiornamento automatico
  useEffect(() => {
    if (!enabled || hasTriggeredUpdate.current) {
      return;
    }

    console.log(`💱 [ExchangeRateUpdater] Scheduling background update in ${delayMs}ms...`);
    
    // Crea AbortController per poter cancellare se necessario
    abortControllerRef.current = new AbortController();
    
    const timer = setTimeout(() => {
      // Verifica se il componente è ancora montato
      if (abortControllerRef.current?.signal.aborted) {
        console.log('💱 [ExchangeRateUpdater] Update cancelled - component unmounted');
        return;
      }

      hasTriggeredUpdate.current = true;
      console.log('💱 [ExchangeRateUpdater] Triggering background update...');
      
      // Esegui l'aggiornamento in modo asincrono (non-bloccante)
      updateRatesMutation.mutate();
    }, delayMs);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, delayMs, updateRatesMutation]);

  // Cleanup al unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Funzione per forzare un aggiornamento manuale
  const forceUpdate = () => {
    if (status.isUpdating) {
      console.log('💱 [ExchangeRateUpdater] Update already in progress, skipping force update');
      return;
    }
    
    console.log('💱 [ExchangeRateUpdater] Force update triggered');
    updateRatesMutation.mutate();
  };

  return {
    status,
    forceUpdate,
    isUpdating: status.isUpdating,
    hasError: !!status.error,
    error: status.error
  };
} 