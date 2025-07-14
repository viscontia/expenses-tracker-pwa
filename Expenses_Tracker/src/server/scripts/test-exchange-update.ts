import { db } from "~/server/db";

async function testExchangeRateUpdate() {
  console.log("🧪 Testing exchange rate update...");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Verifica stato attuale
  const existingRates = await db.exchangeRate.findMany({
    where: {
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  
  console.log(`📊 Current rates for today: ${existingRates.length}`);
  
  if (existingRates.length > 0) {
    console.log("📋 Sample rates:");
    existingRates.slice(0, 5).forEach(rate => {
      console.log(`   ${rate.fromCurrency} → ${rate.toCurrency}: ${rate.rate}`);
    });
  }
  
  // Test API call
  try {
    console.log("🌐 Testing API call...");
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await response.json();
    
    console.log("✅ API Response sample:");
    console.log(`   EUR → USD: ${data.rates.USD}`);
    console.log(`   EUR → ZAR: ${data.rates.ZAR}`);
    console.log(`   Available currencies: ${Object.keys(data.rates).length}`);
    
  } catch (error) {
    console.error("❌ API Error:", error);
  }
  
  await db.$disconnect();
  console.log("🏁 Test completed");
}

testExchangeRateUpdate().catch(console.error); 