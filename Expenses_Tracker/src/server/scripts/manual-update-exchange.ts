import { db } from "~/server/db";

async function manualUpdateExchangeRates() {
  console.log("🚀 Manual exchange rates update starting...");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    // Valute principali del progetto
    const baseCurrencies = ['EUR', 'ZAR'];
    // Valute target da aggiornare
    const targetCurrencies = ['USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'INR'];
    
    let updatedRates = 0;
    
    for (const baseCurrency of baseCurrencies) {
      console.log(`\n📊 Fetching rates for ${baseCurrency}...`);
      
      // Fetch da API pubblica
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      if (!response.ok) {
        console.error(`❌ Failed to fetch rates for ${baseCurrency}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`✅ Got ${Object.keys(data.rates).length} rates from API`);
      
      // Aggiorna anche le valute base reciproche
      const allTargets = [...targetCurrencies, ...baseCurrencies.filter(c => c !== baseCurrency)];
      
      for (const targetCurrency of allTargets) {
        const rate = data.rates[targetCurrency];
        if (rate) {
          const result = await db.exchangeRate.upsert({
            where: {
              fromCurrency_toCurrency_date: {
                fromCurrency: baseCurrency,
                toCurrency: targetCurrency,
                date: today,
              },
            },
            update: { rate },
            create: {
              fromCurrency: baseCurrency,
              toCurrency: targetCurrency,
              rate,
              date: today,
            },
          });
          
          console.log(`   ${baseCurrency} → ${targetCurrency}: ${rate}`);
          updatedRates++;
        }
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedRates} exchange rates!`);
    
    // Verifica risultato
    const totalRates = await db.exchangeRate.count({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
    
    console.log(`📈 Total rates in database for today: ${totalRates}`);
    
  } catch (error) {
    console.error('❌ Error updating exchange rates:', error);
  } finally {
    await db.$disconnect();
    console.log('🏁 Manual update completed');
  }
}

manualUpdateExchangeRates().catch(console.error); 