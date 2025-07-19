/**
 * TEST MANUALE - Fase 2: Trigger Pre-Registrazione
 * 
 * Questo script testa il sistema di aggiornamento pre-submit nelle spese.
 * 
 * COME TESTARE:
 * 1. Avviare l'app: npm run dev  
 * 2. Aprire browser su localhost:3000
 * 3. Fare login con un utente valido
 * 4. Andare a "Registra Spese" (/expenses/new)
 * 5. Compilare il form con dati validi
 * 6. Aprire Dev Tools -> Console prima di cliccare "Salva Spesa"
 * 7. Cliccare "Salva Spesa" e osservare i log
 * 
 * LOG ATTESI NELLA CONSOLE:
 * - "💱 [NewExpense] Ensuring fresh exchange rates before expense submission..."
 * - "💱 [PreSubmit] Ensuring fresh exchange rates..."
 * - "💱 [PreSubmit] Exchange rates are fresh, no update needed" (se già aggiornate)
 *   OPPURE
 * - "💱 [PreSubmit] Exchange rates are stale, update needed"
 * - "💱 [PreSubmit] Starting exchange rate update..."
 * - "💱 [PreSubmit] Update completed: { ... }"
 * - "✅ [NewExpense] Exchange rates refreshed successfully before submission"
 * 
 * UI COMPORTAMENTI ATTESI:
 * ✅ Il bottone si disabilita durante l'aggiornamento
 * ✅ Appare il banner "💱 Aggiornamento tassi di cambio in corso..."
 * ✅ Il testo del bottone cambia a "Aggiornando valute..."
 * ✅ L'aggiornamento completa entro 5 secondi (timeout)
 * ✅ Il submit procede anche se l'aggiornamento fallisce
 * ✅ Nessun blocco dell'UI per l'utente
 * 
 * SCENARI DI TEST:
 * 
 * Scenario 1: Valute già fresche
 * - Le valute sono state aggiornate oggi
 * - Il sistema dovrebbe saltare l'aggiornamento
 * - Log: "Exchange rates are fresh, no update needed"
 * 
 * Scenario 2: Valute da aggiornare  
 * - Le valute non sono state aggiornate oggi
 * - Il sistema dovrebbe avviare l'aggiornamento
 * - Log: "Exchange rates are stale, update needed" + update process
 * 
 * Scenario 3: Timeout dell'aggiornamento
 * - Simulabile disabilitando la connessione durante il submit
 * - Il sistema dovrebbe procedere dopo 5 secondi
 * - Log: "Exchange rate update timed out, proceeding anyway"
 */

// Funzioni helper per test manuali nella console del browser

export const TestPhase2Utils = {
  // Test stato aggiornamento valute
  async checkExchangeRateStatus() {
    console.log('🧪 Testing exchange rate status...');
    try {
      const response = await fetch('/api/trpc/currency.getLastExchangeRateUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      const result = data.result?.data;
      
      if (result?.lastUpdateDate) {
        const lastUpdate = new Date(result.lastUpdateDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const isToday = lastUpdate >= today;
        console.log(`📅 Last update: ${lastUpdate.toISOString()}`);
        console.log(`🟢 Status: ${isToday ? 'Fresh (updated today)' : 'Stale (needs update)'}`);
        
        return { lastUpdate, isToday };
      } else {
        console.log('❌ No exchange rate data found');
        return { lastUpdate: null, isToday: false };
      }
    } catch (error) {
      console.error('❌ Failed to check status:', error);
      throw error;
    }
  },

  // Simula aggiornamento manuale
  async forceExchangeRateUpdate() {
    console.log('🔄 Forcing exchange rate update...');
    try {
      const response = await fetch('/api/trpc/currency.updateDailyExchangeRates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      const result = data.result?.data;
      
      console.log('📊 Update result:', result);
      
      if (result?.skipped) {
        console.log('✅ Update skipped - already updated today');
      } else if (result?.updatedRates) {
        console.log(`✅ Update successful - ${result.updatedRates} rates updated`);
      } else {
        console.log('❌ Update failed:', result?.error || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
  },

  // Test completo del flusso
  async testCompleteFlow() {
    console.log('🎯 Running complete Phase 2 test flow...');
    
    try {
      // 1. Check initial status
      console.log('\n📍 Step 1: Check initial status');
      const initialStatus = await this.checkExchangeRateStatus();
      
      // 2. Test pre-submit logic simulation
      console.log('\n📍 Step 2: Simulate pre-submit check');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const needsUpdate = !initialStatus.lastUpdate || initialStatus.lastUpdate < today;
      console.log(`🤔 Would trigger update: ${needsUpdate ? 'YES' : 'NO'}`);
      
      if (needsUpdate) {
        console.log('\n📍 Step 3: Simulating update...');
        await this.forceExchangeRateUpdate();
      } else {
        console.log('\n📍 Step 3: No update needed, would skip');
      }
      
      // 3. Check final status
      console.log('\n📍 Step 4: Check final status');
      await this.checkExchangeRateStatus();
      
      console.log('\n✅ Phase 2 test flow completed successfully!');
      console.log('\n💡 Now try submitting an expense in the UI to see the real integration');
      
    } catch (error) {
      console.error('\n❌ Test flow failed:', error);
    }
  },

  // Test timeout simulation
  async testTimeoutScenario() {
    console.log('⏱️ Testing timeout scenario...');
    console.log('💡 To simulate timeout: disable network in DevTools before running this');
    
    const startTime = Date.now();
    const timeoutMs = 5000;
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      
      const updatePromise = this.forceExchangeRateUpdate();
      
      await Promise.race([updatePromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Update completed in ${duration}ms`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof Error && error.message === 'Timeout') {
        console.log(`⏱️ Simulated timeout after ${duration}ms (would proceed with existing rates)`);
      } else {
        console.log(`❌ Update failed after ${duration}ms:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
};

// Esponi le funzioni per il testing manuale
if (typeof window !== 'undefined') {
  (window as any).TestPhase2 = TestPhase2Utils;
  console.log('🛠️ Phase 2 test functions available:');
  console.log('  TestPhase2.checkExchangeRateStatus() - Check current status');
  console.log('  TestPhase2.forceExchangeRateUpdate() - Force an update');
  console.log('  TestPhase2.testCompleteFlow() - Run complete test');
  console.log('  TestPhase2.testTimeoutScenario() - Test timeout handling');
} 