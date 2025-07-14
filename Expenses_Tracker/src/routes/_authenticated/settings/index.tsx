import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { trpc } from '~/trpc/react';
import { 
  User, 
  Palette, 
  Globe, 
  Bell, 
  Shield, 
  Download,
  Trash2,
  Save,
  Loader2,
  Check
} from 'lucide-react';
import { useAuthStore } from '~/stores/auth';

export const Route = createFileRoute('/_authenticated/settings/')({
  component: Settings,
});

type UserPreferences = {
  theme?: 'light' | 'dark';
  defaultCurrency?: string;
  currencyOrder?: string[];
  chartCategoryCount?: number;
};

function Settings() {
  const { user, theme, setTheme } = useAuthStore();
  
  // Get current user data
  const { data: currentUser, refetch } = trpc.auth.getCurrentUser.useQuery();
  
  // Update preferences mutation
  const updatePreferencesMutation = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => {
      refetch();
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    },
    onError: (error: any) => {
      setError(error.message);
    }
  });

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: theme || 'light',
    defaultCurrency: 'EUR',
    currencyOrder: ['EUR', 'USD', 'GBP'],
    chartCategoryCount: 10,
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pushNotifications: false,
    weeklyReports: true,
    budgetAlerts: true,
  });

  const [privacy, setPrivacy] = useState({
    autoBackup: true,
    dataSharing: false,
    analytics: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update local preferences when user data changes
  useEffect(() => {
    if (currentUser?.preferences) {
      setPreferences(prev => ({
        ...prev,
        ...currentUser.preferences,
      }));
    }
  }, [currentUser]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await updatePreferencesMutation.mutateAsync(preferences);
      
      // Update theme in auth store if changed
      if (preferences.theme && preferences.theme !== theme) {
        setTheme(preferences.theme);
      }
    } catch (err) {
      // Error handled in onError callback
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    // Simulate data export
    const userData = {
      user: currentUser,
      preferences,
      exportDate: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = () => {
    if (window.confirm(
      'Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile e tutti i tuoi dati verranno persi.'
    )) {
      if (window.confirm(
        'Questa è la tua ultima possibilità. Sei ASSOLUTAMENTE sicuro di voler eliminare il tuo account?'
      )) {
        alert('Funzionalità di eliminazione account non ancora implementata. Contatta il supporto per assistenza.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Impostazioni
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Personalizza la tua esperienza e gestisci le preferenze dell'account
          </p>
        </div>

        {/* Success/Error Messages */}
        {isSaved && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
              <p className="text-green-600 dark:text-green-400 text-sm">
                Impostazioni salvate con successo!
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Profilo
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {user?.email?.split('@')[0] || 'Utente'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {user?.email || 'email@example.com'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Membro da {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('it-IT') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <Palette className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Aspetto
              </h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Tema
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', label: 'Chiaro', icon: '☀️' },
                    { value: 'dark', label: 'Scuro', icon: '🌙' },
                    { value: 'auto', label: 'Auto', icon: '🔄' },
                  ].map((themeOption) => (
                    <button
                      key={themeOption.value}
                      onClick={() => setPreferences(prev => ({ ...prev, theme: themeOption.value as 'light' | 'dark' }))}
                      className={`p-3 rounded-lg border-2 transition-colors text-center ${
                        preferences.theme === themeOption.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="text-2xl mb-1">{themeOption.icon}</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {themeOption.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Currency & Localization */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <Globe className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Valuta e Localizzazione
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Valuta Predefinita
                </label>
                <select
                  value={preferences.defaultCurrency}
                  onChange={(e) => setPreferences(prev => ({ ...prev, defaultCurrency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="EUR">€ Euro</option>
                  <option value="USD">R US Dollar</option>
                  <option value="GBP">£ British Pound</option>
                  <option value="ZAR">R South African Rand</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categorie nei Grafici
                </label>
                <select
                  value={preferences.chartCategoryCount}
                  onChange={(e) => setPreferences(prev => ({ ...prev, chartCategoryCount: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value={5}>Top 5</option>
                  <option value={10}>Top 10</option>
                  <option value={15}>Top 15</option>
                  <option value={20}>Top 20</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Notifiche
              </h2>
            </div>
            
            <div className="space-y-4">
              {[
                { key: 'emailAlerts', label: 'Avvisi Email', description: 'Ricevi notifiche via email per attività importanti' },
                { key: 'pushNotifications', label: 'Notifiche Push', description: 'Notifiche push del browser per aggiornamenti' },
                { key: 'weeklyReports', label: 'Report Settimanali', description: 'Riepilogo settimanale delle tue spese' },
                { key: 'budgetAlerts', label: 'Avvisi Budget', description: 'Notifiche quando ti avvicini ai limiti di budget' },
              ].map((notification) => (
                <div key={notification.key} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {notification.label}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {notification.description}
                    </p>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({
                      ...prev,
                      [notification.key]: !prev[notification.key as keyof typeof prev]
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifications[notification.key as keyof typeof notifications]
                        ? 'bg-blue-600'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notifications[notification.key as keyof typeof notifications]
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy & Data */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-6">
              <Shield className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Privacy e Dati
              </h2>
            </div>
            
            <div className="space-y-6">
              {/* Privacy Toggles */}
              <div className="space-y-4">
                {[
                  { key: 'autoBackup', label: 'Backup Automatico', description: 'Backup automatico dei tuoi dati nel cloud' },
                  { key: 'dataSharing', label: 'Condivisione Dati', description: 'Condividi dati anonimi per migliorare il servizio' },
                  { key: 'analytics', label: 'Analytics', description: 'Raccogli dati di utilizzo per migliorare l\'esperienza' },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {setting.label}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {setting.description}
                      </p>
                    </div>
                    <button
                      onClick={() => setPrivacy(prev => ({
                        ...prev,
                        [setting.key]: !prev[setting.key as keyof typeof prev]
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        privacy[setting.key as keyof typeof privacy]
                          ? 'bg-blue-600'
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          privacy[setting.key as keyof typeof privacy]
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Data Actions */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  Azioni sui Dati
                </h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleExportData}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Esporta Dati
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Elimina Account
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSavePreferences}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva Impostazioni
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
