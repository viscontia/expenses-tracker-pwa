import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from 'react';
import { Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { trpc } from "~/trpc/react";
import { useAuthStore } from '~/stores/auth';
import { Globe, BarChart2 } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuthStore();
  
  // Ottieni i dati utente aggiornati tramite tRPC (questo si aggiorna quando vengono salvate le preferenze)
  const { data: currentUser } = trpc.auth.getCurrentUser.useQuery();
  
  // Usa currentUser se disponibile, altrimenti fallback su user da auth store
  const userData = currentUser || user;
  
  // State per i combobox della dashboard - inizializzati con valori di default
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [categoriesLimit, setCategoriesLimit] = useState<number>(10);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Inizializza e aggiorna gli stati quando i dati utente sono disponibili
  useEffect(() => {
    if (userData?.preferences) {
      const prefs = userData.preferences as any;
      const newCurrency = prefs.defaultCurrency || 'EUR';
      const newCategoryLimit = prefs.chartCategoryCount || 10;
      
      // Aggiorna sempre la valuta (sia per inizializzazione che per cambiamenti)
      setSelectedCurrency(newCurrency);
      
      // Aggiorna le categorie solo se non è ancora inizializzato
      if (!isInitialized) {
        setCategoriesLimit(newCategoryLimit);
        setIsInitialized(true);
      }
    }
  }, [userData?.preferences, isInitialized]);

  // Carica le valute disponibili
  const { data: availableCurrencies } = trpc.currency.getAvailableCurrencies.useQuery();

  // Carica la data dell'ultimo aggiornamento valutario
  const { data: lastExchangeUpdate } = trpc.currency.getLastExchangeRateUpdate.useQuery();

  // Aggiorna gli stati quando cambiano le preferenze utente (solo al mount/reload)
  useEffect(() => {
    if (user?.preferences) {
      const prefs = user.preferences as any;
      setSelectedCurrency(prefs.defaultCurrency || 'EUR');
      setCategoriesLimit(prefs.chartCategoryCount || 10);
    }
  }, [user?.preferences]);

  // Query dashboard con parametri dinamici
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.getKpis.useQuery({
    targetCurrency: selectedCurrency,
  });
  
  const { data: chartData, isLoading: chartLoading } = trpc.dashboard.getChartData.useQuery({
    targetCurrency: selectedCurrency,
    topCategoriesLimit: categoriesLimit,
  });
  
  const { data: recentExpenses, isLoading: expensesLoading } = trpc.dashboard.getRecentExpenses.useQuery({
    targetCurrency: selectedCurrency,
    limit: 10,
  });

  if (kpisLoading || chartLoading || expensesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Calcolo month-over-month change
  const monthOverMonthChange = kpis?.totalPreviousMonth 
    ? ((kpis.totalCurrentMonth - kpis.totalPreviousMonth) / kpis.totalPreviousMonth) * 100
    : 0;

  // Calcolo media giornaliera
  const currentDate = new Date();
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const averageDaily = kpis?.totalCurrentMonth ? kpis.totalCurrentMonth / daysInMonth : 0;

  // Trova la categoria top
  const topCategory = chartData?.categoryExpenses && chartData.categoryExpenses.length > 0 
    ? chartData.categoryExpenses[0]
    : null;

  // Trova il simbolo della valuta selezionata
  const currencySymbol = availableCurrencies?.find(c => c.code === selectedCurrency)?.symbol || selectedCurrency;

  const doughnutData = {
    labels: chartData?.categoryExpenses?.map((item: any) => item.name) || [],
    datasets: [
      {
        data: chartData?.categoryExpenses?.map((item: any) => item.amount) || [],
        backgroundColor: [
          "#FF6384",
          "#36A2EB", 
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
          "#FF9F40",
          "#FF6F61",
          "#6B5B95",
          "#88D8C0",
          "#F7DC6F",
        ],
        borderWidth: 2,
      },
    ],
  };

  const lineData = {
    labels: chartData?.monthlyTrend?.map((item: any) => item.month) || [],
    datasets: [
      {
        label: `Spese Mensili (${selectedCurrency})`,
        data: chartData?.monthlyTrend?.map((item: any) => item.amount) || [],
        borderColor: "#36A2EB",
        backgroundColor: "rgba(54, 162, 235, 0.1)",
        tension: 0.4,
      },
    ],
  };

  // Opzioni per i combobox
  const categoryLimitOptions = [
    { value: 5, label: '5' },
    { value: 10, label: '10' },
    { value: 15, label: '15' },
    { value: 20, label: '20' },
    { value: 25, label: '25' },
    { value: 30, label: '30' },
    { value: 35, label: '35' },
    { value: 40, label: '40' },
    { value: 45, label: '45' },
    { value: 50, label: '50' },
    { value: 999, label: 'Tutte' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        
        {/* Combobox Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
          {/* Currency Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Globe className="h-4 w-4 inline mr-1" />
              Valuta di Visualizzazione
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
            >
              {availableCurrencies?.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code}
                </option>
              ))}
            </select>
          </div>

          {/* Categories Limit Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <BarChart2 className="h-4 w-4 inline mr-1" />
              Categorie Visualizzate
            </label>
            <select
              value={categoriesLimit}
              onChange={(e) => setCategoriesLimit(parseInt(e.target.value))}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
            >
              {categoryLimitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Exchange Rate Last Update */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ultimo Aggiornamento
            </label>
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-700 dark:text-gray-300 min-w-[180px] text-sm">
              {lastExchangeUpdate?.success && lastExchangeUpdate.lastUpdateDate
                ? `Valute aggiornate al ${new Date(lastExchangeUpdate.lastUpdateDate).toLocaleDateString('it-IT')}`
                : 'Aggiornamento non disponibile'
              }
            </div>
          </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Spese Questo Mese</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {currencySymbol}{kpis?.totalCurrentMonth?.toFixed(2) || '0.00'}
          </p>
          <p className={`text-sm ${monthOverMonthChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {monthOverMonthChange >= 0 ? '+' : ''}{monthOverMonthChange.toFixed(1)}% dal mese scorso
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Transazioni</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpis?.transactionCount || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Questo mese</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Media Giornaliera</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {currencySymbol}{averageDaily.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Basata su questo mese</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria Top</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{topCategory?.name || 'N/A'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currencySymbol}{topCategory?.amount?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Spese per Categoria ({categoriesLimit === 999 ? 'Tutte' : `Top ${categoriesLimit}`})
          </h3>
          <div className="h-64">
            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Trend Mensile</h3>
          <div className="h-64">
            <Line data={lineData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Spese Recenti</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Descrizione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Valuta Originale
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Importo ({selectedCurrency})
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentExpenses?.map((expense: any) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {new Date(expense.date).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {expense.description || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {expense.category?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {expense.originalCurrency} {expense.originalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {currencySymbol}{expense.convertedAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
