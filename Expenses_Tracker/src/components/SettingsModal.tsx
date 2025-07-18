import { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { useAuthStore } from '~/stores/auth';
import { trpc } from '~/trpc/react';
import { 
  User, 
  Sun, 
  Moon, 
  Monitor, 
  Globe, 
  BarChart3, 
  ArrowUpDown,
  Save,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, setTheme, updateUserPreferences } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'auto'>(
    user?.preferences?.theme || 'auto'
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    user?.preferences?.defaultCurrency || 'EUR'
  );
  const [chartCategoryCount, setChartCategoryCount] = useState(
    user?.preferences?.chartCategoryCount || 10
  );
  const [currencyOrder, setCurrencyOrder] = useState<string[]>(
    user?.preferences?.currencyOrder || []
  );
  const [selectedCurrencyToAdd, setSelectedCurrencyToAdd] = useState<string>('');

  // Get available currencies
  const { data: availableCurrencies } = trpc.currency.getAvailableCurrencies.useQuery();

  // Update preferences mutation
  const updatePreferencesMutation = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success('Impostazioni salvate con successo');
      setIsLoading(false);
    },
    onError: (error: any) => {
      toast.error('Errore nel salvare le impostazioni: ' + error.message);
      setIsLoading(false);
    },
  });

  // Sync with user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setSelectedTheme(user.preferences?.theme || 'auto');
      setDefaultCurrency(user.preferences?.defaultCurrency || 'EUR');
      setChartCategoryCount(user.preferences?.chartCategoryCount || 10);
      setCurrencyOrder(user.preferences?.currencyOrder || []);
    }
  }, [isOpen, user]);

  // Theme options
  const themeOptions = [
    { value: 'auto', label: 'Auto (Sistema)', icon: Monitor },
    { value: 'light', label: 'Chiaro', icon: Sun },
    { value: 'dark', label: 'Scuro', icon: Moon },
  ] as const;

  // Category count options
  const categoryCountOptions = useMemo(() => [
    { value: 5, label: '5 categorie' },
    { value: 10, label: '10 categorie' },
    { value: 15, label: '15 categorie' },
    { value: 20, label: '20 categorie' },
    { value: 25, label: '25 categorie' },
    { value: 999, label: 'Tutte le categorie' },
  ], []);

  // Handle theme change
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setSelectedTheme(newTheme);
    setTheme(newTheme); // Apply immediately for user feedback
  };

  // Handle currency order change
  const moveCurrencyUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...currencyOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index]!, newOrder[index - 1]!];
      setCurrencyOrder(newOrder);
    }
  };

  const moveCurrencyDown = (index: number) => {
    if (index < currencyOrder.length - 1) {
      const newOrder = [...currencyOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1]!, newOrder[index]!];
      setCurrencyOrder(newOrder);
    }
  };

  // Add currency to preferred list
  const addCurrencyToOrder = (currencyCode: string) => {
    if (!currencyOrder.includes(currencyCode)) {
      setCurrencyOrder([...currencyOrder, currencyCode]);
    }
  };

  // Remove currency from preferred list
  const removeCurrencyFromOrder = (currencyCode: string) => {
    setCurrencyOrder(currencyOrder.filter(code => code !== currencyCode));
  };

  // Get available currencies not in the order list - cached with useMemo
  const filteredAvailableCurrencies = useMemo(() => {
    return availableCurrencies?.filter(currency => 
      !currencyOrder.includes(currency.code)
    ) || [];
  }, [availableCurrencies, currencyOrder]);

  // Handle save preferences
  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      const preferences = {
        theme: selectedTheme,
        defaultCurrency,
        chartCategoryCount,
        currencyOrder,
      };

      await updatePreferencesMutation.mutateAsync(preferences);
      updateUserPreferences(preferences);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impostazioni"
      size="lg"
    >
      <div className="p-6 space-y-8">
        {/* User Info Section */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Informazioni Account
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-lg font-medium text-blue-700 dark:text-blue-200">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.email}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Membro dal {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Theme Section */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Tema Interfaccia
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleThemeChange(option.value)}
                className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all ${
                  selectedTheme === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <option.icon className={`h-5 w-5 ${
                  selectedTheme === option.value
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  selectedTheme === option.value
                    ? 'text-blue-900 dark:text-blue-100'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Currency Preferences */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Preferenze Valuta
          </h3>
          
          {/* Default Currency */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Valuta Predefinita
            </label>
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {availableCurrencies?.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol || ''} {currency.code || ''} - {currency.name || ''}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Order Management */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Gestione Ordine Valute nei Menu
            </label>
            
            {/* Add Currency Section */}
            {filteredAvailableCurrencies.length > 0 && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Aggiungi Valuta alla Lista Preferita
                </h4>
                <div className="flex gap-2">
                  <select
                    value={selectedCurrencyToAdd}
                    onChange={(e) => setSelectedCurrencyToAdd(e.target.value)}
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleziona una valuta...</option>
                    {filteredAvailableCurrencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.symbol || ''} {currency.code || ''} - {currency.name || ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (selectedCurrencyToAdd) {
                        addCurrencyToOrder(selectedCurrencyToAdd);
                        setSelectedCurrencyToAdd('');
                      }
                    }}
                    disabled={!selectedCurrencyToAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            )}

            {/* Current Currency Order */}
            {currencyOrder.length > 0 ? (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valute Preferite (Ordine di Visualizzazione)
                </h4>
                <div className="space-y-2">
                  {currencyOrder.map((currencyCode, index) => {
                    const currency = availableCurrencies?.find(c => c.code === currencyCode);
                    return (
                      <div key={currencyCode} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <span className="text-sm text-gray-900 dark:text-white flex-1">
                          {currency?.symbol || ''} {currency?.code || ''} - {currency?.name || currencyCode}
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => moveCurrencyUp(index)}
                            disabled={index === 0}
                            className="p-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Sposta su"
                          >
                            <ArrowUpDown className="h-4 w-4 rotate-180" />
                          </button>
                          <button
                            onClick={() => moveCurrencyDown(index)}
                            disabled={index === currencyOrder.length - 1}
                            className="p-1 rounded disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Sposta giù"
                          >
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeCurrencyFromOrder(currencyCode)}
                            className="p-1 rounded text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            title="Rimuovi dalla lista"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">
                  Nessuna valuta nella lista preferita.
                  <br />
                  Aggiungi valute per personalizzare l'ordine nei menu.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart Preferences */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Preferenze Grafici
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Numero di Categorie nei Grafici
            </label>
            <select
              value={chartCategoryCount}
              onChange={(e) => setChartCategoryCount(parseInt(e.target.value))}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categoryCountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>



        {/* Save Button */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSavePreferences}
            disabled={isLoading || updatePreferencesMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center"
          >
            {isLoading || updatePreferencesMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva Impostazioni
          </button>
        </div>
      </div>
    </Modal>
  );
}
