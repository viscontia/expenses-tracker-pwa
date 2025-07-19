import { createFileRoute, useNavigate } from '@tanstack/react-router';
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

export const Route = createFileRoute('/_authenticated/expenses/new/')({
  component: NewExpense,
});

type FormData = {
  amount: string;
  currency: string;
  categoryId: string;
  date: string;
  description: string;
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

function NewExpense() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  // Get categories from backend
  const { data: categories, isLoading: categoriesLoading } = trpc.categories.getAll.useQuery(
    undefined,
    { enabled: !!token }
  );

  // Stato iniziale per valuta (sarà aggiornato da formData)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');

  // Create expense mutation
  const createExpenseMutation = trpc.expenses.createExpense.useMutation({
    onSuccess: () => {
      console.log('✅ [NewExpense] Expense saved successfully!');
      setIsSubmitted(true);
      
      // 🚀 RIDOTTO timeout da 2s a 500ms per responsiveness
      setTimeout(() => {
        console.log('🔄 [NewExpense] Navigating to dashboard...');
        navigate({ to: '/dashboard' });
      }, 500);
    },
    onError: (error) => {
      setError(error.message);
      setIsSubmitting(false);
    }
  });

  const [formData, setFormData] = useState<FormData>({
    amount: '',
    currency: 'EUR', // Inizialmente EUR, sarà aggiornato dal useEffect
    categoryId: '',
    date: new Date().toISOString().split('T')[0] || new Date().toISOString().slice(0, 10),
    description: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nuovo stato per il dropdown delle categorie
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Funzione per ottenere il componente icona
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || (LucideIcons as any).ShoppingCart;
  };

  // Trova la categoria selezionata
  const selectedCategory = categories?.find(cat => cat.id.toString() === formData.categoryId);

  // Get exchange rates dinamicamente basato sulla valuta selezionata
  const { data: exchangeRate, isLoading: exchangeRateLoading } = trpc.currency.getExchangeRate.useQuery(
    { 
      fromCurrency: 'EUR', 
      toCurrency: selectedCurrency as 'ZAR' | 'EUR' | 'USD' | 'GBP' 
    },
    { 
      enabled: selectedCurrency !== 'EUR', // Abilita solo per valute non-EUR
      staleTime: 5 * 60 * 1000, // Cache per 5 minuti
      retry: 2 // Retry massimo 2 volte
    }
  );

  // Hook per aggiornamento pre-submit delle valute
  const { ensureFreshRates, isProcessing: isUpdatingRates, status: ratesStatus } = usePreSubmitExchangeUpdate({
    enabled: true,
    timeoutMs: 5000, // 5 secondi timeout
    onUpdateStart: () => {
      console.log('💱 [NewExpense] Starting exchange rate update before submission...');
    },
    onUpdateComplete: (success, result) => {
      if (success && result && !result.skipped) {
        console.log(`💱 [NewExpense] Exchange rates updated successfully: ${result.updatedRates} rates`);
      }
    },
    onUpdateError: (error) => {
      console.warn('💱 [NewExpense] Exchange rate update failed, but proceeding with submission:', error);
    }
  });

  // Aggiorna la valuta predefinita quando l'utente e le sue preferenze sono disponibili
  useEffect(() => {
    const safeCurrency = String(defaultCurrency || 'EUR');
    
    setFormData(prev => ({
      ...prev,
      currency: safeCurrency
    }));
  }, [defaultCurrency]);

  // Sincronizza selectedCurrency con formData.currency per la query exchange rate
  useEffect(() => {
    setSelectedCurrency(formData.currency);
  }, [formData.currency]);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'L\'importo deve essere maggiore di 0';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Seleziona una categoria';
    }

    if (!formData.date) {
      newErrors.date = 'Seleziona una data';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      // 🚀 OTTIMIZZATO: Aggiornamento asincrono non bloccante
      console.log('💱 [NewExpense] Starting non-blocking rate update and expense save...');
      
      // Avvia aggiornamento in background SENZA attendere
      const ratesPromise = ensureFreshRates().catch(error => {
        console.warn('⚠️ [NewExpense] Background rate update failed:', error);
        return { success: false, updated: false, timedOut: false };
      });

             // Determina conversion rate con gestione intelligente
       let conversionRate = 1; // Default per EUR
       
       if (formData.currency !== 'EUR') {
         // Prova a usare il tasso corrente, se disponibile
         if (exchangeRate?.rate && exchangeRate.rate > 0) {
           conversionRate = exchangeRate.rate;
           console.log(`💱 [NewExpense] Using rate ${formData.currency}→EUR: ${conversionRate}`);
         } else {
           console.warn(`⚠️ [NewExpense] No exchange rate available for ${formData.currency}→EUR!`);
           console.warn(`⚠️ [NewExpense] Using fallback rate 1.0 - this may cause incorrect conversions!`);
           console.warn(`⚠️ [NewExpense] Consider updating exchange rates before saving foreign currency expenses.`);
           
           // Mostra warning user-friendly
           if (formData.currency !== 'EUR') {
             console.warn(`💰 [NewExpense] ATTENZIONE: Tasso di cambio ${formData.currency}→EUR non disponibile, usando 1.0`);
           }
         }
       } else {
         console.log(`💱 [NewExpense] EUR expense, using conversion rate: 1.0`);
       }

      // 🚀 SALVA IMMEDIATAMENTE senza aspettare l'aggiornamento rates
      console.log('💾 [NewExpense] Saving expense immediately...');
      await createExpenseMutation.mutateAsync({
        categoryId: parseInt(formData.categoryId),
        amount: parseFloat(formData.amount),
        currency: formData.currency as 'ZAR' | 'EUR',
        conversionRate,
        date: new Date(formData.date).toISOString(),
        description: formData.description || undefined,
      });

      // Log background update result (non blocking)
      ratesPromise.then(result => {
        if (result.updated) {
          console.log('✅ [NewExpense] Background exchange rates updated after save');
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
      throw new Error('Il form contiene errori di validazione');
    }

    if (!token) {
      throw new Error('Token di autenticazione mancante');
    }

    // ✅ FASE 2: Aggiornamento pre-submit delle valute per unsaved changes guard
    console.log('💱 [NewExpense] Ensuring fresh exchange rates before saving (unsaved changes guard)...');
    const ratesResult = await ensureFreshRates();
    
    if (ratesResult.updated) {
      console.log('✅ [NewExpense] Exchange rates refreshed successfully before saving');
    } else if (ratesResult.timedOut) {
      console.warn('⚠️ [NewExpense] Exchange rate update timed out, proceeding with existing rates');
    } else if (!ratesResult.success) {
      console.warn('⚠️ [NewExpense] Exchange rate update failed, proceeding with existing rates');
    }

    const conversionRate = formData.currency === 'EUR' ? 1 : (exchangeRate?.rate || 1);
    
    await createExpenseMutation.mutateAsync({
      categoryId: parseInt(formData.categoryId),
      amount: parseFloat(formData.amount),
      currency: formData.currency as 'ZAR' | 'EUR',
      conversionRate,
      date: new Date(formData.date).toISOString(),
      description: formData.description || undefined,
    });
  };

  // Unsaved changes guard (for navigation protection)
  const {
    hasUnsavedChanges,
    resetChanges
  } = useUnsavedChangesGuard({
    formData: memoizedFormData,
    onSave: handleSave,
    isSaving: isSubmitting,
    disabled: isSubmitted, // Disable when form is already submitted
    message: "Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?"
  });

  // Local state for navigation confirmation
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);

  // Handle back navigation with unsaved changes check
  const handleBackNavigation = () => {
    if (hasUnsavedChanges) {
      setShowNavigationConfirm(true);
    } else {
      navigate({ to: '/dashboard' });
    }
  };

  // Handle save and navigate
  const handleSaveAndNavigate = async () => {
    try {
      await handleSave();
      resetChanges();
      setShowNavigationConfirm(false);
      navigate({ to: '/dashboard' });
    } catch (error) {
      // Error already handled by mutation
    }
  };

  // Handle navigate without saving
  const handleNavigateWithoutSaving = () => {
    setShowNavigationConfirm(false);
    navigate({ to: '/dashboard' });
  };

  // Cancel navigation
  const handleCancelNavigation = () => {
    setShowNavigationConfirm(false);
  };

  // Supporto per Ctrl+S / Cmd+S per salvare
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !isSubmitting) {
          handleSubmit(e as any);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isSubmitting]);

  // Cleanup dell'hook valute al unmount
  useEffect(() => {
    return () => {
      // Cleanup automatico gestito dall'hook stesso
    };
  }, []);

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Spesa Aggiunta!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            La tua spesa è stata registrata con successo.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Verrai reindirizzato alla dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (categoriesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Caricamento categorie...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8 relative">
            <button
              onClick={handleBackNavigation}
              className="mr-4 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
                        </button>
            
            {/* Indicatore visivo delle modifiche non salvate */}
            {hasUnsavedChanges && (
              <div className="absolute right-0 top-0">
                <div className="flex items-center space-x-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800 shadow-sm">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span>Modifiche non salvate</span>
                </div>
              </div>
            )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Nuova Spesa
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Registra una nuova spesa nel tuo budget
            </p>
          </div>
        </div>

        {/* Protection Info Banner */}
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              <p className="font-medium mb-1">🛡️ Protezione dati attiva + 💱 Tassi sempre freschi</p>
              <p>I tuoi dati sono protetti automaticamente. Prima di salvare ogni spesa, aggiorniamo i tassi di cambio per garantire precisione.</p>
              <p className="mt-1">
                <strong>Tip:</strong> Usa <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">Ctrl+S</kbd> (o <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">Cmd+S</kbd> su Mac) per salvare rapidamente
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Amount and Currency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Importo *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
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
                        <span>Tasso: 1 {formData.currency} = {exchangeRate.rate.toFixed(4)} EUR</span>
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
                      <span className="text-gray-500 dark:text-gray-400">Seleziona una categoria</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${
                    isCategoryDropdownOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Dropdown Menu */}
                {isCategoryDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {categories?.map((category) => {
                      const IconComponent = getIconComponent(category.icon);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            handleInputChange('categoryId', category.id.toString());
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
                        >
                          <IconComponent className="h-4 w-4 text-gray-600 dark:text-gray-300 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-900 dark:text-white">{category.name}</span>
                            {category.description && (
                              <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                                - {category.description}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
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
                max={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
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
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Aggiungi una descrizione della spesa..."
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formData.description.length}/200 caratteri
              </p>
            </div>

            {/* Exchange Rate Update Status */}
            {isUpdatingRates && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    <p className="font-medium">💱 Aggiornamento tassi di cambio in corso...</p>
                    <p className="text-xs mt-1">Stiamo assicurando che i tassi siano aggiornati per la tua spesa</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate({ to: '/dashboard' })}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
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
                    {isUpdatingRates ? 'Aggiornando valute...' : 'Salvando...'}
                  </>
                ) : (
                  'Salva Spesa'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Categories Info */}
        {(!categories || categories.length === 0) && (
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              <strong>Nessuna categoria trovata.</strong> Vai alla sezione{' '}
              <button
                onClick={() => navigate({ to: '/categories' })}
                className="underline hover:no-underline"
              >
                Categorie
              </button>{' '}
              per crearne una prima di aggiungere spese.
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Modale di conferma per modifiche non salvate */}
    <UnsavedChangesModal
      isOpen={showNavigationConfirm}
      onSaveAndExit={handleSaveAndNavigate}
      onExitWithoutSaving={handleNavigateWithoutSaving}
      onCancel={handleCancelNavigation}
      isSaving={isSubmitting}
      message="Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?"
    />
    </>
  );
}
