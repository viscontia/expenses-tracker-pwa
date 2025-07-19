import { ReactNode, useEffect } from 'react';
import { useUnsavedChangesGuard, UnsavedChangesGuardOptions } from '../hooks/useUnsavedChangesGuard';
import { UnsavedChangesModal, UnsavedChangesModalSimple } from './UnsavedChangesModal';

interface UnsavedChangesGuardProps<T> extends UnsavedChangesGuardOptions<T> {
  children: ReactNode;
  /** Se mostrare l'indicatore visivo delle modifiche */
  showIndicator?: boolean;
  /** Classe CSS personalizzata per l'indicatore */
  indicatorClassName?: string;
}

/**
 * Componente wrapper che combina hook e modale per una protezione completa
 * 
 * @example
 * ```tsx
 * <UnsavedChangesGuard
 *   formData={{ name, email, description }}
 *   onSave={handleSave}
 *   isSaving={isSubmitting}
 *   showIndicator
 * >
 *   <form>
 *     {/* contenuto del form *\/}
 *   </form>
 * </UnsavedChangesGuard>
 * ```
 */
export function UnsavedChangesGuard<T>({
  children,
  showIndicator = false,
  indicatorClassName = '',
  formData,
  onSave,
  isSaving,
  disabled,
  message
}: UnsavedChangesGuardProps<T>) {
  
  const guardOptions = { formData, onSave, isSaving, disabled, message };
  
  const {
    hasUnsavedChanges,
    isModalOpen,
    confirmNavigation,
    cancelNavigation,
    saveAndNavigate,
    resetChanges
  } = useUnsavedChangesGuard(guardOptions);

  // Supporto per Ctrl+S / Cmd+S per salvare
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && onSave) {
          onSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, onSave]);

  return (
    <div className={`relative ${indicatorClassName}`}>
      {/* Indicatore visivo delle modifiche non salvate */}
      {showIndicator && hasUnsavedChanges && (
        <div className="absolute top-0 right-0 z-10 transform translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center space-x-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800 shadow-sm">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <span>Modifiche non salvate</span>
          </div>
        </div>
      )}
      
      {/* Contenuto */}
      {children}
      
      {/* Modale di conferma */}
      {onSave ? (
        <UnsavedChangesModal
          isOpen={isModalOpen}
          onSaveAndExit={saveAndNavigate}
          onExitWithoutSaving={confirmNavigation}
          onCancel={cancelNavigation}
          isSaving={isSaving}
          message={message}
        />
      ) : (
        <UnsavedChangesModalSimple
          isOpen={isModalOpen}
          onExitWithoutSaving={confirmNavigation}
          onCancel={cancelNavigation}
          message={message}
        />
      )}
    </div>
  );
}

/**
 * Hook esposto per uso diretto quando non si vuole usare il wrapper
 */
export { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';

/**
 * Componenti modali esportati per uso personalizzato
 */
export { UnsavedChangesModal, UnsavedChangesModalSimple } from './UnsavedChangesModal'; 