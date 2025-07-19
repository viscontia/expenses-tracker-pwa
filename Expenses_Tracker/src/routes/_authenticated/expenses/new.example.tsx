/**
 * ESEMPIO PRATICO: Integrazione UnsavedChangesGuard nel form delle spese
 * 
 * Questo file mostra come integrare il sistema di protezione dati non salvati
 * nel form di creazione spese esistente. 
 * 
 * Per applicare le modifiche al file reale:
 * 1. Importare UnsavedChangesGuard nel file new.index.tsx
 * 2. Avvolgere il form con il componente UnsavedChangesGuard
 * 3. Passare i dati del form e la funzione di salvataggio
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { trpc } from '~/trpc/react';
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  Tag,
  ArrowLeft,
  Check,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '~/stores/auth';

// ✅ AGGIUNTA: Import del sistema di protezione
import { UnsavedChangesGuard } from '~/components/UnsavedChangesGuard';

export const Route = createFileRoute('/_authenticated/expenses/new/example')({
  component: NewExpenseWithProtection,
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
  // ... altre valute
];

function NewExpenseWithProtection() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  // Get categories from backend
  const { data: categories, isLoading: categoriesLoading } = trpc.categories.getAll.useQuery(
    undefined,
    { enabled: !!token }
  );

  // Create expense mutation
  const createExpenseMutation = trpc.expenses.createExpense.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      // ✅ AGGIUNTA: Reset del guard dopo salvataggio riuscito
      // Questo verrà gestito automaticamente dal componente UnsavedChangesGuard
      setTimeout(() => {
        navigate({ to: '/dashboard' });
      }, 2000);
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
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aggiorna la valuta predefinita quando l'utente e le sue preferenze sono disponibili
  useEffect(() => {
    const safeCurrency = String(defaultCurrency || 'EUR');
    setFormData(prev => ({
      ...prev,
      currency: safeCurrency
    }));
  }, [defaultCurrency]);

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

  // ✅ AGGIUNTA: Funzione di salvataggio per il guard
  const handleSave = async (): Promise<void> => {
    if (!validateForm()) {
      throw new Error('Il form contiene errori di validazione');
    }

    if (!token) {
      throw new Error('Token di autenticazione mancante');
    }

    try {
      const conversionRate = formData.currency === 'EUR' ? 1 : 1; // Simplified for example
      
      await createExpenseMutation.mutateAsync({
        categoryId: parseInt(formData.categoryId),
        amount: parseFloat(formData.amount),
        currency: formData.currency as 'ZAR' | 'EUR',
        conversionRate,
        date: new Date(formData.date).toISOString(),
        description: formData.description || undefined,
      });
    } catch (err) {
      throw err; // Rilancia l'errore per il guard
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await handleSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <Check className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
              Spesa salvata!
            </h2>
            <p className="text-green-700 dark:text-green-300 mb-4">
              La tua spesa è stata registrata con successo.
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Reindirizzamento alla dashboard in corso...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Nuova Spesa
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Registra una nuova spesa nel tuo budget
            </p>
          </div>
        </div>

        {/* ✅ AGGIUNTA: Wrapper con protezione dati non salvati */}
        <UnsavedChangesGuard
          formData={formData}
          onSave={handleSave}
          isSaving={isSubmitting}
          disabled={isSubmitted} // Disabilita la protezione quando il form è già salvato
          showIndicator={true} // Mostra l'indicatore visivo delle modifiche
          message="Hai inserito dei dati per una nuova spesa. Vuoi salvarla prima di uscire?"
        >
          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Amount Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Importo *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
                      ${errors.amount 
                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                      } dark:text-white`}
                    placeholder="0.00"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">
                      {CURRENCIES.find(c => c.code === formData.currency)?.symbol}
                    </span>
                  </div>
                </div>
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
                )}
              </div>

              {/* Currency Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valuta
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                >
                  {CURRENCIES.map(currency => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="h-4 w-4 inline mr-1" />
                  Categoria *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleInputChange('categoryId', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
                    ${errors.categoryId 
                      ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                    } dark:text-white`}
                  disabled={categoriesLoading}
                >
                  <option value="">
                    {categoriesLoading ? 'Caricamento...' : 'Seleziona una categoria'}
                  </option>
                  {categories?.map(category => (
                    <option key={category.id} value={category.id.toString()}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.categoryId}</p>
                )}
              </div>

              {/* Date Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Data *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors
                    ${errors.date 
                      ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                      : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                    } dark:text-white`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date}</p>
                )}
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="h-4 w-4 inline mr-1" />
                  Descrizione
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors resize-none"
                  placeholder="Descrizione opzionale della spesa..."
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || categoriesLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Salva Spesa</span>
                    </>
                  )}
                </button>
              </div>

              {/* ✅ AGGIUNTA: Informazione sul sistema di protezione */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    <p className="font-medium mb-1">🛡️ Protezione dati attiva</p>
                    <p>I tuoi dati sono protetti automaticamente. Se tenti di uscire con modifiche non salvate, ti verrà chiesto di confermare.</p>
                    <p className="mt-1">
                      <strong>Tip:</strong> Usa <kbd className="px-1 py-0.5 bg-blue-200 dark:bg-blue-800 rounded">Ctrl+S</kbd> per salvare rapidamente
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </UnsavedChangesGuard>
      </div>
    </div>
  );
}

/* 
📝 ISTRUZIONI PER L'INTEGRAZIONE:

Per applicare questa protezione al file reale (new.index.tsx), segui questi passi:

1. Aggiungi l'import:
   import { UnsavedChangesGuard } from '~/components/UnsavedChangesGuard';

2. Avvolgi il form esistente con UnsavedChangesGuard:
   <UnsavedChangesGuard
     formData={formData}
     onSave={handleSave}
     isSaving={isSubmitting}
     disabled={isSubmitted}
     showIndicator={true}
   >
     {/* form esistente *\/}
   </UnsavedChangesGuard>

3. Crea o modifica la funzione handleSave per gestire il salvataggio:
   const handleSave = async (): Promise<void> => {
     // logica di validazione e salvataggio
   };

4. (Opzionale) Aggiungi l'informazione sulla protezione nel form per educare l'utente

🎯 VANTAGGI:
- ✅ Previene perdita dati accidentale
- ✅ Supporta Ctrl+S per salvataggio rapido  
- ✅ Indicatore visivo delle modifiche non salvate
- ✅ Gestione automatica di navigazione e chiusura browser
- ✅ Modale con 3 opzioni chiare per l'utente
- ✅ Completamente tipizzato con TypeScript
- ✅ Responsive e accessibile
*/ 