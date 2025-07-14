import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { fetchExchangeRate, convertAmount } from "~/server/utils/currency";
import { db } from "~/server/db";

const getExchangeRateSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
});

const convertAmountSchema = z.object({
  amount: z.number().positive(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
});

export const getExchangeRate = baseProcedure
  .input(getExchangeRateSchema)
  .query(async ({ input }) => {
    const rate = await fetchExchangeRate(input.fromCurrency, input.toCurrency);
    return {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      rate,
    };
  });

export const convertCurrency = baseProcedure
  .input(convertAmountSchema)
  .query(async ({ input }) => {
    const result = await convertAmount(
      input.amount,
      input.fromCurrency,
      input.toCurrency,
    );
    
    return {
      originalAmount: input.amount,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      convertedAmount: result.convertedAmount,
      rate: result.rate,
    };
  });

// Nuova procedura per l'aggiornamento quotidiano delle valute
export const updateDailyExchangeRates = baseProcedure
  .mutation(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    // Verifica se abbiamo già aggiornato oggi
    const existingUpdate = await db.exchangeRate.findFirst({
      where: {
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
      },
    });

    if (existingUpdate) {
      return {
        success: true,
        message: "Exchange rates already updated today",
        skipped: true,
      };
    }

    try {
      // Valute principali del progetto
      const baseCurrencies = ['EUR', 'ZAR'];
      // Valute target da aggiornare
      const targetCurrencies = ['USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'INR'];
      
      let updatedRates = 0;
      
      for (const baseCurrency of baseCurrencies) {
        // Fetch da API pubblica
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        if (!response.ok) {
          console.error(`Failed to fetch rates for ${baseCurrency}`);
          continue;
        }
        
        const data = await response.json();
        
        // Aggiorna anche le valute base reciproche
        const allTargets = [...targetCurrencies, ...baseCurrencies.filter(c => c !== baseCurrency)];
        
        for (const targetCurrency of allTargets) {
          const rate = data.rates[targetCurrency];
          if (rate) {
            await db.exchangeRate.upsert({
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
            updatedRates++;
          }
        }
      }

      return {
        success: true,
        message: `Exchange rates updated successfully`,
        updatedRates,
        skipped: false,
      };
    } catch (error) {
      console.error('Error updating exchange rates:', error);
      return {
        success: false,
        message: 'Failed to update exchange rates',
        error: error instanceof Error ? error.message : 'Unknown error',
        skipped: false,
      };
    }
  });

// Nuova procedura per ottenere la data dell'ultimo aggiornamento valutario
export const getLastExchangeRateUpdate = baseProcedure
  .query(async () => {
    try {
      const latestUpdate = await db.exchangeRate.findFirst({
        orderBy: {
          date: 'desc',
        },
        select: {
          date: true,
        },
      });

      if (latestUpdate) {
        return {
          success: true,
          lastUpdateDate: latestUpdate.date,
        };
      }

      return {
        success: false,
        lastUpdateDate: null,
        message: "No exchange rate data found",
      };
    } catch (error) {
      console.error('Error fetching last exchange rate update:', error);
      return {
        success: false,
        lastUpdateDate: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

// Nuova procedura per ottenere le valute disponibili
export const getAvailableCurrencies = baseProcedure
  .query(async () => {
    try {
      // Ottieni tutte le valute uniche dalla tabella exchange_rates
      const currencies = await db.exchangeRate.findMany({
        select: {
          fromCurrency: true,
          toCurrency: true,
        },
        distinct: ['fromCurrency', 'toCurrency'],
      });

      // Crea un set di tutte le valute uniche
      const currencySet = new Set<string>();
      currencies.forEach(rate => {
        currencySet.add(rate.fromCurrency);
        currencySet.add(rate.toCurrency);
      });

      // Converti in array e ordina
      const availableCurrencies = Array.from(currencySet).sort();

      // Mappa i nomi delle valute
      const currencyNames: Record<string, string> = {
        'EUR': 'Euro (€)',
        'USD': 'US Dollar ($)',
        'GBP': 'British Pound (£)', 
        'ZAR': 'South African Rand (R)',
        'JPY': 'Japanese Yen (¥)',
        'AUD': 'Australian Dollar (A$)',
        'CAD': 'Canadian Dollar (C$)',
        'CHF': 'Swiss Franc (CHF)',
        'CNY': 'Chinese Yuan (¥)',
        'SEK': 'Swedish Krona (SEK)',
        'NZD': 'New Zealand Dollar (NZ$)',
        'MXN': 'Mexican Peso (MXN)',
        'INR': 'Indian Rupee (₹)',
      };

      return availableCurrencies.map(code => ({
        code,
        name: currencyNames[code] || code,
        symbol: getSymbolForCurrency(code),
      }));
    } catch (error) {
      console.error('Error getting available currencies:', error);
      // Fallback alle valute principali
      return [
        { code: 'EUR', name: 'Euro (€)', symbol: '€' },
        { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
        { code: 'ZAR', name: 'South African Rand (R)', symbol: 'R' },
      ];
    }
  });

// Helper function per i simboli delle valute
function getSymbolForCurrency(code: string): string {
  const symbols: Record<string, string> = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'ZAR': 'R',
    'JPY': '¥',
    'AUD': 'A$',
    'CAD': 'C$',
    'CHF': 'CHF',
    'CNY': '¥',
    'SEK': 'SEK',
    'NZD': 'NZ$',
    'MXN': 'MXN',
    'INR': '₹',
  };
  return symbols[code] || code;
}
