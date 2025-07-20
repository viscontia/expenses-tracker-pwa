import { useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import { trpc } from '~/trpc/react';
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  Tag,
  ArrowLeft,
  Check,
  Loader2,
  ChevronDown
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuthStore } from '~/stores/auth';
import { useUnsavedChangesGuard, UnsavedChangesModal } from '~/components/UnsavedChangesGuard';
import { usePreSubmitExchangeUpdate } from '~/hooks/usePreSubmitExchangeUpdate';
import { formatNumber } from '~/utils/formatters';

type FormData = {
  amount: string;
  currency: string;
  categoryId: string;
  date: string;
  description: string;
  conversionRate?: number; // Per preservare il tasso storico in modalità update
};

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

interface ExpenseFormProps {
  mode: 'insert' | 'update';
  expenseId?: number;
}

export function ExpenseForm({ mode, expenseId }: ExpenseFormProps) {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  // Get categories from backend
  const { data: categories, isLoading: categoriesLoading } = trpc.categories.getAll.useQuery(
    undefined,
    { enabled: !!token }
  );

  // Get existing expense data for edit mode - optimized with dedicated query
  const { data: existingExpense, isLoading: expenseLoading, error: expenseError } = trpc.expenses.getExpenseById.useQuery(
    { id: expenseId as number },
    { 
      enabled: mode === 'update' && !!expenseId && typeof expenseId === 'number',
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      retry: 1,
    }
  );

  // Stato iniziale per valuta (sarà aggiornato da formData)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');

  // Create expense mutation
  const createExpenseMutation = trpc.expenses.createExpense.useMutation({
    onSuccess: () => {
      console.log('✅ [ExpenseForm] Expense saved successfully!');
      setIsSubmitted(true);
      
      if (!existingExpense && continueInserting) {
        // Se stiamo creando una nuova spesa e l'utente vuole continuare
        console.log('🔄 [ExpenseForm] Resetting form for new expense...');
        setTimeout(() => {
          // Reset della form per nuovo inserimento
          setFormData({
            amount: '',
            currency: formData.currency, // Mantieni la valuta selezionata
            categoryId: '',
            date: new Date().toISOString().split('T')[0],
            description: '',
            conversionRate: undefined,
          });
          setIsSubmitted(false);
          setIsSubmitting(false);
          setError(null);
          setErrors({});
        }, 500);
      } else {
        // Navigazione normale
        setTimeout(() => {
          console.log('🔄 [ExpenseForm] Navigating to expenses list...');
          navigate({ to: '/expenses' });
        }, 500);
      }
    },
    onError: (error) => {
      setError(error.message);
      setIsSubmitting(false);
    }
  });

  // Update expense mutation
  const updateExpenseMutation = trpc.expenses.updateExpense.useMutation({
    onSuccess: () => {
      console.log('✅ [ExpenseForm] Expense updated successfully!');
      setIsSubmitted(true);
      
      setTimeout(() => {
        console.log('🔄 [ExpenseForm] Navigating to expenses list...');
        navigate({ to: '/expenses' });
      }, 500);
    },
    onError: (error) => {
      setError(error.message);
      setIsSubmitting(false);
    }
  });

  const [formData, setFormData] = useState<FormData>({
    amount: '',
    currency: 'EUR',
    categoryId: '',
    date: new Date().toISOString().split('T')[0] || new Date().toISOString().slice(0, 10),
    description: '',
    conversionRate: undefined, // Sarà popolato dai dati esistenti in modalità update
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continueInserting, setContinueInserting] = useState(false);

  // Nuovo stato per il dropdown delle categorie
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const categorySearchRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Funzione per ottenere il componente icona
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || (LucideIcons as any).ShoppingCart;
  };

  // Trova la categoria selezionata
  const selectedCategory = categories?.find(cat => cat.id.toString() === formData.categoryId);

  // Filtra le categorie in base al termine di ricerca
  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (!categorySearchTerm.trim()) return categories;
    
    const searchLower = categorySearchTerm.toLowerCase();
    return categories.filter(category => 
      category.name.toLowerCase().includes(searchLower) ||
      (category.description && category.description.toLowerCase().includes(searchLower))
    );
  }, [categories, categorySearchTerm]);

  // Get exchange rates dinamicamente basato sulla valuta selezionata
  const { data: exchangeRate, isLoading: exchangeRateLoading } = trpc.currency.getExchangeRate.useQuery(
    { 
      fromCurrency: 'EUR', 
      toCurrency: selectedCurrency as 'ZAR' | 'EUR' | 'USD' | 'GBP' 
    },
    { 
      enabled: selectedCurrency !== 'EUR',
      staleTime: 5 * 60 * 1000,
      retry: 2
    }
  );

  // Hook per aggiornamento pre-submit delle valute - SOLO per UPDATE
  const { ensureFreshRates, isProcessing: isUpdatingRates, status: ratesStatus } = usePreSubmitExchangeUpdate({
    enabled: mode === 'update', // 🚀 DISABILITATO per INSERT - tassi già presenti nel DB
    timeoutMs: 3000,
    onUpdateStart: () => {
      console.log('💱 [ExpenseForm] Starting exchange rate update before UPDATE...');
    },
    onUpdateComplete: (success, result) => {
      if (success && result && !result.skipped) {
        console.log(`💱 [ExpenseForm] Exchange rates updated successfully: ${result.updatedRates} rates`);
      }
    },
    onUpdateError: (error) => {
      console.warn('💱 [ExpenseForm] Exchange rate update failed, but proceeding with UPDATE:', error);
    }
  });

  // Load existing expense data for edit mode
  useEffect(() => {
    if (mode === 'update' && existingExpense) {
      console.log('📝 [ExpenseForm] Loading existing expense data:', existingExpense);
      setFormData({
        amount: existingExpense.amount.toString(),
        currency: existingExpense.currency,
        categoryId: existingExpense.categoryId.toString(),
        date: new Date(existingExpense.date).toISOString().split('T')[0],
        description: existingExpense.description?.toString() || '',
        conversionRate: existingExpense.conversionRate, // Preserva il tasso storico
      });
    }
  }, [mode, existingExpense]);

  // Aggiorna la valuta predefinita quando l'utente e le sue preferenze sono disponibili
  useEffect(() => {
    if (mode === 'insert') {
      const safeCurrency = String(defaultCurrency || 'EUR');
      
      setFormData(prev => ({
        ...prev,
        currency: safeCurrency
      }));
    }
  }, [defaultCurrency, mode]);

  // Sincronizza selectedCurrency con formData.currency per la query exchange rate
  useEffect(() => {
    setSelectedCurrency(formData.currency);
  }, [formData.currency]);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
        setCategorySearchTerm(''); // Reset search when closing
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  // Auto-focus sul campo di ricerca quando il dropdown si apre
  useEffect(() => {
    if (isCategoryDropdownOpen && categorySearchRef.current) {
      setTimeout(() => {
        categorySearchRef.current?.focus();
      }, 100);
    }
  }, [isCategoryDropdownOpen]);

  // 🎯 Auto-focus sul campo IMPORTO ogni volta che si apre la form
  useEffect(() => {
    // Focus sul campo importo quando la form è pronta e visibile
    const timer = setTimeout(() => {
      if (amountInputRef.current && !isSubmitting && !isSubmitted) {
        amountInputRef.current.focus();
        amountInputRef.current.select(); // Seleziona il testo per facilitare la sovrascrittura
      }
    }, 150); // Piccolo delay per assicurarsi che il DOM sia pronto

    return () => clearTimeout(timer);
  }, [isSubmitting, isSubmitted]); // Ri-esegui quando cambia lo stato di submit

  // 🔄 Focus automatico dopo reset per inserimenti multipli  
  useEffect(() => {
    // Quando la form si resetta per un nuovo inserimento (continueInserting),
    // formData.amount diventa vuoto, quindi riapplicare il focus
    if (!existingExpense && formData.amount === '' && !isSubmitting && !isSubmitted) {
      const timer = setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
        }
      }, 200); // Delay leggermente maggiore per il reset

      return () => clearTimeout(timer);
    }
  }, [formData.amount, existingExpense, isSubmitting, isSubmitted]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.amount) {
      newErrors.amount = 'Importo richiesto';
    } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Importo deve essere un numero positivo';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Categoria richiesta';
    }

    if (!formData.date) {
      newErrors.date = 'Data richiesta';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🎯 Gestione tasto ENTER per submit rapido
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Submit con ENTER solo se:
    // 1. È premuto Enter
    // 2. Non siamo già in submit
    // 3. Non stiamo digitando nel campo ricerca categorie (che ha la sua logica Enter)
    if (e.key === 'Enter' && !isSubmitting && !isSubmitted) {
      const target = e.target as HTMLElement;
      
      // Escludi il campo di ricerca categorie (ha già il suo comportamento Enter)
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).placeholder === 'Cerca categoria per nome...') {
        return; // Lascia che il campo ricerca gestisca Enter
      }
      
      // Escludi textarea se ce ne sono (per consentire newline)
      if (target.tagName === 'TEXTAREA') {
        return;
      }
      
      e.preventDefault();
      handleSubmit(e as any); // Cast per compatibilità tipo
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setError('Token di autenticazione mancante');
      return;
    }

    setIsSubmitting(true);

    try {
      // 🚀 INSERIMENTO DIRETTO: Nessun aggiornamento tassi per INSERT
      console.log(`💾 [ExpenseForm] Starting ${mode === 'insert' ? 'INSERT' : 'UPDATE'} expense...`);
      
      // Aggiornamento tassi SOLO per UPDATE (tassi per INSERT già nel DB)
      let ratesPromise = Promise.resolve({ success: true, updated: false, timedOut: false });
      if (mode === 'update') {
        ratesPromise = ensureFreshRates().catch(error => {
          console.warn(`⚠️ [ExpenseForm] Background rate update failed:`, error);
          return { success: false, updated: false, timedOut: false };
        });
      }

      // 🎯 LOGICA INTELLIGENTE CONVERSION RATE PER TASSO STORICO
      let conversionRate = 1; // Default per EUR
      
      if (mode === 'update' && formData.conversionRate) {
        // 📊 MODALITÀ UPDATE: Preserva tasso storico o aggiorna se errore
        if (formData.conversionRate !== 1) {
          // ✅ Tasso storico valido - MANTIENILO
          conversionRate = formData.conversionRate;
          console.log(`💱 [ExpenseForm] UPDATE: Preserving historical rate: ${conversionRate}`);
        } else {
          // ⚠️ Tasso = 1 (errore storico) - AGGIORNALO
          console.log(`💱 [ExpenseForm] UPDATE: Historical rate was 1.0 (error), updating...`);
          if (formData.currency !== 'EUR' && exchangeRate?.rate && exchangeRate.rate > 0) {
            conversionRate = exchangeRate.rate;
            console.log(`💱 [ExpenseForm] UPDATE: Using current rate ${formData.currency}→EUR: ${conversionRate}`);
          } else {
            console.warn(`⚠️ [ExpenseForm] UPDATE: No current rate available, keeping 1.0`);
            conversionRate = 1;
          }
        }
      } else {
        // 🆕 MODALITÀ INSERT: Usa tassi già presenti nel DB
        if (formData.currency !== 'EUR') {
          // Usa il tasso dal DB (già caricato automaticamente)
          conversionRate = exchangeRate?.rate || 1;
          console.log(`💱 [ExpenseForm] INSERT: Using DB rate ${formData.currency}→EUR: ${conversionRate}`);
        } else {
          conversionRate = 1;
          console.log(`💱 [ExpenseForm] INSERT: EUR expense, conversion rate: 1.0`);
        }
      }

      // 🚀 SALVA IMMEDIATAMENTE senza aspettare l'aggiornamento rates
      console.log(`💾 [ExpenseForm] ${mode === 'insert' ? 'Creating' : 'Updating'} expense immediately...`);
      
      const expenseData = {
        categoryId: parseInt(formData.categoryId),
        amount: parseFloat(formData.amount),
        currency: formData.currency as 'ZAR' | 'EUR',
        conversionRate,
        date: new Date(formData.date).toISOString(),
        description: formData.description || undefined,
      };

      if (mode === 'insert') {
        await createExpenseMutation.mutateAsync(expenseData);
      } else {
        await updateExpenseMutation.mutateAsync({
          id: expenseId!,
          ...expenseData
        });
      }

      // Log background update result (non blocking)
      ratesPromise.then(result => {
        if (result.updated) {
          console.log(`✅ [ExpenseForm] Background exchange rates updated after ${mode}`);
        }
      });

    } catch (err) {
      // Error handled in onError callback
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Memoized form data for unsaved changes detection
  const memoizedFormData = useMemo(() => formData, [formData]);

  // Handle save function for unsaved changes guard
  const handleSave = async (): Promise<void> => {
    if (!validateForm()) {
      throw new Error('Form validation failed');
    }

    return new Promise((resolve, reject) => {
      const originalOnSuccess = mode === 'insert' ? 
        createExpenseMutation.originalOptions?.onSuccess : 
        updateExpenseMutation.originalOptions?.onSuccess;

      const tempMutation = mode === 'insert' ? createExpenseMutation : updateExpenseMutation;
      
      // Temporarily override onSuccess to resolve our promise
      const expenseData = {
        categoryId: parseInt(formData.categoryId),
        amount: parseFloat(formData.amount),
        currency: formData.currency as 'ZAR' | 'EUR',
        conversionRate: formData.currency === 'EUR' ? 1 : (exchangeRate?.rate || 1),
        date: new Date(formData.date).toISOString(),
        description: formData.description || undefined,
      };

      if (mode === 'insert') {
        createExpenseMutation.mutate(expenseData, {
          onSuccess: () => {
            resolve();
            originalOnSuccess?.();
          },
          onError: (error) => {
            reject(error);
          }
        });
      } else {
        updateExpenseMutation.mutate({ id: expenseId!, ...expenseData }, {
          onSuccess: () => {
            resolve();
            originalOnSuccess?.();
          },
          onError: (error) => {
            reject(error);
          }
        });
      }
    });
  };

  // Unsaved changes guard
  const { 
    hasUnsavedChanges, 
    isModalOpen, 
    confirmNavigation, 
    cancelNavigation, 
    saveAndNavigate 
  } = useUnsavedChangesGuard({
    formData: memoizedFormData,
    onSave: handleSave,
    isSaving: isSubmitting,
    disabled: isSubmitted,
    message: mode === 'insert' ? 
      "Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?" :
      "Hai modificato questa spesa. Vuoi salvare le modifiche prima di uscire?"
  });

  // Check if form is loading
  if ((mode === 'update' && expenseLoading) || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Caricamento...</span>
        </div>
      </div>
    );
  }

  // Check if expense not found (for edit mode)
  if (mode === 'update' && !expenseLoading && !existingExpense) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <h2 className="text-lg font-medium text-red-900 dark:text-red-100 mb-2">
              Spesa non trovata
            </h2>
            <p className="text-red-700 dark:text-red-300 mb-4">
              La spesa con ID {expenseId} non è stata trovata.
            </p>
            <button
              onClick={() => navigate({ to: '/expenses' })}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Torna alla lista spese
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pageTitle = mode === 'insert' ? 'Nuova Spesa' : 'Modifica Spesa';
  const submitButtonText = mode === 'insert' ? 'Salva Spesa' : 'Aggiorna Spesa';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate({ to: '/expenses' })}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {pageTitle}
          </h1>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {/* Progress/Status Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                <DollarSign className="h-4 w-4 mr-1" />
                {mode === 'insert' ? 'Registrazione nuova spesa' : 'Modifica spesa esistente'}
              </span>
              {hasUnsavedChanges && (
                <div className="flex items-center text-amber-600 dark:text-amber-400">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                  <span>Modifiche non salvate</span>
                </div>
              )}
            </div>
          </div>

          {/* Checkbox Continua Inserimento - Solo in modalità insert */}
          {mode === 'insert' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={continueInserting}
                  onChange={(e) => setContinueInserting(e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Continua a rimanere in Inserimento Spese
                  </span>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    Se attivato, dopo ogni registrazione la form si resetta per inserire una nuova spesa
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {mode === 'insert' ? 
                'I tuoi dati sono protetti automaticamente. Prima di salvare ogni spesa, aggiorniamo i tassi di cambio per garantire precisione.' :
                'Le modifiche verranno salvate mantenendo il tasso di cambio originale della spesa.'
              }
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              💡 <strong>Suggerimento:</strong> Usa <kbd className="px-1 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 rounded">Ctrl+S</kbd> (o <kbd className="px-1 py-0.5 text-xs bg-blue-200 dark:bg-blue-800 rounded">Cmd+S</kbd> su Mac) per salvare rapidamente
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Form */}
          <form 
            onSubmit={handleSubmit} 
            onKeyDown={handleFormKeyDown}
            className="space-y-6"
          >
            {/* Amount and Currency Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Importo *
                </label>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valuta
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code}
                    </option>
                  ))}
                </select>
                
                {/* Exchange Rate Indicator */}
                {formData.currency !== 'EUR' && (
                  <div className="mt-2 text-sm">
                    {exchangeRateLoading ? (
                      <div className="flex items-center text-amber-600 dark:text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        <span>Caricamento tasso di cambio...</span>
                      </div>
                    ) : exchangeRate?.rate ? (
                      <div className="flex items-center text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3 mr-1" />
                        <span>Tasso: 1 {formData.currency} = {formatNumber(exchangeRate.rate, 4)} EUR</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600 dark:text-red-400">
                        <span className="text-xs">⚠️</span>
                        <span className="ml-1">Tasso non disponibile - sarà usato 1.0</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="relative" ref={categoryDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Categoria *
              </label>
              
              {/* Custom Category Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-left flex items-center justify-between ${
                    errors.categoryId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedCategory ? (
                      <>
                        {(() => {
                          const IconComponent = getIconComponent(selectedCategory.icon);
                          return <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-300" />;
                        })()}
                        <span>{selectedCategory.name}</span>
                        {selectedCategory.description && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            - {selectedCategory.description}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500">Seleziona una categoria</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown List */}
                {isCategoryDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                      <input
                        ref={categorySearchRef}
                        type="text"
                        placeholder="Cerca categoria per nome..."
                        value={categorySearchTerm}
                        onChange={(e) => setCategorySearchTerm(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                        onKeyDown={(e) => {
                          // Gestione navigazione con tastiera
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setCategorySearchTerm('');
                            setIsCategoryDropdownOpen(false);
                          } else if (e.key === 'Enter' && filteredCategories.length === 1 && filteredCategories[0]) {
                            // Se c'è solo una categoria che corrisponde alla ricerca, selezionala
                            e.preventDefault();
                            handleInputChange('categoryId', filteredCategories[0].id.toString());
                            setIsCategoryDropdownOpen(false);
                            setCategorySearchTerm('');
                          }
                        }}
                      />
                      {categorySearchTerm && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {filteredCategories.length} categoria{filteredCategories.length !== 1 ? 'e' : ''} trovata{filteredCategories.length !== 1 ? 'e' : ''}
                        </div>
                      )}
                    </div>
                    
                    {/* Categories List */}
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((category) => {
                      const IconComponent = getIconComponent(category.icon);
                      return (
                        <button
                          key={category.id}
                          type="button"
                            onClick={() => {
                              handleInputChange('categoryId', category.id.toString());
                              setIsCategoryDropdownOpen(false);
                              setCategorySearchTerm(''); // Reset search after selection
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                          >
                            <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {/* Evidenzia il testo di ricerca */}
                                {categorySearchTerm ? (
                                  <span dangerouslySetInnerHTML={{
                                    __html: category.name.replace(
                                      new RegExp(`(${categorySearchTerm})`, 'gi'),
                                      '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>'
                                    )
                                  }} />
                                ) : (
                                  category.name
                                )}
                              </div>
                              {category.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {/* Evidenzia il testo di ricerca nella descrizione */}
                                  {categorySearchTerm ? (
                                    <span dangerouslySetInnerHTML={{
                                      __html: category.description.replace(
                                        new RegExp(`(${categorySearchTerm})`, 'gi'),
                                        '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>'
                                      )
                                    }} />
                                  ) : (
                                    category.description
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        <div className="text-sm">Nessuna categoria trovata</div>
                        {categorySearchTerm && (
                          <div className="text-xs mt-1">
                            Prova a cercare con termini diversi
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
              
              {errors.categoryId && (
                <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Data *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                  errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.date && (
                <p className="text-red-500 text-sm mt-1">{errors.date}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
                Descrizione (opzionale)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Aggiungi una descrizione..."
                maxLength={200}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formData.description.length}/200 caratteri
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                type="button"
                onClick={() => navigate({ to: '/expenses' })}
                className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isUpdatingRates}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isUpdatingRates ? 'Aggiornando valute...' : (mode === 'insert' ? 'Salvando...' : 'Aggiornando...')}
                  </>
                ) : (
                  submitButtonText
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Categories Info */}
        {(!categories || categories.length === 0) && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>Nessuna categoria disponibile.</strong> Prima di aggiungere spese, 
              <a href="/categories" className="underline ml-1">crea almeno una categoria</a>.
            </p>
          </div>
        )}

        {/* Success State */}
        {isSubmitted && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {mode === 'insert' ? 'Spesa Salvata!' : 'Spesa Aggiornata!'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {mode === 'insert' ? 
                  'La tua spesa è stata registrata con successo.' :
                  'Le modifiche sono state salvate con successo.'
                }
              </p>
            </div>
          </div>
        )}

        {/* Modale di conferma per modifiche non salvate */}
        <UnsavedChangesModal
          isOpen={isModalOpen}
          onSaveAndExit={saveAndNavigate}
          onExitWithoutSaving={confirmNavigation}
          onCancel={cancelNavigation}
          isSaving={isSubmitting}
          message={mode === 'insert' ? 
            "Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?" :
            "Hai modificato questa spesa. Vuoi salvare le modifiche prima di uscire?"
          }
          showSaveButton={true}
        />
      </div>
    </div>
  );
} 