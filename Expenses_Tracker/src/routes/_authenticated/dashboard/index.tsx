import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { trpc } from "~/trpc/react";
import { useAuthStore } from '~/stores/auth';
import { Globe, BarChart2, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { RateIndicator } from '~/components/RateIndicator';
import { ExchangeRateStatusIndicator } from '~/components/ExchangeRateStatusIndicator';
import { calculateTotalInCurrency, calculateKPIsForPeriod, ExpenseForCalculation } from '~/utils/currencyCalculations';
import { formatCurrency, formatNumber } from '~/utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuthStore();
  // ✅ RIMOSSO categoriesLimit - Mostra sempre tutte le categorie
  
  // ✅ VALUTA DEFAULT - IDENTICA logica elenco spese
  const defaultCurrency = useAuthStore((state) => state.user?.preferences?.defaultCurrency);
  
  // ✅ STATO VALUTA - Inizializza con preferenza utente (come elenco spese)
  const [selectedCurrency, setSelectedCurrency] = useState<string>(defaultCurrency || 'EUR');
  
  // ✅ SYNC VALUTA - Stessa logica elenco spese per aggiornamenti settings
  useEffect(() => {
    if (defaultCurrency) {
      setSelectedCurrency(defaultCurrency);
    }
  }, [defaultCurrency]);
  
  // ✅ QUERY DATI - Solo quello che serve
  const { data: availableCurrencies } = trpc.currency.getAvailableCurrencies.useQuery();
  const { data: lastExchangeUpdate } = trpc.currency.getLastExchangeRateUpdate.useQuery();
  const { data: categories } = trpc.categories.getAll.useQuery();
  
  // ✅ SPESE RAW - COPIA ESATTA elenco spese che FUNZIONA
  const selectedCategory = undefined; // Nessuna categoria filtrata
  const dateRange = { start: undefined, end: undefined }; // Nessun filtro date
  
  const { data: expensesData, isLoading: expensesLoading } = trpc.expenses.getExpenses.useQuery({
    categoryIds: selectedCategory ? [selectedCategory] : undefined, // IDENTICO all'elenco spese
    startDate: dateRange.start,   // IDENTICO all'elenco spese
    endDate: dateRange.end,       // IDENTICO all'elenco spese
    // ✅ RIMOSSO LIMITE - Carica TUTTE le spese per dashboard completa
  });
  
  const expenses = expensesData?.expenses || [];
  
  // ✅ CALCOLI KPI FRONTEND - Stessa logica dell'elenco spese
  const kpis = useMemo(() => {
    if (!expenses.length) return null;
    return calculateKPIsForPeriod(expenses as ExpenseForCalculation[], selectedCurrency);
  }, [expenses, selectedCurrency]);

  // ✅ CALCOLI GRAFICI FRONTEND - Logica semplice e funzionante
  const chartData = useMemo(() => {
    if (!expenses.length || !categories) return null;
    
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Filtra spese mese corrente
    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= startOfCurrentMonth && expenseDate <= endOfCurrentMonth;
    });
    
    // Raggruppa per categoria
    const categoryTotals = new Map<number, number>();
    currentMonthExpenses.forEach(expense => {
      const currentTotal = categoryTotals.get(expense.categoryId) || 0;
      // Usa stessa logica calculateTotalInCurrency per singola spesa
      const convertedAmount = calculateTotalInCurrency([expense as ExpenseForCalculation], selectedCurrency || 'EUR');
      categoryTotals.set(expense.categoryId, currentTotal + convertedAmount);
    });
    
    // Ordina categorie per totale
    const categoryExpenses = Array.from(categoryTotals.entries())
      .sort(([, a], [, b]) => b - a)
      // ✅ NESSUN LIMITE - Mostra tutte le categorie
      .map(([categoryId, amount]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          id: categoryId,
          name: category?.name || 'Unknown',
          amount,
        };
      });
    
    // 📊 CALCOLO TREND MENSILE - Ultimi 6 mesi
    const monthlyTrend = useMemo(() => {
      if (!expenses || expenses.length === 0) return [0, 0, 0, 0, 0, 0];
      
      const now = new Date();
      const monthlyTotals: number[] = [];
      
      // Calcola totali per gli ultimi 6 mesi (da 5 mesi fa a questo mese)
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();
        
        // Filtra spese per questo mese specifico
        const monthExpenses = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
        });
        
        // Calcola totale per questo mese nella valuta selezionata
        const monthTotal = calculateTotalInCurrency(monthExpenses, selectedCurrency || 'EUR');
        monthlyTotals.push(monthTotal);
      }
      
      return monthlyTotals;
    }, [expenses, selectedCurrency]);
    
    return { categoryExpenses, monthlyTrend };
  }, [expenses, categories, selectedCurrency]);

  // Categoria top - dal chartData calcolato
  const topCategory = useMemo(() => {
    return chartData?.categoryExpenses && chartData.categoryExpenses.length > 0 
      ? chartData.categoryExpenses[0]
      : null;
  }, [chartData?.categoryExpenses]);

  // Calcolo month-over-month change - USANDO KPI CALCOLATI
  const monthOverMonthChange = useMemo(() => {
    if (!kpis?.totalCurrentMonth || !kpis?.totalPreviousMonth) return null;
    const change = ((kpis.totalCurrentMonth - kpis.totalPreviousMonth) / kpis.totalPreviousMonth) * 100;
    return isFinite(change) ? change : 0;
  }, [kpis?.totalCurrentMonth, kpis?.totalPreviousMonth]);

  // Calcolo media giornaliera - USANDO KPI CALCOLATI
  const dailyAverage = useMemo(() => {
    if (!kpis?.totalCurrentMonth) return 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return kpis.totalCurrentMonth / daysInMonth;
  }, [kpis?.totalCurrentMonth]);

  // Handlers per UI
  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  }, []);

  // ✅ RIMOSSO handleCategoriesLimitChange - Non più necessario

  // Mostra loading quando le query sono in corso
  if (expensesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Se non ci sono dati, mostra messaggio
  if (!kpis && !chartData && !availableCurrencies) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <p className="text-gray-300 text-center">Carica i dati della dashboard cliccando il pulsante "Ricarica Dashboard"</p>
        </div>
      </div>
    );
  }

  // Configurazione grafico a torta
  const pieChartData = {
    labels: chartData?.categoryExpenses?.map(cat => cat.name) || [],
    datasets: [
      {
        data: chartData?.categoryExpenses?.map(cat => cat.amount) || [],
        backgroundColor: [
          '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
          '#EF4444', '#EC4899', '#84CC16', '#6366F1',
          '#F97316', '#14B8A6'
        ],
        borderWidth: 0,
      },
    ],
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#9CA3AF',
          padding: 15,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: '#1F2937',
        titleColor: '#F9FAFB',
        bodyColor: '#F9FAFB',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
                     label: function(context: any) {
             const value = context.parsed;
             const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
             const percentage = formatNumber((value / total) * 100, 1);
             return `${context.label}: ${formatCurrency(value, selectedCurrency)} (${percentage}%)`;
           }
        }
      }
    },
  };

  // 🏷️ ETICHETTE DINAMICHE - Ultimi 6 mesi reali
  const monthLabels = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(monthNames[targetDate.getMonth()]);
    }
    
    return labels;
  }, []);

  // Configurazione grafico lineare con dati reali
  const lineChartData = {
    labels: monthLabels,
    datasets: [
      {
        label: `Spese (${selectedCurrency || 'EUR'})`,
        data: chartData?.monthlyTrend || [0, 0, 0, 0, 0, 0],
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#9CA3AF',
        },
      },
      tooltip: {
        backgroundColor: '#1F2937',
        titleColor: '#F9FAFB',
        bodyColor: '#F9FAFB',
        borderColor: '#374151',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: '#374151',
        },
      },
      y: {
        ticks: {
          color: '#9CA3AF',
        },
        grid: {
          color: '#374151',
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header con controlli */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="text-blue-400" />
          Dashboard
        </h1>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Controllo valuta */}
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Valuta di Visualizzazione</span>
            <select
              value={selectedCurrency}
              onChange={handleCurrencyChange}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                           {availableCurrencies?.map((currency) => (
               <option key={currency.code} value={currency.code}>
                 {currency.symbol} {currency.code}
               </option>
             ))}
            </select>
          </div>

          {/* ✅ RIMOSSO controllo categorie - Mostra sempre tutte */}

          {/* Status tassi di cambio */}
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Ultimo Aggiornamento</span>
                         <span className="text-sm text-blue-400">
               {lastExchangeUpdate?.lastUpdateDate ? new Date(lastExchangeUpdate.lastUpdateDate).toLocaleDateString('it-IT') : 'Mai'}
             </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Spese Questo Mese */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Spese Questo Mese</p>
                             <p className="text-2xl font-bold text-white">
                 {formatCurrency(kpis?.totalCurrentMonth || 0, selectedCurrency)}
               </p>
              <p className={`text-sm ${monthOverMonthChange && monthOverMonthChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                                 {monthOverMonthChange !== null ? `${monthOverMonthChange >= 0 ? '+' : ''}${formatNumber(monthOverMonthChange, 1)}% dal mese scorso` : ''}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        {/* Transazioni */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Transazioni</p>
              <p className="text-2xl font-bold text-white">{kpis?.transactionCount || 0}</p>
              <p className="text-sm text-gray-400">Questo mese</p>
            </div>
            <BarChart2 className="h-8 w-8 text-green-400" />
          </div>
        </div>

        {/* Media Giornaliera */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Media Giornaliera</p>
                             <p className="text-2xl font-bold text-white">
                 {formatCurrency(dailyAverage || 0, selectedCurrency)}
               </p>
              <p className="text-sm text-gray-400">Basata su questo mese</p>
            </div>
            <Clock className="h-8 w-8 text-purple-400" />
          </div>
        </div>

        {/* Categoria Top */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Categoria Top</p>
              <p className="text-2xl font-bold text-white">{topCategory?.name || 'N/A'}</p>
                             <p className="text-sm text-gray-400">
                 {formatCurrency(topCategory?.amount || 0, selectedCurrency)}
               </p>
            </div>
            <Globe className="h-8 w-8 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafico a Torta - Spese per Categoria */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Spese per Categoria</h3>
          <div className="h-80">
            <Doughnut data={pieChartData} options={pieChartOptions} />
          </div>
        </div>

        {/* Grafico Lineare - Trend Mensile */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Trend Mensile</h3>
          <div className="h-80">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>
      </div>

      {/* Status e Rate Indicator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
           <h3 className="text-lg font-semibold text-white mb-4">Tassi di Cambio</h3>
           <div className="text-gray-300">
             <p>Informazioni sui tassi di cambio disponibili nel sistema</p>
           </div>
         </div>
        
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Stato Sistema</h3>
          <ExchangeRateStatusIndicator />
        </div>
      </div>
    </div>
  );
}
