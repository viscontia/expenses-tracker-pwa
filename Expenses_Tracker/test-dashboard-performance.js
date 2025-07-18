#!/usr/bin/env node

/**
 * Script per testare le performance della dashboard
 * Simula le chiamate che fa il browser e misura i tempi
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
        'Cookie': 'auth-token=test', // Token di test
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          description,
          path,
          statusCode: res.statusCode,
          duration,
          success: res.statusCode === 200
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

    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        description,
        path,
        error: 'Timeout (10s)',
        duration: 10000,
        success: false
      });
    });

    req.end();
  });
};

// Test delle API della dashboard
async function testDashboardPerformance() {
  console.log('='.repeat(80));
  console.log('🚀 TESTING DASHBOARD PERFORMANCE');
  console.log('='.repeat(80));
  
  const tests = [
    {
      path: '/api/trpc/dashboard.getKpis?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Dashboard KPIs (getKpis)'
    },
    {
      path: '/api/trpc/dashboard.getChartData?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22topCategoriesLimit%22%3A10%2C%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Dashboard Chart Data (getChartData)'
    },
    {
      path: '/api/trpc/dashboard.getRecentExpenses?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A10%2C%22targetCurrency%22%3A%22EUR%22%7D%7D%7D',
      description: 'Recent Expenses (getRecentExpenses)'
    },
    {
      path: '/api/trpc/currency.getAvailableCurrencies',
      description: 'Available Currencies'
    },
    {
      path: '/api/trpc/currency.getLastExchangeRateUpdate',
      description: 'Last Exchange Rate Update'
    }
  ];

  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`\n📊 Testing: ${test.description}...`);
      const result = await makeRequest(test.path, test.description);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${result.description}: ${result.duration}ms`);
      } else {
        console.log(`❌ ${result.description}: ${result.duration}ms (Status: ${result.statusCode})`);
      }
    } catch (error) {
      results.push(error);
      console.log(`💥 ${error.description}: ${error.duration}ms (Error: ${error.error})`);
    }
    
    // Pausa breve tra i test
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Stampa risultati finali
  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY REPORT');
  console.log('='.repeat(80));
  
  console.log('\n| Query | Description | Status | Duration |');
  console.log('|-------|-------------|--------|----------|');
  
  let totalTime = 0;
  let successCount = 0;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    console.log(`| Query ${index + 1} | ${result.description} | ${status} | ${duration} |`);
    
    totalTime += result.duration;
    if (result.success) successCount++;
  });
  
  console.log('\n📈 Performance Summary:');
  console.log(`   Total Test Time: ${totalTime}ms`);
  console.log(`   Average per Query: ${Math.round(totalTime / results.length)}ms`);
  console.log(`   Success Rate: ${successCount}/${results.length} (${Math.round(successCount/results.length*100)}%)`);
  
  if (totalTime > 1000) {
    console.log(`\n⚠️  WARNING: Dashboard loading is slow (${totalTime}ms total)`);
    console.log('   Expected with empty database: <200ms total');
  } else {
    console.log(`\n🎉 Dashboard performance is good (${totalTime}ms total)`);
  }
  
  console.log('\n💡 Check server logs for detailed profiling data');
  console.log('='.repeat(80));
}

testDashboardPerformance().catch(console.error); 