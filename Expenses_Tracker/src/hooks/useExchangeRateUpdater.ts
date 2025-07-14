import { useEffect, useRef } from 'react';
import { trpc } from '~/trpc/react';

/**
 * Hook personalizzato per gestire l'aggiornamento automatico quotidiano dei cambi valutari.
 * Si attiva una sola volta per sessione e solo se non è già stato eseguito oggi.
 */
export function useExchangeRateUpdater() {
  const hasRunRef = useRef(false);
  
  const updateMutation = trpc.currency.updateDailyExchangeRates.useMutation({
    onSuccess: (data) => {
      if (data.skipped) {
        console.log('💱 Exchange rates already updated today');
      } else if (data.success) {
        console.log(`💱 Exchange rates updated: ${data.updatedRates} rates`);
      } else {
        console.error('💱 Failed to update exchange rates:', data.message);
      }
    },
    onError: (error) => {
      console.error('💱 Error updating exchange rates:', error.message);
    },
  });

  useEffect(() => {
    // Evita esecuzioni multiple nella stessa sessione
    if (hasRunRef.current) {
      return;
    }

    // Aggiungi un piccolo delay per assicurarti che l'app sia completamente caricata
    const timeoutId = setTimeout(() => {
      hasRunRef.current = true;
      
      // Esegui l'aggiornamento in background
      updateMutation.mutate();
    }, 2000); // 2 secondi di delay

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    isUpdating: updateMutation.isPending,
    hasCompleted: updateMutation.isSuccess,
    error: updateMutation.error,
  };
} 