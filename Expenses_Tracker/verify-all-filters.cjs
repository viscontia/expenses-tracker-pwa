const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyAllFilters() {
  try {
    console.log('🔍 VERIFICA COMPLETA TUTTI I FILTRI TEMPORALI\n');
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Definizione di tutti i filtri da testare
    const filters = [
      {
        name: 'current',
        description: 'Mese Corrente',
        getDateRange: () => {
          const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          return { start: startOfCurrentMonth, end: endOfCurrentMonth };
        }
      },
      {
        name: 'previous',
        description: 'Mese Precedente',
        getDateRange: () => {
          const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          return { start: startOfPreviousMonth, end: endOfPreviousMonth };
        }
      },
      {
        name: '7d',
        description: 'Ultimi 7 giorni',
        getDateRange: () => {
          const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return { start, end: today };
        }
      },
      {
        name: '30d',
        description: 'Ultimi 30 giorni',
        getDateRange: () => {
          const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          return { start, end: today };
        }
      },
      {
        name: '90d',
        description: 'Ultimi 90 giorni',
        getDateRange: () => {
          const start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
          return { start, end: today };
        }
      },
      {
        name: 'mom',
        description: 'MoM (2 mesi)',
        getDateRange: () => {
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          return { start: startOfLastMonth, end: endOfThisMonth };
        }
      },
      {
        name: 'ytd',
        description: 'Year to Date',
        getDateRange: () => {
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          return { start: startOfYear, end: today };
        }
      },
      {
        name: 'yoy',
        description: 'YoY (Anno Precedente)',
        getDateRange: () => {
          const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
          const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          return { start: startOfLastYear, end: endOfLastYear };
        }
      }
    ];
    
    const results = [];
    
    for (const filter of filters) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 TESTANDO: ${filter.description} (${filter.name})`);
      console.log(`${'='.repeat(60)}`);
      
      const dateRange = filter.getDateRange();
      console.log(`📅 Date Range: ${dateRange.start.toISOString()} → ${dateRange.end.toISOString()}`);
      
      // Query al database
      const expenses = await prisma.expense.findMany({
        where: {
          date: {
            gte: dateRange.start,
            lte: dateRange.end
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
      
      console.log(`📊 Spese trovate: ${expenses.length}`);
      
      // Calcola totali per valuta
      const totalsByCurrency = {};
      expenses.forEach(expense => {
        if (!totalsByCurrency[expense.currency]) {
          totalsByCurrency[expense.currency] = 0;
        }
        totalsByCurrency[expense.currency] += expense.amount;
      });
      
      console.log('💰 Totali per valuta:');
      Object.entries(totalsByCurrency).forEach(([currency, total]) => {
        console.log(`  ${currency}: ${total.toFixed(2)}`);
      });
      
      // Calcola totale convertito in ZAR
      let totalInZAR = 0;
      expenses.forEach(expense => {
        if (expense.currency === 'ZAR') {
          totalInZAR += expense.amount;
        } else {
          const convertedAmount = expense.amount * expense.conversionRate;
          totalInZAR += convertedAmount;
        }
      });
      
      console.log(`🎯 TOTALE IN ZAR: ${totalInZAR.toFixed(2)}`);
      
      // Range date effettivo
      if (expenses.length > 0) {
        console.log(`📅 Range date effettivo: ${expenses[0].date.toISOString().split('T')[0]} → ${expenses[expenses.length - 1].date.toISOString().split('T')[0]}`);
      }
      
      results.push({
        filter: filter.name,
        description: filter.description,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        },
        expensesCount: expenses.length,
        totalInZAR: totalInZAR,
        totalsByCurrency
      });
    }
    
    // Riepilogo finale
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 RIEPILOGO COMPLETO TUTTI I FILTRI');
    console.log(`${'='.repeat(80)}`);
    
    results.forEach(result => {
      console.log(`\n${result.description} (${result.filter}):`);
      console.log(`  📊 Spese: ${result.expensesCount}`);
      console.log(`  💰 Totale ZAR: ${result.totalInZAR.toFixed(2)}`);
      console.log(`  📅 Range: ${result.dateRange.start.split('T')[0]} → ${result.dateRange.end.split('T')[0]}`);
    });
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ VERIFICA COMPLETATA - Confronta questi valori con il dashboard');
    console.log(`${'='.repeat(80)}`);
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllFilters(); 