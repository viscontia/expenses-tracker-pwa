import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { fetchExchangeRate, convertAmount } from "~/server/utils/currency";
import { RawCurrencyDB } from "~/server/db-raw";
import { exchangeRateCache } from "~/server/services/exchange-rate-cache";

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
    today.setHours(0, 0, 0, 0);
    
    // Verifica se abbiamo già aggiornato oggi usando SQL raw
    const existingUpdate = await RawCurrencyDB.checkExistingRatesForDate(today);

    if (existingUpdate) {
      return {
        success: true,
        message: "Exchange rates already updated today",
        skipped: true,
      };
    }

    try {
      const baseCurrencies = ['EUR', 'ZAR'];
      const targetCurrencies = ['USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'INR'];
      
      let updatedRates = 0;
      
      for (const baseCurrency of baseCurrencies) {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        if (!response.ok) {
          console.error(`Failed to fetch rates for ${baseCurrency}`);
          continue;
        }
        
        const data = await response.json();
        const allTargets = [...targetCurrencies, ...baseCurrencies.filter(c => c !== baseCurrency)];
        
        for (const targetCurrency of allTargets) {
          const rate = data.rates[targetCurrency];
          if (rate) {
            await RawCurrencyDB.upsertExchangeRate(baseCurrency, targetCurrency, rate, today);
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
      const latestUpdate = await RawCurrencyDB.getLastExchangeRateUpdate();

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
      const currencies = await RawCurrencyDB.getAvailableCurrencies();

      const currencySet = new Set<string>();
      currencies.forEach(rate => {
        currencySet.add(rate.fromCurrency);
        currencySet.add(rate.toCurrency);
      });

      const availableCurrencies = Array.from(currencySet).sort();

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
      // Fallback completo con tutte le valute supportate
      const fallbackCurrencies = [
        'EUR', 'USD', 'GBP', 'ZAR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD', 'MXN', 'INR'
      ];
      
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
      
      return fallbackCurrencies.map(code => ({
        code,
        name: currencyNames[code] || code,
        symbol: getSymbolForCurrency(code),
      }));
    }
  });

// Procedura per ottenere le cache metrics
export const getCacheMetrics = baseProcedure
  .query(async () => {
    try {
      const metrics = exchangeRateCache.getMetrics();
      const status = exchangeRateCache.getStatusSummary();
      
      return {
        success: true,
        metrics,
        status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching cache metrics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  });

// Procedura per invalidare la cache
export const invalidateCache = baseProcedure
  .input(z.object({
    currency: z.string().optional(),
    clearAll: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      let removed = 0;
      
      if (input.clearAll) {
        exchangeRateCache.clear();
        removed = -1; // Indicates full clear
      } else if (input.currency) {
        removed = exchangeRateCache.invalidateCurrency(input.currency);
      }
      
      return {
        success: true,
        removed,
        message: input.clearAll 
          ? 'Cache completely cleared' 
          : `Cache invalidated for ${input.currency || 'all currencies'}`,
      };
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

// Procedura per warming della cache
export const warmCache = baseProcedure
  .input(z.object({
    pairs: z.array(z.object({
      from: z.string(),
      to: z.string(),
      rate: z.number(),
    })),
  }))
  .mutation(async ({ input }) => {
    try {
      exchangeRateCache.warmCacheWithRates(input.pairs);
      
      return {
        success: true,
        warmed: input.pairs.length,
        message: `Cache warmed with ${input.pairs.length} exchange rate pairs`,
      };
    } catch (error) {
      console.error('Error warming cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

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
