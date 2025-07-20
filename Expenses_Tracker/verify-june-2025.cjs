const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyJune2025Expenses() {
  try {
    console.log('🔍 Verifica spese Giugno 2025...\n');
    
    // Query 1: Spese di Giugno 2025 (1-30 Giugno)
    const juneExpenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-06-01'),
          lte: new Date('2025-06-30 23:59:59')
        }
      },
      include: {
        category: true
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log(`📊 Spese trovate in Giugno 2025: ${juneExpenses.length}`);
    
    // Calcola totali per valuta
    const totalsByCurrency = {};
    juneExpenses.forEach(expense => {
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
    const juneExpensesWithRates = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-06-01'),
          lte: new Date('2025-06-30 23:59:59')
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
    juneExpensesWithRates.forEach(expense => {
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
    juneExpenses.forEach(expense => {
      if (expense.currency === 'ZAR') {
        totalInZAR += expense.amount;
      } else {
        // Usa il tasso di conversione registrato
        const convertedAmount = expense.amount * expense.conversionRate;
        totalInZAR += convertedAmount;
        console.log(`  ${expense.date.toISOString().split('T')[0]} - ${expense.amount} ${expense.currency} → ${convertedAmount.toFixed(2)} ZAR (tasso: ${expense.conversionRate})`);
      }
    });
    
    console.log(`\n🎯 TOTALE GIUGNO 2025 IN ZAR: ${totalInZAR.toFixed(2)}`);
    
    // Query 4: Verifica date range esatto
    const dateRange = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date('2025-06-01'),
          lte: new Date('2025-06-30 23:59:59')
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
    
    console.log('\n📅 Range date Giugno 2025:');
    if (dateRange.length > 0) {
      console.log(`  Prima spesa: ${dateRange[0].date.toISOString()}`);
      console.log(`  Ultima spesa: ${dateRange[dateRange.length - 1].date.toISOString()}`);
    }
    
  } catch (error) {
    console.error('❌ Errore durante la verifica:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyJune2025Expenses(); 