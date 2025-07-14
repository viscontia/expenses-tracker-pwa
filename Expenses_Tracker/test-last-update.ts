// Test per verificare la query getLastExchangeRateUpdate
import { db } from "./src/server/db";

async function testLastUpdate() {
  try {
    console.log("🧪 Testing getLastExchangeRateUpdate...");
    
    const latestUpdate = await db.exchangeRate.findFirst({
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
        fromCurrency: true,
        toCurrency: true,
        rate: true,
      },
    });

    if (latestUpdate) {
      console.log("✅ Last update found:");
      console.log(`   Date: ${latestUpdate.date.toLocaleDateString('it-IT')}`);
      console.log(`   Sample rate: ${latestUpdate.fromCurrency} → ${latestUpdate.toCurrency}: ${latestUpdate.rate}`);
      
      // Formatto come apparirà nella UI
      const formattedText = `Valute aggiornate al ${latestUpdate.date.toLocaleDateString('it-IT')}`;
      console.log(`   UI Text: "${formattedText}"`);
    } else {
      console.log("❌ No exchange rate data found");
    }
    
  } catch (error) {
    console.error('❌ Error testing last update:', error);
  } finally {
    await db.$disconnect();
  }
}

testLastUpdate(); 