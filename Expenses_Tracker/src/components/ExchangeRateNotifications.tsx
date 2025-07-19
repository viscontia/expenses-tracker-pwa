import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  TrendingUp, 
  X, 
  Clock,
  AlertCircle 
} from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ExchangeRateNotificationsProps {
  className?: string;
}

// Hook per gestire le notifiche
export function useExchangeRateNotifications() {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const addNotification = (notification: Omit<ToastNotification, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: ToastNotification = {
      id,
      duration: 5000, // 5 secondi default
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Funzioni di convenienza per tipi specifici
  const notifyExchangeRateUpdate = (updatedRates: number) => {
    return addNotification({
      type: 'success',
      title: 'Tassi di cambio aggiornati',
      message: `${updatedRates} tassi di cambio sono stati aggiornati con successo.`,
      duration: 4000
    });
  };

  const notifyExchangeRateSkipped = () => {
    return addNotification({
      type: 'info',
      title: 'Tassi già aggiornati',
      message: 'I tassi di cambio sono già aggiornati per oggi.',
      duration: 3000
    });
  };

  const notifyExchangeRateError = (error: string) => {
    return addNotification({
      type: 'error',
      title: 'Errore aggiornamento valute',
      message: `Non è stato possibile aggiornare i tassi: ${error}`,
      duration: 6000
    });
  };

  const notifyExchangeRateStale = (daysSinceUpdate: number) => {
    return addNotification({
      type: 'warning',
      title: 'Tassi di cambio obsoleti',
      message: `I tassi non vengono aggiornati da ${daysSinceUpdate} giorni. Le conversioni potrebbero non essere precise.`,
      duration: 8000,
      action: {
        label: 'Aggiorna ora',
        onClick: () => {
          // Trigger manual update
          console.log('Manual exchange rate update triggered');
        }
      }
    });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    notifyExchangeRateUpdate,
    notifyExchangeRateSkipped,
    notifyExchangeRateError,
    notifyExchangeRateStale
  };
}

// Componente per renderizzare le notifiche
export function ExchangeRateNotifications({ className = '' }: ExchangeRateNotificationsProps) {
  const { notifications, removeNotification } = useExchangeRateNotifications();

  const getNotificationStyles = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-500',
          titleColor: 'text-green-800 dark:text-green-200',
          messageColor: 'text-green-600 dark:text-green-300'
        };
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: TrendingUp,
          iconColor: 'text-blue-500',
          titleColor: 'text-blue-800 dark:text-blue-200',
          messageColor: 'text-blue-600 dark:text-blue-300'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-800',
          icon: Clock,
          iconColor: 'text-amber-500',
          titleColor: 'text-amber-800 dark:text-amber-200',
          messageColor: 'text-amber-600 dark:text-amber-300'
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: AlertCircle,
          iconColor: 'text-red-500',
          titleColor: 'text-red-800 dark:text-red-200',
          messageColor: 'text-red-600 dark:text-red-300'
        };
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {notifications.map((notification) => {
        const styles = getNotificationStyles(notification.type);
        const IconComponent = styles.icon;

        return (
          <div
            key={notification.id}
            className={`max-w-sm w-full ${styles.bg} ${styles.border} border rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-in-out`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <IconComponent className={`h-5 w-5 ${styles.iconColor}`} />
              </div>
              <div className="ml-3 w-0 flex-1">
                <p className={`text-sm font-medium ${styles.titleColor}`}>
                  {notification.title}
                </p>
                <p className={`mt-1 text-sm ${styles.messageColor}`}>
                  {notification.message}
                </p>
                {notification.action && (
                  <div className="mt-3">
                    <button
                      onClick={notification.action.onClick}
                      className={`text-sm font-medium ${styles.iconColor} hover:underline`}
                    >
                      {notification.action.label}
                    </button>
                  </div>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeNotification(notification.id)}
                  className={`rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Store globale per le notifiche (per accesso da qualsiasi componente)
let globalNotificationManager: ReturnType<typeof useExchangeRateNotifications> | null = null;

export function ExchangeRateNotificationProvider({ children }: { children: React.ReactNode }) {
  const notificationManager = useExchangeRateNotifications();
  
  // Salva il manager globalmente per accesso da altri componenti
  globalNotificationManager = notificationManager;

  return (
    <>
      {children}
      <ExchangeRateNotifications />
    </>
  );
}

// Utility per accedere alle notifiche da qualsiasi punto dell'app
export const exchangeRateNotifications = {
  success: (updatedRates: number) => {
    if (globalNotificationManager) {
      globalNotificationManager.notifyExchangeRateUpdate(updatedRates);
    }
  },
  skipped: () => {
    if (globalNotificationManager) {
      globalNotificationManager.notifyExchangeRateSkipped();
    }
  },
  error: (error: string) => {
    if (globalNotificationManager) {
      globalNotificationManager.notifyExchangeRateError(error);
    }
  },
  stale: (daysSinceUpdate: number) => {
    if (globalNotificationManager) {
      globalNotificationManager.notifyExchangeRateStale(daysSinceUpdate);
    }
  },
  custom: (notification: Omit<ToastNotification, 'id'>) => {
    if (globalNotificationManager) {
      globalNotificationManager.addNotification(notification);
    }
  }
}; 