import { useState, useEffect } from 'react';
import { trpc } from '~/trpc/react';
import { 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Info
} from 'lucide-react';

interface ExchangeRateStatus {
  isHealthy: boolean;
  lastUpdate: Date | null;
  daysSinceUpdate: number;
  needsUpdate: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ExchangeRateStatusIndicatorProps {
  position?: 'header' | 'sidebar' | 'dashboard';
  showDetails?: boolean;
  className?: string;
}

export function ExchangeRateStatusIndicator({ 
  position = 'header', 
  showDetails = false,
  className = '' 
}: ExchangeRateStatusIndicatorProps) {
  const [status, setStatus] = useState<ExchangeRateStatus>({
    isHealthy: true,
    lastUpdate: null,
    daysSinceUpdate: 0,
    needsUpdate: false,
    isLoading: true,
    error: null
  });

  const [showTooltip, setShowTooltip] = useState(false);

  // Query per ottenere lo stato delle valute
  const { data: rateStatus, isLoading, error, refetch } = trpc.currency.getLastExchangeRateUpdate.useQuery(
    undefined,
    {
      refetchInterval: 60000, // Ricontrolla ogni minuto
      refetchOnWindowFocus: true,
      retry: 2
    }
  );

  // Query per le cache metrics (opzionale, per admin)
  const { data: cacheMetrics } = trpc.currency.getCacheMetrics.useQuery(
    undefined,
    {
      refetchInterval: 120000, // Ogni 2 minuti
      refetchOnWindowFocus: false,
      retry: 1
    }
  );

  useEffect(() => {
    if (isLoading) {
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));
      return;
    }

    if (error) {
      setStatus({
        isHealthy: false,
        lastUpdate: null,
        daysSinceUpdate: 999,
        needsUpdate: true,
        isLoading: false,
        error: error.message || 'Failed to check exchange rates'
      });
      return;
    }

    if (rateStatus?.success && rateStatus.lastUpdateDate) {
      const lastUpdate = new Date(rateStatus.lastUpdateDate);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Considera "fresco" se aggiornato oggi
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const needsUpdate = lastUpdate < today;

      setStatus({
        isHealthy: daysDiff <= 1, // Sano se aggiornato max 1 giorno fa
        lastUpdate,
        daysSinceUpdate: daysDiff,
        needsUpdate,
        isLoading: false,
        error: null
      });
    } else {
      setStatus({
        isHealthy: false,
        lastUpdate: null,
        daysSinceUpdate: 999,
        needsUpdate: true,
        isLoading: false,
        error: 'No exchange rate data available'
      });
    }
  }, [rateStatus, isLoading, error]);

  // Funzione per ottenere icona e colore basato sullo stato
  const getStatusIndicator = () => {
    if (status.isLoading) {
      return {
        icon: Loader2,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        label: 'Verificando...'
      };
    }

    if (status.error) {
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        label: 'Errore valute'
      };
    }

    if (status.needsUpdate) {
      return {
        icon: Clock,
        color: 'text-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/20',
        label: 'Da aggiornare'
      };
    }

    return {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      label: 'Aggiornati'
    };
  };

  const indicator = getStatusIndicator();
  const IconComponent = indicator.icon;

  // Formato data per tooltip
  const formatLastUpdate = () => {
    if (!status.lastUpdate) return 'Mai aggiornati';
    
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - status.lastUpdate.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Da poco';
    if (diffHours < 24) return `${diffHours}h fa`;
    
    return `${status.daysSinceUpdate} giorni fa`;
  };

  // Rendering per posizione header (compatto)
  if (position === 'header') {
    return (
      <div 
        className={`relative ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`flex items-center space-x-2 px-2 py-1 rounded-lg ${indicator.bgColor} border border-opacity-20`}>
          <IconComponent 
            className={`h-4 w-4 ${indicator.color} ${status.isLoading ? 'animate-spin' : ''}`} 
          />
          <span className={`text-xs font-medium ${indicator.color}`}>
            💱
          </span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute top-full left-0 mt-2 z-50 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-5">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-gray-900 dark:text-white text-base">Tassi di Cambio</span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 px-1">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Stato:</span>
                <span className="text-gray-900 dark:text-white font-semibold">{indicator.label}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-1">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Aggiornato:</span>
                <span className="text-gray-900 dark:text-white font-semibold">{formatLastUpdate()}</span>
              </div>
              {cacheMetrics?.success && cacheMetrics.status && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between py-2 px-1">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Cache:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      {cacheMetrics.status.size} entries, {Math.round(cacheMetrics.status.hitRate * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {status.error && (
                <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-600">
                  <p className="text-red-500 text-sm font-medium">{status.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Rendering per dashboard (dettagliato)
  if (position === 'dashboard') {
    return (
      <div className={`${indicator.bgColor} border border-opacity-20 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <IconComponent 
              className={`h-5 w-5 ${indicator.color} ${status.isLoading ? 'animate-spin' : ''}`} 
            />
            <h3 className="font-medium text-gray-900 dark:text-white">Tassi di Cambio</h3>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${indicator.bgColor} ${indicator.color} font-medium`}>
            {indicator.label}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <span>Aggiornamento:</span>
            <span className={status.needsUpdate ? 'text-amber-600 dark:text-amber-400' : ''}>
              {formatLastUpdate()}
            </span>
          </div>
          
          {status.lastUpdate && (
            <div className="flex justify-between items-center">
              <span>Data:</span>
              <span>{status.lastUpdate.toLocaleDateString('it-IT')}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span>Stato:</span>
            <span className={`${indicator.color} font-medium`}>
              {status.isHealthy ? 'Sano' : 'Richiede attenzione'}
            </span>
          </div>
        </div>

        {status.error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
            {status.error}
          </div>
        )}
      </div>
    );
  }

  // Rendering per sidebar (medium)
  return (
    <div className={`flex items-center space-x-3 p-2 rounded-lg ${indicator.bgColor} ${className}`}>
      <IconComponent 
        className={`h-4 w-4 ${indicator.color} ${status.isLoading ? 'animate-spin' : ''}`} 
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          Tassi valute
        </p>
        <p className={`text-xs ${indicator.color}`}>
          {indicator.label}
        </p>
      </div>
      {showDetails && (
        <Info className="h-3 w-3 text-gray-400" />
      )}
    </div>
  );
} 