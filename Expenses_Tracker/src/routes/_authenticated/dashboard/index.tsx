import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement,
  BarElement 
} from "chart.js";
import { trpc } from "~/trpc/react";
import { useAuthStore } from '~/stores/auth';
import { Globe, BarChart2, TrendingUp, Clock, RefreshCw, Download, Filter, Calendar } from 'lucide-react';
import { RateIndicator } from '~/components/RateIndicator';
import { ExchangeRateStatusIndicator } from '~/components/ExchangeRateStatusIndicator';
import { calculateTotalInCurrency, calculateKPIsForPeriod, ExpenseForCalculation } from '~/utils/currencyCalculations';
import { formatCurrency, formatNumber } from '~/utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

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
  
  // 📅 FILTRI TEMPORALI - Nuovi stati per interattività
  const [timeFilter, setTimeFilter] = useState<'7d' | '30d' | '90d' | 'mom' | 'ytd' | 'current' | 'previous' | 'yoy'>('current');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  
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
  
  // 📊 CALCOLO DATE RANGE basato su filtro temporale
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case '7d':
        return {
          start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: today.toISOString()
        };
      case '30d':
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: today.toISOString()
        };
      case '90d':
        return {
          start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          end: today.toISOString()
        };
      case 'mom':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
          start: startOfLastMonth.toISOString(),
          end: endOfThisMonth.toISOString()
        };
      case 'ytd':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return {
          start: startOfYear.toISOString(),
          end: today.toISOString()
        };
      case 'previous':
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          start: startOfPreviousMonth.toISOString(),
          end: endOfPreviousMonth.toISOString()
        };
      case 'yoy':
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return {
          start: startOfLastYear.toISOString(),
          end: endOfLastYear.toISOString()
        };
      case 'current':
      default:
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          start: startOfCurrentMonth.toISOString(),
          end: endOfCurrentMonth.toISOString()
        };
    }
  }, [timeFilter]);
  
  const { data: expensesData, isLoading: expensesLoading } = trpc.expenses.getExpenses.useQuery({
    categoryIds: selectedCategory ? [selectedCategory] : undefined,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  
  const expenses = expensesData?.expenses || [];
  
  // Calcola il range del mese precedente
  const previousMonthRange = useMemo(() => {
    const now = new Date();
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return {
      start: startOfPreviousMonth.toISOString(),
      end: endOfPreviousMonth.toISOString(),
    };
  }, []);

  // Query per le spese del mese precedente
  const { data: previousExpensesData } = trpc.expenses.getExpenses.useQuery({
    categoryIds: selectedCategory ? [selectedCategory] : undefined,
    startDate: previousMonthRange.start,
    endDate: previousMonthRange.end,
  });
  const previousExpenses = previousExpensesData?.expenses || [];

  // 🔍 DEBUG: Log per verificare le spese caricate (solo per test)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Dashboard Debug - timeFilter:', timeFilter);
    console.log('🔍 Dashboard Debug - dateRange start:', dateRange.start);
    console.log('🔍 Dashboard Debug - dateRange end:', dateRange.end);
    console.log('🔍 Dashboard Debug - expensesCount:', expenses.length);
    console.log('🔍 Dashboard Debug - totalCalculated:', calculateTotalInCurrency(expenses as ExpenseForCalculation[], selectedCurrency || 'EUR'));
  }
  
  // ✅ CALCOLI KPI FRONTEND - Usa spese già filtrate dal backend
  const kpis = useMemo(() => {
    if (!expenses.length) return null;
    
    // Usa direttamente le spese già filtrate dal backend tramite dateRange
    // Non serve filtrare di nuovo, le spese sono già corrette per il periodo selezionato
    
    // Calcola totale per il periodo
    const totalForPeriod = calculateTotalInCurrency(expenses as ExpenseForCalculation[], selectedCurrency || 'EUR');
    
    return {
      totalCurrentMonth: totalForPeriod,
      totalPreviousMonth: 0, // Non utilizzato per filtri personalizzati
      transactionCount: expenses.length,
      averageAmount: expenses.length > 0 ? totalForPeriod / expenses.length : 0
    };
  }, [expenses, selectedCurrency]);

  // Usa la query ottimizzata per i dati dashboard
  const { data: chartData } = trpc.dashboard.getChartData.useQuery({
    targetCurrency: selectedCurrency || 'EUR',
  });

  // Trend mensile e labels dai dati backend
  const monthlyTrend = chartData?.monthlyTrend?.map(item => item.amount) || [];
  const monthLabels = chartData?.monthlyTrend?.map(item => item.month) || [];

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

  // Calcolo media giornaliera - Basata sul periodo selezionato
  const dailyAverage = useMemo(() => {
    if (!kpis?.totalCurrentMonth) return 0;
    
    // Calcola i giorni nel periodo selezionato
    const now = new Date();
    let daysInPeriod: number;
    
    switch (timeFilter) {
      case 'previous':
        daysInPeriod = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
        break;
      case 'yoy':
        daysInPeriod = 365; // Anno completo
        break;
      case '7d':
        daysInPeriod = 7;
        break;
      case '30d':
        daysInPeriod = 30;
        break;
      case '90d':
        daysInPeriod = 90;
        break;
      case 'current':
      default:
        daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        break;
    }
    
    return kpis.totalCurrentMonth / daysInPeriod;
  }, [kpis?.totalCurrentMonth, timeFilter]);

  // previousMonthData ora usa previousExpenses
  const previousMonthData = useMemo(() => {
    if (!previousExpenses.length || !categories) return [];
    const categoryTotals = new Map<number, number>();
    previousExpenses.forEach(expense => {
      const currentTotal = categoryTotals.get(expense.categoryId) || 0;
      const convertedAmount = calculateTotalInCurrency([expense as ExpenseForCalculation], selectedCurrency || 'EUR');
      categoryTotals.set(expense.categoryId, currentTotal + convertedAmount);
    });
    return Array.from(categoryTotals.entries()).map(([categoryId, amount]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        id: categoryId,
        name: category?.name || 'Unknown',
        amount,
      };
    });
  }, [previousExpenses, categories, selectedCurrency]);

  // === AGGIUNGI QUESTA PARTE SUBITO DOPO previousMonthData ===
  const mergedCategories = useMemo(() => {
    if (!chartData?.categoryExpenses || !previousMonthData) return [];
    const allCategoryIds = new Set([
      ...chartData.categoryExpenses.map(c => c.id),
      ...previousMonthData.map(c => c.id),
    ]);
    return Array.from(allCategoryIds).map(id => {
      const current = chartData.categoryExpenses.find(c => c.id === id);
      const previous = previousMonthData.find(c => c.id === id);
      return {
        id,
        name: current?.name || previous?.name || 'Unknown',
        currentAmount: current?.amount || 0,
        previousAmount: previous?.amount || 0,
      };
    });
  }, [chartData?.categoryExpenses, previousMonthData]);

  // Handlers per UI
  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  }, []);

  const handleTimeFilterChange = useCallback((filter: '7d' | '30d' | '90d' | 'mom' | 'ytd' | 'current' | 'previous' | 'yoy') => {
    setTimeFilter(filter);
  }, []);

  const handleCategoryClick = useCallback((categoryId: number) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
  }, [selectedCategory]);

  const handleExportChart = useCallback((chartId: string) => {
    const canvas = document.getElementById(chartId) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${chartId}-export.png`;
      link.href = url;
      link.click();
    }
  }, []);

  // 📅 HELPER per etichette dinamiche basate sul periodo selezionato
  const getPeriodLabel = useMemo(() => {
    const now = new Date();
    const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                       'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    
    switch (timeFilter) {
      case 'current':
        const currentMonthName = monthNames[now.getMonth()];
        const currentYear = now.getFullYear();
        return `mese di ${currentMonthName} ${currentYear}`;
        
      case 'previous':
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const prevMonthName = monthNames[prevMonth];
        return `mese di ${prevMonthName} ${prevYear}`;
        
      case 'yoy':
        const lastYear = now.getFullYear() - 1;
        return `anno ${lastYear}`;
        
      case '7d':
        return 'ultimi 7 giorni';
        
      case '30d':
        return 'ultimi 30 giorni';
        
      case '90d':
        return 'ultimi 90 giorni';
        
      case 'mom':
        const currentMonthNameMoM = monthNames[now.getMonth()];
        const currentYearMoM = now.getFullYear();
        const prevMonthMoM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYearMoM = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const prevMonthNameMoM = monthNames[prevMonthMoM];
        return `${prevMonthNameMoM} ${prevYearMoM} vs ${currentMonthNameMoM} ${currentYearMoM}`;
        
      case 'ytd':
        const currentYearYTD = now.getFullYear();
        return `anno ${currentYearYTD} (YTD)`;
        
      default:
        const defaultMonthName = monthNames[now.getMonth()];
        const defaultYear = now.getFullYear();
        return `mese di ${defaultMonthName} ${defaultYear}`;
    }
  }, [timeFilter]);

  // ===== TUTTI GLI HOOK DEVONO ESSERE SOPRA QUESTA LINEA =====
  
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
            return `${context.label}: ${formatCurrency(value, selectedCurrency ?? 'EUR')} (${percentage}%)`;
          }
        }
      }
    },
  };

  // Configurazione grafico lineare con dati reali
  const lineChartData = {
    labels: monthLabels,
    datasets: [
      {
        label: `Spese (${selectedCurrency ?? 'EUR'})`,
        data: monthlyTrend,
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
          {/* Filtri temporali */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Periodo</span>
            <select
              value={timeFilter}
              onChange={(e) => handleTimeFilterChange(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="current">Mese Corrente</option>
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="90d">Ultimi 90 giorni</option>
              <option value="mom">MoM (2 mesi)</option>
              <option value="previous">Mese Precedente</option>
              <option value="ytd">Year to Date</option>
              <option value="yoy">YoY (Anno Precedente)</option>
            </select>
          </div>

          {/* Controllo valuta */}
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Valuta</span>
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

          {/* Filtro categoria attivo */}
          {selectedCategory && (
            <div className="flex items-center gap-2 bg-blue-600/20 px-3 py-2 rounded-md border border-blue-500/30">
              <Filter className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">
                {categories?.find(c => c.id === selectedCategory)?.name}
              </span>
              <button 
                onClick={() => setSelectedCategory(null)}
                className="text-blue-400 hover:text-blue-300 ml-1"
              >
                ×
              </button>
            </div>
          )}

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
                              <p className="text-sm font-medium text-gray-400">Spese {getPeriodLabel}</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(kpis?.totalCurrentMonth || 0, selectedCurrency ?? 'EUR')}
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
                              <p className="text-sm text-gray-400">{getPeriodLabel}</p>
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
                {formatCurrency(dailyAverage || 0, selectedCurrency || 'EUR')}
              </p>
                              <p className="text-sm text-gray-400">Basata su {getPeriodLabel}</p>
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
                {formatCurrency(topCategory?.amount || 0, selectedCurrency || 'EUR')}
              </p>
            </div>
            <Globe className="h-8 w-8 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Grafici - Layout riorganizzato: 2 grafici per riga */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Donut Chart - Spese per Categoria */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Spese per Categoria - {getPeriodLabel}</h3>
            <button 
              onClick={() => handleExportChart('donut-chart')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Esporta grafico"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80">
            <Doughnut 
              id="donut-chart"
              data={{
                labels: chartData?.categoryExpenses?.map(cat => cat.name) || [],
                datasets: [{
                  data: chartData?.categoryExpenses?.map(cat => cat.amount) || [],
                  backgroundColor: [
                    '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
                    '#EF4444', '#EC4899', '#84CC16', '#6366F1',
                    '#F97316', '#14B8A6'
                  ],
                  borderWidth: 2,
                  borderColor: '#1F2937',
                  hoverBorderWidth: 3,
                  hoverBorderColor: '#FFFFFF',
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%', // Questo rende il grafico un donut invece di pie
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
                        return `${context.label}: ${formatCurrency(value, selectedCurrency || 'EUR')} (${percentage}%)`;
                      }
                    }
                  }
                },
                onClick: (event, elements) => {
                  if (elements.length > 0 && chartData?.categoryExpenses) {
                    const index = elements[0].index;
                    const categoryId = chartData.categoryExpenses[index]?.id;
                    if (categoryId) handleCategoryClick(categoryId);
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* 2. Horizontal Bar Chart - Importi per Categoria */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Ranking Categorie - {getPeriodLabel}</h3>
            <button 
              onClick={() => handleExportChart('horizontal-bar-chart')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Esporta grafico"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80">
            <Bar
              id="horizontal-bar-chart"
              data={{
                labels: (chartData?.categoryExpenses || []).map(cat => cat.name),
                datasets: [{
                  label: `Importo (${selectedCurrency ?? 'EUR'})`,
                  data: (chartData?.categoryExpenses || []).map(cat => cat.amount),
                  backgroundColor: (chartData?.categoryExpenses || []).map((_, index) => [
                    '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
                    '#EF4444', '#EC4899', '#84CC16', '#6366F1',
                    '#F97316', '#14B8A6'
                  ][index % 10]) || [],
                  borderWidth: 1,
                  borderColor: '#374151',
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y' as const, // Questo rende il grafico orizzontale
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#F9FAFB',
                    bodyColor: '#F9FAFB',
                    borderColor: '#374151',
                    borderWidth: 1,
                    callbacks: {
                      label: function(context: any) {
                        return `${context.dataset.label}: ${formatCurrency(context.parsed.x, selectedCurrency || 'EUR')}`;
                      }
                    }
                  }
                },
                scales: {
                  x: {
                    ticks: {
                      color: '#9CA3AF',
                      callback: function(value: any) {
                        return formatCurrency(value, selectedCurrency || 'EUR');
                      }
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
                onClick: (event, elements) => {
                  if (elements.length > 0 && (chartData?.categoryExpenses || []).length > 0) {
                    const index = elements[0].index;
                    const categoryId = (chartData?.categoryExpenses || [])[index]?.id;
                    if (categoryId) handleCategoryClick(categoryId);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* 3. Grouped Bar Chart - Confronto Mese Corrente vs Precedente (spostato sulla seconda riga) */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Confronto Mensile</h3>
            <button 
              onClick={() => handleExportChart('grouped-bar-chart')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Esporta grafico"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80">
            <Bar
              id="grouped-bar-chart"
              data={{
                labels: mergedCategories.map(cat => cat.name),
                datasets: [
                  {
                    label: 'Mese Corrente',
                    data: mergedCategories.map(cat => cat.currentAmount),
                    backgroundColor: '#8B5CF6',
                    borderColor: '#A855F7',
                    borderWidth: 1,
                  },
                  {
                    label: 'Mese Precedente',
                    data: mergedCategories.map(cat => cat.previousAmount),
                    backgroundColor: '#06B6D4',
                    borderColor: '#0891B2',
                    borderWidth: 1,
                  }
                ]
              }}
              options={{
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
                    callbacks: {
                      label: function(context: any) {
                        return `${context.dataset.label}: ${formatCurrency(context.parsed.y, selectedCurrency || 'EUR')}`;
                      }
                    }
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
                      callback: function(value: any) {
                        return formatCurrency(value, selectedCurrency || 'EUR');
                      }
                    },
                    grid: {
                      color: '#374151',
                    },
                  },
                },
                onClick: (event, elements) => {
                  if (elements.length > 0 && chartData?.categoryExpenses) {
                    const index = elements[0].index;
                    const categoryId = chartData.categoryExpenses[index]?.id;
                    if (categoryId) handleCategoryClick(categoryId);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* 4. Grafico Lineare - Trend Mensile (ora con spazio proporzionato) */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Trend Mensile</h3>
            <button 
              onClick={() => handleExportChart('line-chart')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Esporta grafico"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="h-80">
            <Line 
              id="line-chart"
              data={lineChartData} 
              options={{
                ...lineChartOptions,
                plugins: {
                  ...lineChartOptions.plugins,
                  tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#F9FAFB',
                    bodyColor: '#F9FAFB',
                    borderColor: '#374151',
                    borderWidth: 1,
                    callbacks: {
                      label: function(context: any) {
                        return `${context.dataset.label}: ${formatCurrency(context.parsed.y, selectedCurrency || 'EUR')}`;
                      }
                    }
                  }
                }
              }} 
            />
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
