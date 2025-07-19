import { createTRPCRouter } from "~/server/trpc/main";
import { 
  getExchangeRate, 
  convertCurrency,
  updateDailyExchangeRates,
  getAvailableCurrencies,
  getLastExchangeRateUpdate,
  getCacheMetrics,
  invalidateCache,
  warmCache
} from "~/server/trpc/procedures/currency";

export const currencyRouter = createTRPCRouter({
  getExchangeRate,
  convertCurrency,
  updateDailyExchangeRates,
  getAvailableCurrencies,
  getLastExchangeRateUpdate,
  getCacheMetrics,
  invalidateCache,
  warmCache,
}); 