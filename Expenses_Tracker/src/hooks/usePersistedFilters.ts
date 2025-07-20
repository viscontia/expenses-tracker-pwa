import { useState, useEffect, useCallback } from 'react';

// 🎯 TIPI per i filtri
export interface ExpenseFilters {
  searchTerm: string;
  selectedCategory: number | null;
  dateRange: { start: string; end: string };
}

export interface ActiveExpenseFilters {
  searchTerm: string;
  selectedCategory: number | null;
  dateRange: { start: string | undefined; end: string | undefined };
}

// 🔑 CHIAVE localStorage per persistenza - ora include userId
const getStorageKey = (userId?: string): string => {
  return userId ? `expenseListFilters_${userId}` : 'expenseListFilters_anonymous';
};

// 📅 HELPER: Ottieni inizio e fine del mese corrente
const getCurrentMonthRange = (): { start: string; end: string } => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    start: formatDate(startOfMonth),
    end: formatDate(endOfMonth)
  };
};

// 🏭 FACTORY: Filtri di default
const getDefaultFilters = (): ExpenseFilters => {
  const currentMonthRange = getCurrentMonthRange();
  return {
    searchTerm: '',
    selectedCategory: null,
    dateRange: currentMonthRange
  };
};

// 💾 SALVA filtri in localStorage
const saveFiltersToStorage = (filters: ExpenseFilters, userId?: string): void => {
  try {
    const storageKey = getStorageKey(userId);
    localStorage.setItem(storageKey, JSON.stringify(filters));
  } catch (error) {
    console.warn('Failed to save filters to localStorage:', error);
  }
};

// 📖 CARICA filtri da localStorage
const loadFiltersFromStorage = (userId?: string): ExpenseFilters | null => {
  try {
    const storageKey = getStorageKey(userId);
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as ExpenseFilters;
    
    // ✅ VALIDAZIONE: verifica che i filtri salvati siano validi
    if (
      typeof parsed.searchTerm === 'string' &&
      (parsed.selectedCategory === null || typeof parsed.selectedCategory === 'number') &&
      parsed.dateRange &&
      typeof parsed.dateRange.start === 'string' &&
      typeof parsed.dateRange.end === 'string'
    ) {
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to load filters from localStorage:', error);
    return null;
  }
};

// 🧹 PULISCI localStorage
const clearFiltersFromStorage = (userId?: string): void => {
  try {
    const storageKey = getStorageKey(userId);
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Failed to clear filters from localStorage:', error);
  }
};

/**
 * 🎣 HOOK: usePersistedFilters
 * 
 * Gestisce la persistenza dei filtri dell'elenco spese tra le navigazioni.
 * I filtri vengono salvati automaticamente in localStorage e ripristinati
 * quando l'utente torna alla pagina.
 * 
 * MODIFICA: Ora resetta i filtri ogni volta che si entra nella pagina,
 * ma mantiene la persistenza per utente specifico.
 */
export const usePersistedFilters = (userId?: string) => {
  // 📋 STATO: Filtri staged (in modifica dall'utente)
  const [stagedFilters, setStagedFilters] = useState<ExpenseFilters>(() => {
    // 🆕 SEMPRE usa i filtri di default quando si entra nella pagina
    return getDefaultFilters();
  });

  // 🎯 STATO: Filtri attivi (applicati alle query)
  const [activeFilters, setActiveFilters] = useState<ActiveExpenseFilters>(() => {
    // 🆕 SEMPRE usa i filtri di default quando si entra nella pagina
    const filters = getDefaultFilters();
    
    return {
      searchTerm: filters.searchTerm,
      selectedCategory: filters.selectedCategory,
      dateRange: {
        start: filters.dateRange.start ? 
          new Date(filters.dateRange.start + 'T00:00:00.000').toISOString() : 
          undefined,
        end: filters.dateRange.end ? 
          new Date(filters.dateRange.end + 'T23:59:59.999').toISOString() : 
          undefined
      }
    };
  });

  // 💾 AUTO-SAVE: Salva filtri staged quando cambiano (per persistenza utente)
  useEffect(() => {
    saveFiltersToStorage(stagedFilters, userId);
  }, [stagedFilters, userId]);

  // 🔄 APPLICA filtri: converte staged in active
  const applyFilters = useCallback(() => {
    const activeFiltersData: ActiveExpenseFilters = {
      searchTerm: stagedFilters.searchTerm,
      selectedCategory: stagedFilters.selectedCategory,
      dateRange: {
        start: stagedFilters.dateRange.start ? 
          new Date(stagedFilters.dateRange.start + 'T00:00:00.000').toISOString() : 
          undefined,
        end: stagedFilters.dateRange.end ? 
          new Date(stagedFilters.dateRange.end + 'T23:59:59.999').toISOString() : 
          undefined
      }
    };
    setActiveFilters(activeFiltersData);
  }, [stagedFilters]);

  // 🧹 RESET filtri: torna ai default del mese corrente
  const resetFilters = useCallback(() => {
    const defaultFilters = getDefaultFilters();
    setStagedFilters(defaultFilters);
    
    // Applica immediatamente i filtri reset
    const activeFiltersData: ActiveExpenseFilters = {
      searchTerm: defaultFilters.searchTerm,
      selectedCategory: defaultFilters.selectedCategory,
      dateRange: {
        start: new Date(defaultFilters.dateRange.start + 'T00:00:00.000').toISOString(),
        end: new Date(defaultFilters.dateRange.end + 'T23:59:59.999').toISOString()
      }
    };
    setActiveFilters(activeFiltersData);
  }, []);

  // 🗑️ CLEAR filtri: rimuove dalla storage
  const clearPersistedFilters = useCallback(() => {
    clearFiltersFromStorage(userId);
    resetFilters();
  }, [resetFilters, userId]);

  return {
    // Stati
    stagedFilters,
    activeFilters,
    
    // Setters
    setStagedFilters,
    setActiveFilters,
    
    // Actions
    applyFilters,
    resetFilters,
    clearPersistedFilters,
    
    // Utilities
    getCurrentMonthRange
  };
}; 