import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';

export interface UnsavedChangesGuardOptions<T> {
  /** Dati del form da monitorare */
  formData: T;
  /** Funzione per salvare i dati */
  onSave?: () => Promise<void> | void;
  /** Se il form è in stato di saving */
  isSaving?: boolean;
  /** Se disabilitare completamente il guard */
  disabled?: boolean;
  /** Messaggio personalizzato (opzionale) */
  message?: string;
}

interface UnsavedChangesGuardReturn {
  /** Se ci sono modifiche non salvate */
  hasUnsavedChanges: boolean;
  /** Se il modale di conferma è aperto */
  isModalOpen: boolean;
  /** Forza la navigazione ignorando le modifiche */
  confirmNavigation: () => void;
  /** Annulla la navigazione */
  cancelNavigation: () => void;
  /** Salva e poi naviga */
  saveAndNavigate: () => Promise<void>;
  /** Reset delle modifiche (da chiamare dopo un salvataggio riuscito) */
  resetChanges: () => void;
  /** Chiude il modale */
  closeModal: () => void;
}

/**
 * Custom hook per prevenire la perdita di dati non salvati
 * 
 * @example
 * ```tsx
 * const { hasUnsavedChanges, isModalOpen, confirmNavigation, cancelNavigation, saveAndNavigate } = 
 *   useUnsavedChangesGuard({
 *     formData: { name, email, description },
 *     onSave: handleSave,
 *     isSaving: isSubmitting
 *   });
 * ```
 */
export function useUnsavedChangesGuard<T = any>({
  formData,
  onSave,
  isSaving = false,
  disabled = false,
  message = "Hai delle modifiche non salvate. Vuoi procedere?"
}: UnsavedChangesGuardOptions<T>): UnsavedChangesGuardReturn {
  const router = useRouter();
  
  // Stato iniziale memorizzato come JSON string
  const initialDataRef = useRef<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const preventNavigationRef = useRef(false);

  // Serializza i dati per il confronto
  const serializeData = useCallback((data: T): string => {
    try {
      return JSON.stringify(data, Object.keys(data as any).sort());
    } catch {
      return '';
    }
  }, []);

  // Inizializza lo stato iniziale
  useEffect(() => {
    if (!disabled) {
      initialDataRef.current = serializeData(formData);
    }
  }, [disabled, serializeData, formData]);

  // Calcola se ci sono modifiche
  const hasUnsavedChanges = !disabled && 
    initialDataRef.current !== '' && 
    initialDataRef.current !== serializeData(formData) &&
    !isSaving;

  // Reset delle modifiche
  const resetChanges = useCallback(() => {
    initialDataRef.current = serializeData(formData);
  }, [formData, serializeData]);

  // Gestione beforeunload per chiusura browser/scheda
  useEffect(() => {
    if (disabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, disabled, message]);

  // Navigation guard per Tanstack Router
  useEffect(() => {
    if (disabled) return;

    const handleNavigation = (e: Event) => {
      if (hasUnsavedChanges && !preventNavigationRef.current) {
        e.preventDefault();
        setIsModalOpen(true);
        
        // Memorizza la navigazione da eseguire dopo la conferma
        setPendingNavigation(() => () => {
          preventNavigationRef.current = true;
          // Ripeti la navigazione
          const newEvent = new Event(e.type, { bubbles: true, cancelable: true });
          e.target?.dispatchEvent(newEvent);
          preventNavigationRef.current = false;
        });
        
        return false;
      }
    };

    // Intercetta i click sui link di navigazione
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href && hasUnsavedChanges && !preventNavigationRef.current) {
        e.preventDefault();
        setIsModalOpen(true);
        
        setPendingNavigation(() => () => {
          preventNavigationRef.current = true;
          window.location.href = link.href;
        });
      }
    };

    document.addEventListener('click', handleClick, true);
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [hasUnsavedChanges, disabled]);

  // Conferma navigazione senza salvare
  const confirmNavigation = useCallback(() => {
    setIsModalOpen(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Annulla navigazione
  const cancelNavigation = useCallback(() => {
    setIsModalOpen(false);
    setPendingNavigation(null);
  }, []);

  // Salva e poi naviga
  const saveAndNavigate = useCallback(async () => {
    if (!onSave) {
      confirmNavigation();
      return;
    }

    try {
      await onSave();
      resetChanges();
      confirmNavigation();
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      // Mantieni il modale aperto in caso di errore
    }
  }, [onSave, confirmNavigation, resetChanges]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingNavigation(null);
  }, []);

  return {
    hasUnsavedChanges,
    isModalOpen,
    confirmNavigation,
    cancelNavigation,
    saveAndNavigate,
    resetChanges,
    closeModal
  };
} 