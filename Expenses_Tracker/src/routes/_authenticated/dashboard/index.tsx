import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { trpc } from "~/trpc/react";
import { Globe, BarChart2, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { RateIndicator } from '~/components/RateIndicator';
import { ExchangeRateStatusIndicator } from '~/components/ExchangeRateStatusIndicator';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

// Variabile globale per il debounce e controllo manual trigger
declare global {
  interface Window {
    lastRefreshTime?: number;
    dashboardManualTrigger?: boolean;
  }
}

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Dashboard,
});

// Componente inline per cache metrics
function InlineCacheMetrics() {
  const { data: cacheMetrics, isLoading } = trpc.currency.getCacheMetrics.useQuery(
    undefined,
    {
      refetchInterval: 30000, // 30 secondi
      retry: 1
    }
  );

  if (isLoading) {
    return <div className="text-xs text-gray-500">Caricando...</div>;
  }

  if (!cacheMetrics?.success || !cacheMetrics.status) {
    return <div className="text-xs text-gray-500">Cache non disponibile</div>;
  }

  const { status } = cacheMetrics;

  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Entries:</span>
        <span className="font-medium text-gray-900 dark:text-white">{status.size}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">Hit Rate:</span>
        <span className={`font-medium ${status.hitRate > 0.8 ? 'text-green-600' : status.hitRate > 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
          {Math.round(status.hitRate * 100)}%
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">API Calls Saved:</span>
        <span className="font-medium text-blue-600 dark:text-blue-400">{status.apiCallsSaved}</span>
      </div>
    </div>
  );
}

function Dashboard() {
  console.log('🏠 Dashboard component rendering at:', new Date().toISOString());
  
  // State per i combobox della dashboard - VALORI FISSI per evitare re-render
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [categoriesLimit, setCategoriesLimit] = useState<number>(10);
  
  // TIMER DI SICUREZZA: Previeni auto-trigger nei primi 2 secondi dopo il mount
  const [componentMountTime] = useState<number>(Date.now());
  
  // FLAG PER TRACCIARE SE L'UTENTE HA MAI INTERAGITO CON LA PAGINA
  const [userHasInteracted, setUserHasInteracted] = useState<boolean>(false);

  // EFFECT PER TRACCIARE INTERAZIONI UTENTE REALI
  useEffect(() => {
    const handleUserInteraction = () => {
      console.log('👤 Real user interaction detected');
      setUserHasInteracted(prev => {
        if (!prev) {
          console.log('👤 First user interaction - enabling dashboard');
          return true;
        }
        return prev; // Non causare re-render se già true
      });
    };

    // SOLO se l'utente non ha ancora interagito, aggiungi i listener
    if (!userHasInteracted) {
      console.log('👂 Adding user interaction listeners');
      document.addEventListener('mousedown', handleUserInteraction, { once: true });
      document.addEventListener('keydown', handleUserInteraction, { once: true });
      document.addEventListener('touchstart', handleUserInteraction, { once: true });
    }

    return () => {
      if (!userHasInteracted) {
        console.log('🧹 Cleaning up user interaction listeners');
        document.removeEventListener('mousedown', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      }
    };
  }, [userHasInteracted]);

  // MEMOIZZA I PARAMETRI DELLE QUERY per evitare re-render
  const kpisParams = useMemo(() => ({
    targetCurrency: selectedCurrency,
  }), [selectedCurrency]);

  const chartDataParams = useMemo(() => ({
    targetCurrency: selectedCurrency,
    topCategoriesLimit: categoriesLimit,
  }), [selectedCurrency, categoriesLimit]);

  const recentExpensesParams = useMemo(() => ({
    targetCurrency: selectedCurrency,
    limit: 10,
  }), [selectedCurrency]);

  // STATE UNIFICATO PER GESTIRE TUTTO IN MODO BATCH
  const [dashboardState, setDashboardState] = useState<{
    data: {
      availableCurrencies?: any;
      lastExchangeUpdate?: any;
      kpis?: any;
      chartData?: any;
      recentExpenses?: any;
    };
    isLoaded: boolean;
    isRefreshing: boolean;
  }>({
    data: {},
    isLoaded: false,
    isRefreshing: false,
  });

  // QUERY OPTIONS MEMOIZZATE - COMPLETAMENTE DISABILITATE
  const queryOptions = useMemo(() => ({
    enabled: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false as const,
    retry: false,
  }), []);

  // Query hooks - SOLO per ottenere le funzioni refetch
  const { refetch: refetchCurrencies } = trpc.currency.getAvailableCurrencies.useQuery(undefined, queryOptions);
  const { refetch: refetchExchangeUpdate } = trpc.currency.getLastExchangeRateUpdate.useQuery(undefined, queryOptions);
  const { refetch: refetchKpis } = trpc.dashboard.getKpis.useQuery(kpisParams, queryOptions);
  const { refetch: refetchChartData } = trpc.dashboard.getChartData.useQuery(chartDataParams, queryOptions);
  const { refetch: refetchRecentExpenses } = trpc.dashboard.getRecentExpenses.useQuery(recentExpensesParams, queryOptions);

  // Estrai i dati e stati dal state unificato
  const { data, isLoaded: isDashboardLoaded, isRefreshing } = dashboardState;
  const { availableCurrencies, lastExchangeUpdate, kpis, chartData, recentExpenses } = data;
  
  // Loading states calcolati
  const kpisLoading = isRefreshing && !kpis;
  const chartLoading = isRefreshing && !chartData;
  const expensesLoading = isRefreshing && !recentExpenses;

  // Calcolo month-over-month change
  const monthOverMonthChange = kpis?.totalPreviousMonth 
    ? ((kpis.totalCurrentMonth - kpis.totalPreviousMonth) / kpis.totalPreviousMonth) * 100
    : 0;

  // Calcolo media giornaliera - MEMOIZED per evitare re-render
  const averageDaily = useMemo(() => {
    if (!kpis?.totalCurrentMonth) return 0;
    const currentDate = new Date();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    return kpis.totalCurrentMonth / daysInMonth;
  }, [kpis?.totalCurrentMonth]);

  // Trova la categoria top - MEMOIZED
  const topCategory = useMemo(() => {
    return chartData?.categoryExpenses && chartData.categoryExpenses.length > 0 
      ? chartData.categoryExpenses[0]
      : null;
  }, [chartData?.categoryExpenses]);

  // Trova il simbolo della valuta selezionata - MEMOIZED
  const currencySymbol = useMemo(() => {
    return availableCurrencies?.find((c: any) => c.code === selectedCurrency)?.symbol || selectedCurrency;
  }, [availableCurrencies, selectedCurrency]);

  // Colori statici per i chart - COSTANTE
  const CHART_COLORS = useMemo(() => [
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
  ], []);

  // MEMOIZED CHART OPTIONS - Previene re-render infiniti di Chart.js
  const chartOptions = useMemo(() => ({
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  }), []);

  // MEMOIZED CHART DATA - Previene re-render infiniti di Chart.js
  const doughnutData = useMemo(() => ({
    labels: chartData?.categoryExpenses?.map((item: any) => item.name) || [],
    datasets: [
      {
        data: chartData?.categoryExpenses?.map((item: any) => item.amount) || [],
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
      },
    ],
  }), [chartData?.categoryExpenses, CHART_COLORS]);

  const lineData = useMemo(() => ({
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
  }), [chartData?.monthlyTrend, selectedCurrency]);

  // Opzioni per i combobox - MEMOIZED
  const categoryLimitOptions = useMemo(() => [
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
  ], []);

  // Handlers memoizzati per evitare re-render
  const handleCurrencyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrency(e.target.value);
  }, []);

  const handleCategoriesLimitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoriesLimit(parseInt(e.target.value));
  }, []);

  // Funzione per refresh manuale della dashboard - SOLO CHIAMATE MANUALI
  const handleRefreshDashboard = useCallback(async (manualTrigger: boolean = false) => {
    const refreshId = Date.now();
    console.log(`🔄 [${refreshId}] handleRefreshDashboard STARTED, isRefreshing:`, isRefreshing, 'isDashboardLoaded:', isDashboardLoaded, 'manualTrigger:', manualTrigger);
    
    // BLOCCA TUTTE LE CHIAMATE AUTOMATICHE - SOLO MANUALI PERMESSE
    if (!manualTrigger) {
      console.log(`🚫 [${refreshId}] Non-manual trigger blocked - only explicit user actions allowed`);
      return;
    }

    // Previeni chiamate multiple CON CONTROLLO AGGIUNTIVO
    if (isRefreshing) {
      console.log(`⚠️ [${refreshId}] Already refreshing, skipping`);
      return;
    }

    // AGGIUNGI UN DEBOUNCE PER PREVENIRE CHIAMATE RAPIDE SUCCESSIVE
    if (Date.now() - (window.lastRefreshTime || 0) < 1000) {
      console.log(`⚠️ [${refreshId}] Refresh called too quickly, skipping`);
      return;
    }
    window.lastRefreshTime = Date.now();

    // AGGIORNA STATO: INIZIA REFRESH
    setDashboardState(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      console.log(`🔄 [${refreshId}] About to start BATCHED Promise.all with refetch functions`);
      console.log(`📊 [${refreshId}] SINGOLA CHIAMATA per 5 query in parallelo - NO DUPLICATI`);
      
      // ESEGUI TUTTE LE QUERY IN PARALLELO E ATTENDI TUTTI I RISULTATI
      const [
        currenciesResult,
        exchangeUpdateResult,
        kpisResult,
        chartDataResult,
        recentExpensesResult,
      ] = await Promise.all([
        refetchCurrencies(),
        refetchExchangeUpdate(),
        refetchKpis(),
        refetchChartData(),
        refetchRecentExpenses(),
      ]);
      
      console.log(`🔄 [${refreshId}] All queries completed, updating EVERYTHING in SINGLE ATOMIC UPDATE`);
      console.log(`✅ [${refreshId}] CONFERMA: ogni query eseguita 1 sola volta (>> = invio, << = risposta)`);
      
      // AGGIORNA TUTTO IN UNA SOLA OPERAZIONE ATOMICA - SOLO 1 RE-RENDER TOTALE
      setDashboardState({
        data: {
          availableCurrencies: currenciesResult.data,
          lastExchangeUpdate: exchangeUpdateResult.data,
          kpis: kpisResult.data,
          chartData: chartDataResult.data,
          recentExpenses: recentExpensesResult.data,
        },
        isLoaded: true,
        isRefreshing: false,
      });
      
      console.log(`🔄 [${refreshId}] handleRefreshDashboard COMPLETED with ATOMIC UPDATE - SINGLE RENDER`);
    } catch (error) {
      console.error(`❌ [${refreshId}] Errore durante il refresh della dashboard:`, error);
      // ANCHE IN CASO DI ERRORE, AGGIORNA IN UNA SOLA VOLTA
      setDashboardState(prev => ({ ...prev, isRefreshing: false }));
    }
  }, [isRefreshing, isDashboardLoaded, refetchCurrencies, refetchExchangeUpdate, refetchKpis, refetchChartData, refetchRecentExpenses]);

  // Wrapper per i click del bottone - ESPLICITA CHIAMATA MANUALE
  const handleButtonClick = useCallback((event?: React.MouseEvent) => {
    const timeSinceMount = Date.now() - componentMountTime;
    
    console.log('🎯 ==== BUTTON CLICK DETECTED ====');
    console.log('🎯 Event type:', event?.type || 'NO EVENT');
    console.log('🎯 Target:', event?.target);
    console.log('🎯 CurrentTarget:', event?.currentTarget);
    console.log('🎯 Time since mount:', timeSinceMount, 'ms');
    console.log('🎯 Is real click:', event?.isTrusted);
    console.log('🎯 User has interacted:', userHasInteracted);
    console.log('🎯 Stack trace:');
    console.log(new Error().stack);
    console.log('🎯 ==================================');

    // BLOCCA AUTO-TRIGGER NEL PRIMO SECONDO DOPO IL MOUNT
    if (timeSinceMount < 1000) {
      console.log('🚫 Auto-trigger blocked - too soon after component mount');
      return;
    }

    // BLOCCA SE L'UTENTE NON HA MAI INTERAGITO REALMENTE
    if (!userHasInteracted) {
      console.log('🚫 Auto-trigger blocked - no real user interaction detected yet');
      return;
    }

    // BLOCCA SE NON È UN EVENTO REALE
    if (!event || !event.isTrusted) {
      console.log('🚫 Auto-trigger blocked - not a trusted user event');
      return;
    }

    handleRefreshDashboard(true);
  }, [handleRefreshDashboard, componentMountTime, userHasInteracted]);

  // Non serve più effect per gestire i parametri - le query sono sempre disabilitate

  // Mostra loading quando le query sono in corso
  if (kpisLoading || chartLoading || expensesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Se le query non sono mai state eseguite, mostra messaggio per caricare
  if (!isDashboardLoaded && !kpis && !chartData && !recentExpenses && !availableCurrencies) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          
          {/* Bottone per primo caricamento */}
          <div className="mt-4 lg:mt-0">
            <button
              onClick={handleButtonClick}
              disabled={isRefreshing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Caricando...' : 'Carica Dashboard'}
            </button>
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <BarChart2 className="h-16 w-16 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
              Dashboard non caricata
            </h3>
                         <p className="text-blue-800 dark:text-blue-200 max-w-md">
               Premi il bottone "Carica Dashboard" per visualizzare i tuoi dati finanziari.
               Nessuna query viene eseguita automaticamente per evitare chiamate duplicate e ottimizzare le performance.
             </p>
          </div>
        </div>
      </div>
    );
  }

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
              onChange={handleCurrencyChange}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
            >
              {availableCurrencies?.map((currency: any) => (
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
              onChange={handleCategoriesLimitChange}
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

          {/* Refresh Dashboard Button */}
          <div className="flex flex-col justify-end">
            <button
              onClick={handleButtonClick}
              disabled={kpisLoading || chartLoading || expensesLoading || isRefreshing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 min-w-[160px] justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${(kpisLoading || chartLoading || expensesLoading || isRefreshing) ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Caricando...' : 'Ricarica Dashboard'}
            </button>
          </div>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
        
        {/* Exchange Rate Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <ExchangeRateStatusIndicator position="dashboard" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Spese per Categoria ({categoriesLimit === 999 ? 'Tutte' : `Top ${categoriesLimit}`})
          </h3>
          <div className="h-64">
            <Doughnut data={doughnutData} options={chartOptions} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Trend Mensile</h3>
          <div className="h-64">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Enhanced Exchange Rate Information Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Informazioni sui Tassi di Cambio
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span>Tasso corrente - utilizzato per conversioni in tempo reale</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Tasso storico - utilizzato per spese passate per maggiore accuratezza</span>
                </div>
                <p className="text-xs mt-2 text-blue-700 dark:text-blue-300">
                  I tassi storici garantiscono conversioni più precise per spese registrate in date passate, 
                  riflettendo il valore effettivo della valuta al momento della transazione.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional Exchange Rate Status with Cache Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <ExchangeRateStatusIndicator position="dashboard" />
          
          {/* Cache Performance Section */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Performance Cache
            </h4>
                         {/* Cache Metrics Inline */}
             <InlineCacheMetrics />
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
                  Tasso di Cambio
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    <RateIndicator
                      source={expense.isHistoricalRate ? 'historical' : 'current'}
                      rate={expense.exchangeRate}
                      fromCurrency={expense.originalCurrency}
                      toCurrency={selectedCurrency}
                    />
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
