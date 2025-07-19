import { Modal } from './Modal';
import { Save, AlertTriangle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  /** Se il modale è aperto */
  isOpen: boolean;
  /** Chiamata quando l'utente vuole salvare ed uscire */
  onSaveAndExit: () => Promise<void> | void;
  /** Chiamata quando l'utente vuole uscire senza salvare */
  onExitWithoutSaving: () => void;
  /** Chiamata quando l'utente annulla */
  onCancel: () => void;
  /** Se il salvataggio è in corso */
  isSaving?: boolean;
  /** Messaggio personalizzato (opzionale) */
  message?: string;
  /** Se mostrare il pulsante salva */
  showSaveButton?: boolean;
}

/**
 * Modale per gestire le modifiche non salvate
 * 
 * @example
 * ```tsx
 * <UnsavedChangesModal
 *   isOpen={isModalOpen}
 *   onSaveAndExit={saveAndNavigate}
 *   onExitWithoutSaving={confirmNavigation}
 *   onCancel={cancelNavigation}
 *   isSaving={isSubmitting}
 * />
 * ```
 */
export function UnsavedChangesModal({
  isOpen,
  onSaveAndExit,
  onExitWithoutSaving,
  onCancel,
  isSaving = false,
  message = "Hai delle modifiche non salvate. Vuoi procedere?",
  showSaveButton = true
}: UnsavedChangesModalProps) {
  
  const handleSaveAndExit = async () => {
    try {
      await onSaveAndExit();
    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      // Il modale rimane aperto in caso di errore
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Modifiche non salvate"
      size="md"
    >
      <div className="p-6">
        {/* Icona e messaggio */}
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Attenzione!
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {message}
            </p>
          </div>
        </div>

        {/* Pulsanti */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
          
          {/* Annulla */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <X className="h-4 w-4 mr-2" />
            Annulla
          </button>

          {/* Esci senza salvare */}
          <button
            type="button"
            onClick={onExitWithoutSaving}
            disabled={isSaving}
            className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Esci senza Salvare
          </button>

          {/* Salva ed esci */}
          {showSaveButton && (
            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={isSaving}
              className="inline-flex w-full sm:w-auto justify-center items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva ed Esci
                </>
              )}
            </button>
          )}
        </div>

        {/* Informazione aggiuntiva */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            💡 <strong>Suggerimento:</strong> Usa <kbd className="px-1 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-200 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded">Ctrl+S</kbd> (o <kbd className="px-1 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-200 dark:bg-blue-800 border border-blue-300 dark:border-blue-600 rounded">Cmd+S</kbd> su Mac) per salvare rapidamente
          </p>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Versione semplificata del modale per casi dove non è disponibile il salvataggio
 */
export function UnsavedChangesModalSimple({
  isOpen,
  onExitWithoutSaving,
  onCancel,
  message = "Hai delle modifiche non salvate. Vuoi procedere comunque?"
}: Omit<UnsavedChangesModalProps, 'onSaveAndExit' | 'isSaving' | 'showSaveButton'>) {
  return (
    <UnsavedChangesModal
      isOpen={isOpen}
      onSaveAndExit={() => {}}
      onExitWithoutSaving={onExitWithoutSaving}
      onCancel={onCancel}
      message={message}
      showSaveButton={false}
    />
  );
} 