import { useEffect } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '~/stores/auth';
import { Layout } from '~/components/Layout';
import { useExchangeRateUpdater } from '~/hooks/useExchangeRateUpdater';

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // Aggiornamento automatico tassi di cambio in background
  // Si attiva solo quando l'utente è autenticato e non in loading
  useExchangeRateUpdater({
    enabled: isAuthenticated && !isLoading,
    delayMs: 3000, // 3 secondi dopo l'autenticazione
    onUpdateSuccess: (result) => {
      // Log silenzioso per monitoraggio - non mostra notifiche all'utente
      if (!result.skipped) {
        console.log(`✅ Exchange rates refreshed: ${result.updatedRates} rates updated`);
      }
    },
    onUpdateError: (error) => {
      // Log errore ma non disturba l'utente - l'app continua a funzionare
      console.warn('⚠️ Background exchange rate update failed:', error);
    }
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login', replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null; // or a redirect component
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
} 