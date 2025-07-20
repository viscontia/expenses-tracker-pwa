import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from 'react';
import { trpc } from "~/trpc/react";
import { useAuthStore } from '~/stores/auth';
import { ResponsiveTable } from '~/components/ResponsiveTable';
import { RateIndicator } from '~/components/RateIndicator';
import { ExpenseDetailTable } from '~/components/ExpenseDetailTable';
import { ResponsiveModal } from '~/components/ResponsiveModal';
import { Calendar, Filter, Search, Eye, Edit2, Trash2, X } from 'lucide-react';
import { formatCurrency } from '~/utils/formatters';
import { usePersistedFilters } from '~/hooks/usePersistedFilters';

// Available currencies for summary
const CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

export const Route = createFileRoute("/_authenticated/expenses/")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const navigate = useNavigate();
  
  // Get user's default currency preference
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  const [selectedExpenses, setSelectedExpenses] = useState<any[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  
  // Get user ID for filter persistence
  const userId = useAuthStore((state) => state.user?.id?.toString());
  
  // 🎯 HOOK PERSISTENZA FILTRI - Sostituisce tutta la logica filtri precedente
  const {
    stagedFilters,
    activeFilters,
    setStagedFilters,
    applyFilters,
    resetFilters,
    getCurrentMonthRange
  } = usePersistedFilters(userId);
  
  // 🚨 STATO ERRORE per validazione date
  const [dateError, setDateError] = useState<string | null>(null);
  
  // States for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  
  // State for summary currency selection - initialized with user's default currency
  const [summaryCurrency, setSummaryCurrency] = useState<string>(defaultCurrency || 'EUR');

  // Sync summary currency with user's default currency preference changes
  useEffect(() => {
    if (defaultCurrency) {
      setSummaryCurrency(defaultCurrency);
    }
  }, [defaultCurrency]);

  // ✅ VALIDAZIONE DATE
  const validateDateRange = useCallback((startDate: string, endDate: string): string | null => {
    if (!startDate || !endDate) return null;
    
    if (new Date(startDate) > new Date(endDate)) {
      return "La data di fine deve essere successiva alla data di inizio";
    }
    
    return null;
  }, []);

  // 🔄 HANDLER per applicare i filtri staged con validazione
  const handleApplyFilters = useCallback(() => {
    const error = validateDateRange(stagedFilters.dateRange.start, stagedFilters.dateRange.end);
    
    if (error) {
      setDateError(error);
      return;
    }
    
    setDateError(null);
    applyFilters();
  }, [stagedFilters, validateDateRange, applyFilters]);

  // 🧹 HANDLER per reset filtri al mese corrente
  const handleClearFilters = useCallback(() => {
    setDateError(null);
    resetFilters();
  }, [resetFilters]);

  // ⌨️ HANDLER per ENTER sui campi input
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyFilters();
    }
  }, [handleApplyFilters]);

  // 📅 HELPER: Formatta data per input HTML
  const formatDateForInput = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // 🎯 HANDLER per aggiornamento date con validazione real-time
  const handleDateChange = useCallback((type: 'start' | 'end', value: string) => {
    setStagedFilters(prev => {
      const newDateRange = { 
        ...prev.dateRange, 
        [type]: value || '' 
      };
      
      // Valida le date in tempo reale per feedback immediato (solo se entrambe sono compilate)
      const error = newDateRange.start && newDateRange.end ? 
        validateDateRange(newDateRange.start, newDateRange.end) : null;
      setDateError(error);
      
      return {
        ...prev,
        dateRange: newDateRange
      };
    });
  }, [validateDateRange, setStagedFilters]);

  // 📊 Fetch expenses with ONLY active filters (no auto-refetch)
  const { data: expensesData, isLoading, refetch: refetchExpenses } = trpc.expenses.getExpenses.useQuery({
    categoryIds: activeFilters.selectedCategory ? [activeFilters.selectedCategory] : undefined,
    startDate: activeFilters.dateRange.start,
    endDate: activeFilters.dateRange.end,
  }, {
    // Disabilita refetch automatico sui cambiamenti di parametri
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch categories for filter
  const { data: categories } = trpc.categories.getAll.useQuery();

  // Delete expense mutation
  const deleteExpenseMutation = trpc.expenses.deleteExpense.useMutation({
    onSuccess: () => {
      console.log('✅ Expense deleted successfully');
      setShowDeleteConfirm(false);
      setExpenseToDelete(null);
      // Refetch expenses to update the list
      void refetchExpenses();
    },
    onError: (error) => {
      console.error('❌ Error deleting expense:', error);
      alert('Errore durante la cancellazione della spesa: ' + error.message);
    }
  });

  const expenses = expensesData?.expenses || [];

  // Function to calculate total in specific currency
  const calculateTotalInCurrency = (expenses: any[], targetCurrency: string): number => {
    return expenses.reduce((total, expense) => {
      const { amount, currency, conversionRate } = expense;
      
      if (currency === targetCurrency) {
        // Same currency - use amount directly
        return total + amount;
      } else if (currency === 'EUR' && targetCurrency !== 'EUR') {
        // Converting FROM EUR TO other currency
        // We need the reverse rate (EUR to target)
        // This requires a current exchange rate query - for now use 1/conversionRate as approximation
        return total + (amount / conversionRate);
      } else if (currency !== 'EUR' && targetCurrency === 'EUR') {
        // Converting TO EUR from other currency (most common case)
        // Use the stored conversionRate (originalCurrency -> EUR)
        return total + (amount / conversionRate);
      } else {
        // Converting between two non-EUR currencies
        // First convert to EUR, then to target currency
        // This is complex and requires current rates - for now convert via EUR
        const eurAmount = amount / conversionRate;
        // This is a simplification - in reality we'd need current EUR->target rate
        return total + eurAmount; // Fallback to EUR equivalent
      }
    }, 0);
  };

  // Function to check if any conversions are needed
  const hasConversions = (expenses: any[], targetCurrency: string): boolean => {
    return expenses.some(expense => expense.currency !== targetCurrency);
  };

  // Filter expenses by search term
  const filteredExpenses = expenses.filter(expense => 
    !activeFilters.searchTerm || 
    expense.description?.toLowerCase().includes(activeFilters.searchTerm.toLowerCase()) ||
    expense.category.name.toLowerCase().includes(activeFilters.searchTerm.toLowerCase())
  );

  const handleViewDetails = (categoryName: string, categoryExpenses: any[]) => {
    setSelectedExpenses(categoryExpenses);
    setDetailTitle(`Spese - ${categoryName}`);
    setShowDetailModal(true);
  };

  const handleDeleteExpense = (expense: any) => {
    setExpenseToDelete(expense);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      deleteExpenseMutation.mutate({ id: expenseToDelete.id });
    }
  };

  const handleEditExpense = (expense: any) => {
    console.log('🔄 Edit expense:', expense);
    // Navigate to edit route - mantiene i filtri grazie al localStorage
    navigate({ to: `/expenses/edit/${expense.id}` });
  };

  const columns = [
    {
      key: 'date',
      label: 'Data',
      render: (value: string) => new Date(value).toLocaleDateString('it-IT'),
    },
    {
      key: 'description',
      label: 'Descrizione',
      render: (value: string) => value || 'N/A',
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (value: any) => value?.name || 'N/A',
    },
    {
      key: 'amount',
      label: 'Importo',
      render: (value: number, row: any) => 
        formatCurrency(value, row.currency),
    },
    {
      key: 'conversionRate',
      label: 'Tasso di Cambio',
      render: (value: number, row: any) => (
        <RateIndicator
          source="historical"
          rate={value}
          fromCurrency={row.currency}
          toCurrency="EUR"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Azioni',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <button
            onClick={() => handleViewDetails(row.category.name, [row])}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title="Visualizza dettagli"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEditExpense(row)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
            title="Modifica spesa"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteExpense(row)}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            title="Elimina spesa"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tutte le Spese</h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          <Filter className="h-5 w-5 inline mr-2" />
          Filtri
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Search className="h-4 w-4 inline mr-1" />
              Cerca
            </label>
                          <input
                type="text"
                value={stagedFilters.searchTerm}
                onChange={(e) => setStagedFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Descrizione o categoria..."
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categoria
            </label>
            <select
              value={stagedFilters.selectedCategory || ''}
              onChange={(e) => setStagedFilters(prev => ({ ...prev, selectedCategory: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tutte le categorie</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Periodo
            </label>
            
            {/* 🎯 SHORTCUTS DATE RAPIDI */}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  const currentMonth = getCurrentMonthRange();
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: currentMonth
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Mese corrente
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: {
                      start: formatDateForInput(lastMonth),
                      end: formatDateForInput(endLastMonth)
                    }
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                Mese scorso
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const startOfYear = new Date(now.getFullYear(), 0, 1);
                  setStagedFilters(prev => ({
                    ...prev,
                    dateRange: {
                      start: formatDateForInput(startOfYear),
                      end: formatDateForInput(now)
                    }
                  }));
                  setDateError(null);
                }}
                className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                Anno corrente
              </button>
            </div>
            
            <div className="flex space-x-2">
              <input
                type="date"
                value={stagedFilters.dateRange.start || ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Data inizio"
              />
              <input
                type="date"
                value={stagedFilters.dateRange.end || ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Data fine"
              />
            </div>
            {dateError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{dateError}</p>
            )}
          </div>

          {/* 🎯 PULSANTI CONTROLLO FILTRI */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleApplyFilters}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              disabled={isLoading}
            >
              <Search className="h-4 w-4" />
              {isLoading ? 'Ricerca...' : 'Applica Filtri'}
            </button>
            
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* 📊 FILTRI ATTIVI - Indicatori visivi */}
        {(activeFilters.searchTerm || activeFilters.selectedCategory || activeFilters.dateRange.start || activeFilters.dateRange.end) && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">Filtri attivi:</span>
            
            {activeFilters.searchTerm && (
              <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
                <Search className="h-3 w-3" />
                "{activeFilters.searchTerm}"
              </span>
            )}
            
            {activeFilters.selectedCategory && (
              <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-1 rounded-full">
                <Filter className="h-3 w-3" />
                {categories?.find(c => c.id === activeFilters.selectedCategory)?.name}
              </span>
            )}
            
            {(activeFilters.dateRange.start || activeFilters.dateRange.end) && (
              <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs px-2 py-1 rounded-full">
                <Calendar className="h-3 w-3" />
                {activeFilters.dateRange.start && new Date(activeFilters.dateRange.start).toLocaleDateString('it-IT')}
                {activeFilters.dateRange.start && activeFilters.dateRange.end && ' - '}
                {activeFilters.dateRange.end && new Date(activeFilters.dateRange.end).toLocaleDateString('it-IT')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <ResponsiveTable
        columns={columns}
        data={filteredExpenses}
        keyField="id"
        emptyMessage="Nessuna spesa trovata"
      />

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Riepilogo
          </h3>
          
          {/* Currency Selector for Summary */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">Valuta:</label>
            <select
              value={summaryCurrency}
              onChange={(e) => setSummaryCurrency(e.target.value)}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Totale Spese</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {filteredExpenses.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Importo Totale ({summaryCurrency})
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {CURRENCIES.find(c => c.code === summaryCurrency)?.symbol}
                              {formatCurrency(calculateTotalInCurrency(filteredExpenses, summaryCurrency), summaryCurrency)}
            </p>
            {hasConversions(filteredExpenses, summaryCurrency) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Conversioni approssimate - basate sui tassi storici
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Categorie Coinvolte</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {new Set(filteredExpenses.map(e => e.category.id)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <ResponsiveModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={detailTitle}
      >
        <ExpenseDetailTable
          title={detailTitle}
          data={selectedExpenses}
          onClose={() => setShowDetailModal(false)}
        />
      </ResponsiveModal>

      {/* Delete Confirmation Modal */}
      <ResponsiveModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Conferma Cancellazione"
      >
        <div className="space-y-4">
          <p className="text-gray-900 dark:text-white">
            Sei sicuro di voler eliminare questa spesa?
          </p>
          {expenseToDelete && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Descrizione:</span> {expenseToDelete.description || 'N/A'}</p>
                <p><span className="font-medium">Importo:</span> {expenseToDelete.amount} {expenseToDelete.currency}</p>
                <p><span className="font-medium">Data:</span> {new Date(expenseToDelete.date).toLocaleDateString('it-IT')}</p>
                <p><span className="font-medium">Categoria:</span> {expenseToDelete.category?.name}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-red-600 dark:text-red-400">
            ⚠️ Questa azione non può essere annullata.
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              onClick={confirmDeleteExpense}
              disabled={deleteExpenseMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteExpenseMutation.isPending ? 'Eliminando...' : 'Elimina'}
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
}
