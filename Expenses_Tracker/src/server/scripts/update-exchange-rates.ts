import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Definiamo le valute di base e quelle target
const BASE_CURRENCIES = ['ZAR', 'EUR'];
const TARGET_CURRENCIES = ['USD', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN'];

// API endpoint gratuito per i tassi di cambio
const API_URL = 'https://api.exchangerate-api.com/v4/latest/';

async function fetchExchangeRates(baseCurrency: string) {
  try {
    const response = await axios.get(`${API_URL}${baseCurrency}`);
    if (response.data && response.data.rates) {
      return response.data.rates;
    }
    console.error(`Could not fetch rates for ${baseCurrency}`);
    return null;
  } catch (error) {
    console.error(`Error fetching exchange rates for ${baseCurrency}:`, error);
    return null;
  }
}

async function updateDatabase(rates: any, baseCurrency: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const targetCurrency of TARGET_CURRENCIES) {
    if (rates[targetCurrency]) {
      const rate = rates[targetCurrency];
      
      try {
        await prisma.exchangeRate.upsert({
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
        console.log(`Updated rate: 1 ${baseCurrency} = ${rate} ${targetCurrency}`);
      } catch (error) {
        console.error(`Error updating DB for ${baseCurrency} -> ${targetCurrency}:`, error);
      }
    }
  }
}

async function main() {
  console.log('📈 Starting exchange rates update...');
  
  for (const base of BASE_CURRENCIES) {
    console.log(`\nFetching rates for base currency: ${base}`);
    const rates = await fetchExchangeRates(base);
    if (rates) {
      // Aggiungiamo anche le altre valute di base come target
      const allTargets = [...TARGET_CURRENCIES, ...BASE_CURRENCIES.filter(c => c !== base)];
      await updateDatabase(rates, base);
    }
  }

  console.log('\n✅ Exchange rates update finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 