const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyJuly2025Expenses() {
  try {
    console.log('🔍 Verifica spese Luglio 2025...\n');
    
    // Query 1: Spese di Luglio 2025 (1-31 Luglio)
    const julyExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-07-01'),
          lte: new Date('2025-07-31 23:59:59')
        }
      },
      include: {
        category: true
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log(`📊 Spese trovate in Luglio 2025: ${julyExpenses.length}`);
    
    // Calcola totali per valuta
    const totalsByCurrency = {};
    julyExpenses.forEach(expense => {
      if (!totalsByCurrency[expense.currency]) {
        totalsByCurrency[expense.currency] = 0;
      }
      totalsByCurrency[expense.currency] += expense.amount;
    });
    
    console.log('\n💰 Totali per valuta:');
    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      console.log(`  ${currency}: ${total.toFixed(2)}`);
    });
    
    // Query 2: Spese con conversioni per ZAR
    const julyExpensesWithRates = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-07-01'),
          lte: new Date('2025-07-31 23:59:59')
        }
      },
      include: {
        historicalRates: {
          where: {
            fromCurrency: { not: 'ZAR' },
            toCurrency: 'ZAR'
          }
        }
      }
    });
    
    console.log('\n🔄 Spese con tassi di conversione per ZAR:');
    julyExpensesWithRates.forEach(expense => {
      if (expense.currency !== 'ZAR') {
        const rate = expense.historicalRates[0];
        if (rate) {
          const convertedAmount = expense.amount * parseFloat(rate.rate);
          console.log(`  ${expense.date.toISOString().split('T')[0]} - ${expense.amount} ${expense.currency} → ${convertedAmount.toFixed(2)} ZAR (tasso: ${rate.rate})`);
        } else {
          console.log(`  ${expense.date.toISOString().split('T')[0]} - ${expense.amount} ${expense.currency} → NO TASSO DISPONIBILE`);
        }
      }
    });
    
    // Query 3: Calcolo totale convertito in ZAR
    let totalInZAR = 0;
    julyExpenses.forEach(expense => {
      if (expense.currency === 'ZAR') {
        totalInZAR += expense.amount;
      } else {
        // Usa il tasso di conversione registrato
        const convertedAmount = expense.amount * expense.conversionRate;
        totalInZAR += convertedAmount;
        console.log(`  ${expense.date.toISOString().split('T')[0]} - ${expense.amount} ${expense.currency} → ${convertedAmount.toFixed(2)} ZAR (tasso: ${expense.conversionRate})`);
      }
    });
    
    console.log(`\n🎯 TOTALE LUGLIO 2025 IN ZAR: ${totalInZAR.toFixed(2)}`);
    
    // Query 4: Verifica date range esatto
    const dateRange = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-07-01'),
          lte: new Date('2025-07-31 23:59:59')
        }
      },
      select: {
        date: true,
        amount: true,
        currency: true
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log('\n📅 Range date Luglio 2025:');
    if (dateRange.length > 0) {
      console.log(`  Prima spesa: ${dateRange[0].date.toISOString()}`);
      console.log(`  Ultima spesa: ${dateRange[dateRange.length - 1].date.toISOString()}`);
    }
    
    // Query 5: Confronto con i valori riportati
    console.log('\n📊 CONFRONTO VALORI:');
    console.log(`  Dashboard: R 103.970,72`);
    console.log(`  Elenco Spese: R 28.307,60`);
    console.log(`  Database (VERO): R ${totalInZAR.toFixed(2)}`);
    
    if (Math.abs(totalInZAR - 103970.72) < 0.01) {
      console.log('  ✅ Dashboard CORRETTO');
    } else {
      console.log('  ❌ Dashboard ERRATO');
    }
    
    if (Math.abs(totalInZAR - 28307.60) < 0.01) {
      console.log('  ✅ Elenco Spese CORRETTO');
    } else {
      console.log('  ❌ Elenco Spese ERRATO');
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyJuly2025Expenses(); 