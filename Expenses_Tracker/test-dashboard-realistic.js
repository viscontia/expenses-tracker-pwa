#!/usr/bin/env node

/**
 * Test realistico della dashboard che simula il comportamento del browser
 * Carica tutte le query simultaneamente come fa React
 */

import http from 'http';

// Funzione per fare richieste HTTP
const makeRequest = (path, description) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ExpensesTracker-Dashboard-Test/1.0',
        'Accept': 'application/json',
        // Simula un token di autenticazione più realistico
        'Authorization': 'Bearer test-token',
        'Cookie': 'auth-token=test-user-id-1',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        const responseSize = Buffer.byteLength(data, 'utf8');
        
        resolve({
          description,
          path,
          statusCode: res.statusCode,
          duration,
          responseSize,
          success: res.statusCode === 200,
          data: data.substring(0, 200) + (data.length > 200 ? '...' : '')
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject({
        description,
        path,
        error: error.message,
        duration,
        success: false
      });
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject({
        description,
        path,
        error: 'Timeout (15s)',
        duration: 15000,
        success: false
      });
    });

    req.end();
  });
};

// Test simultaneo come fa il browser
async function testRealisticDashboardLoad() {
  console.log('='.repeat(80));
  console.log('🌐 REALISTIC DASHBOARD LOAD TEST');
  console.log('   Simulating browser behavior with simultaneous queries');
  console.log('='.repeat(80));
  
  // Query principali della dashboard che vengono caricate simultaneamente
  const mainQueries = [
    {
      path: '/api/trpc/dashboard.getKpis?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Dashboard KPIs'
    },
    {
      path: '/api/trpc/dashboard.getChartData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22topCategoriesLimit%22%3A10%2C%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Chart Data'
    },
    {
      path: '/api/trpc/dashboard.getRecentExpenses?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A10%2C%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Recent Expenses'
    }
  ];

  // Query ausiliarie che possono essere caricate separatamente
  const auxiliaryQueries = [
    {
      path: '/api/trpc/auth.getCurrentUser',
      description: 'Current User'
    },
    {
      path: '/api/trpc/currency.getAvailableCurrencies',
      description: 'Available Currencies'
    },
    {
      path: '/api/trpc/currency.getLastExchangeRateUpdate',
      description: 'Exchange Rate Update'
    }
  ];

  console.log('\n🚀 PHASE 1: Loading main dashboard queries (simultaneous)');
  const mainStartTime = Date.now();
  
  try {
    const mainResults = await Promise.all(
      mainQueries.map(query => makeRequest(query.path, query.description))
    );
    
    const mainTotalTime = Date.now() - mainStartTime;
    
    console.log(`✅ Main queries completed in ${mainTotalTime}ms`);
    
    mainResults.forEach(result => {
      console.log(`   ${result.description}: ${result.duration}ms (${result.responseSize} bytes)`);
    });

    console.log('\n🔄 PHASE 2: Loading auxiliary queries (simultaneous)');
    const auxStartTime = Date.now();
    
    const auxResults = await Promise.all(
      auxiliaryQueries.map(query => makeRequest(query.path, query.description))
    );
    
    const auxTotalTime = Date.now() - auxStartTime;
    
    console.log(`✅ Auxiliary queries completed in ${auxTotalTime}ms`);
    
    auxResults.forEach(result => {
      console.log(`   ${result.description}: ${result.duration}ms (${result.responseSize} bytes)`);
    });

    // Analisi finale
    const overallTime = Math.max(mainTotalTime, auxTotalTime);
    const allResults = [...mainResults, ...auxResults];
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 REALISTIC DASHBOARD ANALYSIS');
    console.log('='.repeat(80));
    
    console.log(`\n🕐 Timing Analysis:`);
    console.log(`   Main Dashboard Queries: ${mainTotalTime}ms`);
    console.log(`   Auxiliary Queries: ${auxTotalTime}ms`);
    console.log(`   Overall Dashboard Load: ${overallTime}ms`);
    console.log(`   Expected User Perception: ${Math.max(mainTotalTime, 50)}ms`);
    
    console.log(`\n📡 Response Analysis:`);
    const totalBytes = allResults.reduce((sum, r) => sum + (r.responseSize || 0), 0);
    console.log(`   Total Data Transfer: ${(totalBytes / 1024).toFixed(2)} KB`);
    console.log(`   Average Response Size: ${Math.round(totalBytes / allResults.length)} bytes`);
    
    console.log(`\n🎯 Performance Verdict:`);
    if (overallTime < 100) {
      console.log(`   🟢 EXCELLENT: Dashboard loads very fast (${overallTime}ms)`);
    } else if (overallTime < 500) {
      console.log(`   🟡 GOOD: Dashboard loads reasonably fast (${overallTime}ms)`);
    } else if (overallTime < 1000) {
      console.log(`   🟠 SLOW: Dashboard feels sluggish (${overallTime}ms)`);
    } else {
      console.log(`   🔴 CRITICAL: Dashboard is unacceptably slow (${overallTime}ms)`);
    }
    
    // Detecta potenziali problemi
    console.log(`\n🔍 Issue Detection:`);
    
    const slowQueries = allResults.filter(r => r.duration > 100);
    if (slowQueries.length > 0) {
      console.log(`   ⚠️  Slow queries detected:`);
      slowQueries.forEach(q => {
        console.log(`      - ${q.description}: ${q.duration}ms`);
      });
    }
    
    const failedQueries = allResults.filter(r => !r.success);
    if (failedQueries.length > 0) {
      console.log(`   ❌ Failed queries:`);
      failedQueries.forEach(q => {
        console.log(`      - ${q.description}: ${q.error || 'Unknown error'}`);
      });
    }
    
    if (slowQueries.length === 0 && failedQueries.length === 0) {
      console.log(`   ✅ No performance issues detected`);
    }
    
    console.log('\n💡 If the AdminPanel shows 1400ms+ but this test shows <100ms,');
    console.log('   the issue is likely in the monitoring service or frontend rendering.');
    
  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
  }
}

testRealisticDashboardLoad().catch(console.error); 