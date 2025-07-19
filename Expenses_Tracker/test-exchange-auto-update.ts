/**
 * TEST MANUALE - Fase 1: Hook Aggiornamento Automatico Valute
 * 
 * Questo script testa se il sistema di aggiornamento automatico funziona correttamente.
 * 
 * COME TESTARE:
 * 1. Avviare l'app: npm run dev  
 * 2. Aprire browser su localhost:3000
 * 3. Fare login con un utente valido
 * 4. Aprire Dev Tools -> Console
 * 5. Cercare i log: "💱 [ExchangeRateUpdater]" 
 * 
 * LOG ATTESI:
 * - "💱 [ExchangeRateUpdater] Scheduling background update in 3000ms..."
 * - "💱 [ExchangeRateUpdater] Starting background update..."  
 * - "💱 [ExchangeRateUpdater] Update completed: { skipped: true/false, updatedRates: N }"
 * - "✅ Exchange rates refreshed: N rates updated" (se ci sono aggiornamenti)
 * 
 * RISULTATI ATTESI:
 * ✅ L'aggiornamento si attiva automaticamente 3 secondi dopo il login
 * ✅ Non blocca l'UI (l'app rimane reattiva)
 * ✅ Log di debug chiari nella console
 * ✅ Se le valute sono già aggiornate oggi: { skipped: true }
 * ✅ Se servono aggiornamenti: { skipped: false, updatedRates: N }
 * ✅ Errori gestiti senza disturbare l'utente
 */

// Test di verifica manuale delle API
export async function testExchangeRateUpdate() {
  console.log('🧪 Testing Exchange Rate Update System...');
  
  try {
    // Chiama direttamente l'API tRPC
    const response = await fetch('/api/trpc/currency.updateDailyExchangeRates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    const result = data.result?.data;
    
    console.log('📊 Result:', result);
    
    if (result?.skipped) {
      console.log('✅ Exchange rates already updated today - working correctly');
    } else {
      console.log(`✅ Exchange rates updated: ${result?.updatedRates || 0} rates`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Exchange rate update failed:', error);
    throw error;
  }
}

// Test diretto del backend
export async function testBackendDirectly() {
  console.log('🔧 Testing backend directly...');
  
  try {
    const response = await fetch('/api/trpc/currency.updateDailyExchangeRates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    console.log('📡 Backend response:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Backend test failed:', error);
    throw error;
  }
}

// Esponi le funzioni per il testing manuale nella console del browser
if (typeof window !== 'undefined') {
  (window as any).testExchangeUpdate = testExchangeRateUpdate;
  (window as any).testBackend = testBackendDirectly;
  console.log('🛠️ Test functions available:');
  console.log('  testExchangeUpdate() - Test via tRPC');
  console.log('  testBackend() - Test via direct API');
} 