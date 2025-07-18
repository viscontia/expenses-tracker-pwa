// Test diretto delle query dashboard senza autenticazione
const { Pool } = require('pg');

// Configurazione database (usando le stesse impostazioni del progetto)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 5000,
});

async function queryRaw(text, params = []) {
  let client = null;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Raw query error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function profileQuery(queryName, purpose, sql, params) {
  const startTime = Date.now();
  
  try {
    const result = await queryRaw(sql, params);
    const executionTime = Date.now() - startTime;
    
    return {
      queryName,
      purpose,
      sqlCode: sql,
      executionTime,
      resultCount: Array.isArray(result) ? result.length : 1,
      success: true
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    return {
      queryName,
      purpose,
      sqlCode: sql,
      executionTime,
      resultCount: 0,
      success: false,
      error: error.message
    };
  }
}

async function runProfiling() {
  console.log('🔍 PROFILING DASHBOARD QUERIES - DB VUOTO\n');
  
  const userId = 1; // Assumo che esista un utente con ID 1
  const now = new Date();
  
  // Definisco i periodi di test
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
  const endOfCurrentYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  
  const results = [];
  
  // 1. Test getUserExpenseCount
  results.push(await profileQuery(
    'getUserExpenseCount',
    'Controllo rapido se utente ha spese (ottimizzazione)',
    `SELECT COUNT(*)::int as count FROM "Expense" WHERE "userId" = $1`,
    [userId]
  ));
  
  // 2. Test getExpensesByPeriod - Mese corrente
  results.push(await profileQuery(
    'getExpensesByPeriod_CurrentMonth',
    'Spese dell\'utente nel mese corrente',
    `SELECT id, amount, currency, date, description, "userId", "categoryId" FROM "Expense" WHERE "userId" = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
    [userId, startOfCurrentMonth.toISOString(), endOfCurrentMonth.toISOString()]
  ));
  
  // 3. Test getExpensesByPeriod - Mese precedente
  results.push(await profileQuery(
    'getExpensesByPeriod_PreviousMonth',
    'Spese dell\'utente nel mese precedente',
    `SELECT id, amount, currency, date, description, "userId", "categoryId" FROM "Expense" WHERE "userId" = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
    [userId, startOfPreviousMonth.toISOString(), endOfPreviousMonth.toISOString()]
  ));
  
  // 4. Test getExpensesByPeriod - Anno corrente
  results.push(await profileQuery(
    'getExpensesByPeriod_CurrentYear',
    'Spese dell\'utente nell\'anno corrente',
    `SELECT id, amount, currency, date, description, "userId", "categoryId" FROM "Expense" WHERE "userId" = $1 AND date >= $2 AND date <= $3 ORDER BY date DESC`,
    [userId, startOfCurrentYear.toISOString(), endOfCurrentYear.toISOString()]
  ));
  
  // 5. Test getExpensesWithHistoricalRates (la query JOIN ottimizzata)
  results.push(await profileQuery(
    'getExpensesWithHistoricalRates',
    'Spese con tassi storici (JOIN ottimizzato)',
    `SELECT e.id, e.amount, e.currency, e.date, e.description, e."userId", e."categoryId", COALESCE(json_agg(json_build_object('fromCurrency', eer."fromCurrency", 'toCurrency', eer."toCurrency", 'rate', eer.rate::float)) FILTER (WHERE eer.id IS NOT NULL), '[]'::json) as "historicalRates" FROM "Expense" e LEFT JOIN "ExpenseExchangeRate" eer ON e.id = eer."expenseId" WHERE e."userId" = $1 AND e.date >= $2 AND e.date <= $3 GROUP BY e.id, e.amount, e.currency, e.date, e.description, e."userId", e."categoryId" ORDER BY e.date DESC`,
    [userId, startOfCurrentMonth.toISOString(), endOfCurrentMonth.toISOString()]
  ));
  
  // 6. Test getRecentExpenses
  results.push(await profileQuery(
    'getRecentExpenses',
    'Ultime 10 spese dell\'utente',
    `SELECT id, amount, currency, date, description, "userId", "categoryId" FROM "Expense" WHERE "userId" = $1 ORDER BY date DESC LIMIT $2`,
    [userId, 10]
  ));
  
  // 7. Test getCategoriesByUser
  results.push(await profileQuery(
    'getCategoriesByUser',
    'Categorie dell\'utente',
    `SELECT id, name, description, icon FROM "Category" WHERE "userId" = $1 ORDER BY name`,
    [userId]
  ));
  
  // 8. Test getLatestExchangeRate - EUR to USD
  results.push(await profileQuery(
    'getLatestExchangeRate_EUR_USD',
    'Ultimo tasso di cambio EUR->USD',
    `SELECT "fromCurrency", "toCurrency", rate, date FROM "ExchangeRate" WHERE "fromCurrency" = $1 AND "toCurrency" = $2 ORDER BY date DESC LIMIT 1`,
    ['EUR', 'USD']
  ));
  
  // 9. Test count ExpenseExchangeRate
  results.push(await profileQuery(
    'countExpenseExchangeRates',
    'Conteggio tassi storici dell\'utente',
    `SELECT COUNT(*)::int as count FROM "ExpenseExchangeRate" eer JOIN "Expense" e ON eer."expenseId" = e.id WHERE e."userId" = $1`,
    [userId]
  ));
  
  // 10. Test transactionCount
  results.push(await profileQuery(
    'getTransactionCount',
    'Conteggio transazioni nel mese corrente',
    `SELECT COUNT(*)::int as count FROM "Expense" WHERE "userId" = $1 AND date >= $2 AND date <= $3`,
    [userId, startOfCurrentMonth.toISOString(), endOfCurrentMonth.toISOString()]
  ));
  
  // Calcola tempo totale
  const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
  
  // Stampa risultati formattati
  console.log('📊 RISULTATI PROFILING:\n');
  
  console.table(results.map(r => ({
    'Query': r.queryName,
    'Tempo (ms)': r.executionTime,
    'Successo': r.success ? '✅' : '❌',
    'Risultati': r.resultCount,
    'Errore': r.error || '-'
  })));
  
  console.log(`\n⏱️ Tempo totale esecuzione: ${totalTime}ms\n`);
  
  // Query più lente
  const slowQueries = results
    .filter(r => r.executionTime > 50)
    .sort((a, b) => b.executionTime - a.executionTime);
  
  if (slowQueries.length > 0) {
    console.log('🐌 QUERY PIÙ LENTE (>50ms):');
    slowQueries.forEach(q => {
      console.log(`  • ${q.queryName}: ${q.executionTime}ms`);
      console.log(`    Scopo: ${q.purpose}`);
      console.log(`    SQL: ${q.sqlCode.substring(0, 120)}...\n`);
    });
  }
  
  // Tabella dettagliata per analisi
  console.log('\n📋 TABELLA DETTAGLIATA:\n');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.queryName}`);
    console.log(`   Scopo: ${r.purpose}`);
    console.log(`   Tempo: ${r.executionTime}ms`);
    console.log(`   SQL: ${r.sqlCode}`);
    console.log(`   Risultati: ${r.resultCount}`);
    if (r.error) console.log(`   ❌ Errore: ${r.error}`);
    console.log('');
  });
  
  await pool.end();
}

runProfiling().catch(console.error); 