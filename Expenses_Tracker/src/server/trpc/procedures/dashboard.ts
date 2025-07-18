import { z } from "zod";
import { protectedProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { historicalRateService } from "~/server/services/historical-rate";
import { RawDashboardDB } from "~/server/db-dashboard";

// Funzione semplice per eseguire query senza profiling
const executeQuery = async <T>(queryFn: () => Promise<T>): Promise<T> => {
  return await queryFn();
};

/**
 * Converte un importo da una valuta all'altra usando tassi storici quando disponibili o tassi correnti come fallback
 * VERSIONE ORIGINALE - mantenuta come fallback
 */
const convertCurrency = async (
  amount: number, 
  fromCurrency: string, 
  toCurrency: string, 
  expenseId?: number
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Try to use historical rate if expenseId is provided
  if (expenseId) {
    try {
      const convertedAmount = await historicalRateService.convertWithHistoricalRate(
        amount, 
        fromCurrency, 
        toCurrency, 
        expenseId
      );
      return convertedAmount;
    } catch (error) {
      console.warn(`Failed to use historical rate for expense ${expenseId}, falling back to current rates:`, error);
      // Continue to fallback logic below
    }
  }

  // Fallback to current rates logic
  // Cerca il tasso di cambio più recente
  const exchangeRate = await RawDashboardDB.getLatestExchangeRate(fromCurrency, toCurrency);

  if (exchangeRate) {
    return amount * exchangeRate.rate;
  }

  // Se non trova il tasso diretto, prova il tasso inverso
  const inverseRate = await RawDashboardDB.getLatestExchangeRate(toCurrency, fromCurrency);

  if (inverseRate && inverseRate.rate !== 0) {
    return amount / inverseRate.rate;
  }

  // Fallback: se non trova nessun tasso, restituisce l'importo originale
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
};

/**
 * OTTIMIZZAZIONE: Converte valuta usando tassi già caricati (evita query N+1)
 */
const convertCurrencyOptimized = async (
  amount: number, 
  fromCurrency: string, 
  toCurrency: string, 
  historicalRates: Array<{ fromCurrency: string; toCurrency: string; rate: number }>,
  expenseId?: number
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Cerca il tasso storico tra quelli già caricati
  const historicalRate = historicalRates.find(
    rate => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency
  );

  if (historicalRate) {
    return amount * historicalRate.rate;
  }

  // Fallback ai tassi correnti solo se non trova tasso storico
  const exchangeRate = await RawDashboardDB.getLatestExchangeRate(fromCurrency, toCurrency);

  if (exchangeRate) {
    return amount * exchangeRate.rate;
  }

  // Se non trova il tasso diretto, prova il tasso inverso
  const inverseRate = await RawDashboardDB.getLatestExchangeRate(toCurrency, fromCurrency);

  if (inverseRate && inverseRate.rate !== 0) {
    return amount / inverseRate.rate;
  }

  // Fallback: se non trova nessun tasso, restituisce l'importo originale
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
};

/**
 * VERSIONE OTTIMIZZATA: Calcola il totale spese usando JOIN query invece di N+1 query
 */
const getTotalExpensesForPeriodOptimized = async (
  userId: number, 
  startDate: Date, 
  endDate: Date, 
  targetCurrency: string = 'EUR'
): Promise<number> => {
    // UNA SOLA QUERY con JOIN per ottenere spese + tassi storici
    const expensesWithRates = await RawDashboardDB.getExpensesWithHistoricalRates(userId, startDate, endDate);

    let total = 0;
    for (const expense of expensesWithRates) {
        // Usa i tassi già caricati, evita query separate
        const convertedAmount = await convertCurrencyOptimized(
          expense.amount, 
          expense.currency, 
          targetCurrency, 
          expense.historicalRates,
          expense.id
        );
        total += convertedAmount;
    }
    return total;
};

// Nuova funzione per ottenere le statistiche transazioni
const getTransactionCount = async (userId: number, startDate: Date, endDate: Date): Promise<number> => {
    const count = await RawDashboardDB.countExpensesByPeriod(userId, startDate, endDate);
    return count;
};

export const getKpis = protectedProcedure
    .input(z.object({
        targetCurrency: z.string().default('EUR'),
    }).optional())
    .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const targetCurrency = input?.targetCurrency ?? 'EUR';
        const now = new Date();
        
        console.log(`[PROFILING] === STARTING getKpis for userId: ${userId}, currency: ${targetCurrency} ===`);
        
        // OTTIMIZZAZIONE: Controllo rapido se l'utente ha spese prima di fare calcoli costosi
        const userExpenseCount = await executeQuery( 
            () => RawDashboardDB.getUserExpenseCount(userId)
        );
        
        // Se non ci sono spese, restituisci valori vuoti immediatamente
        if (userExpenseCount === 0) {
            console.log(`[PROFILING] === Early return: 0 expenses found ===`);
            return {
                totalCurrentMonth: 0,
                totalPreviousMonth: 0,
                comparativeCurrentMonth: 0,
                totalCurrentYear: 0,
                totalPreviousYear: 0,
                comparativeCurrentYear: 0,
                transactionCount: 0,
                targetCurrency,
            };
        }
        
        // Current Month Dates
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Previous Month Dates
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        
        // Comparative date for current month
        const comparativeDateInPreviousMonth = new Date(startOfPreviousMonth.getFullYear(), startOfPreviousMonth.getMonth(), now.getDate(), 23, 59, 59, 999);

        // Current Year Dates
        const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
        const endOfCurrentYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        // Previous Year Dates
        const startOfPreviousYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfPreviousYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

        // Comparative date for current year
        const comparativeDateInPreviousYear = new Date(startOfPreviousYear.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        const [
            totalCurrentMonth,
            totalPreviousMonth,
            comparativeCurrentMonth,
            totalCurrentYear,
            totalPreviousYear,
            comparativeCurrentYear,
            transactionCount,
        ] = await Promise.all([
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfCurrentMonth, endOfCurrentMonth, targetCurrency)
            ),
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfPreviousMonth, endOfPreviousMonth, targetCurrency)
            ),
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfPreviousMonth, comparativeDateInPreviousMonth, targetCurrency)
            ),
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfCurrentYear, endOfCurrentYear, targetCurrency)
            ),
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfPreviousYear, endOfPreviousYear, targetCurrency)
            ),
            executeQuery(() => 
                getTotalExpensesForPeriodOptimized(userId, startOfPreviousYear, comparativeDateInPreviousYear, targetCurrency)
            ),
            executeQuery(() => 
                getTransactionCount(userId, startOfCurrentMonth, endOfCurrentMonth)
            ),
        ]);

        console.log(`[PROFILING] === COMPLETED getKpis ===`);
        return {
            totalCurrentMonth,
            totalPreviousMonth,
            comparativeCurrentMonth,
            totalCurrentYear,
            totalPreviousYear,
            comparativeCurrentYear,
            transactionCount,
            targetCurrency,
        };
    });

const getTopCategoriesForPeriod = async (
  userId: number, 
  startDate: Date, 
  endDate: Date, 
  limit: number,
  targetCurrency: string = 'EUR'
) => {
    const expenses = await RawDashboardDB.getExpensesByPeriod(userId, startDate, endDate);

    const categoryTotals = new Map<number, number>();

    for (const expense of expenses) {
        // Pass expense ID to enable historical rate conversion
        const convertedAmount = await convertCurrencyOptimized(expense.amount, expense.currency, targetCurrency, [], expense.id);
        const currentTotal = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, currentTotal + convertedAmount);
    }

    const sortedCategories = Array.from(categoryTotals.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id]) => id);

    if (sortedCategories.length === 0) return [];
    
    const allCategories = await RawDashboardDB.getCategoriesByUser(userId);
    const categories = allCategories.filter(c => sortedCategories.includes(c.id));

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    return sortedCategories.map(id => ({
        id,
        name: categoryMap.get(id) || 'Unknown',
        amount: categoryTotals.get(id) || 0,
    }));
};

const getMonthlyTrend = async (userId: number, months: number, targetCurrency: string = 'EUR') => {
    const trendData: { month: string, amount: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        const total = await getTotalExpensesForPeriodOptimized(userId, startDate, endDate, targetCurrency);
        
        trendData.push({
            month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
            amount: total,
        });
    }
    return trendData.reverse();
};

const getYearlyTrend = async (userId: number, years: number, targetCurrency: string = 'EUR') => {
    const trendData: { year: string, amount: number }[] = [];
    const now = new Date();

    for (let i = 0; i < years; i++) {
        const year = now.getFullYear() - i;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        const total = await getTotalExpensesForPeriodOptimized(userId, startDate, endDate, targetCurrency);

        trendData.push({
            year: String(year),
            amount: total,
        });
    }
    return trendData.reverse();
};


export const getChartData = protectedProcedure
    .input(z.object({
        topCategoriesLimit: z.number().min(1).max(50).default(10),
        targetCurrency: z.string().default('EUR'),
    }).optional())
    .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const now = new Date();
        
        const limit = input?.topCategoriesLimit ?? 10;
        const targetCurrency = input?.targetCurrency ?? 'EUR';

        console.log(`[PROFILING] === STARTING getChartData for userId: ${userId}, currency: ${targetCurrency} ===`);

        // OTTIMIZZAZIONE: Controllo rapido se l'utente ha spese prima di fare calcoli costosi
        const userExpenseCount = await executeQuery( 
            () => RawDashboardDB.getUserExpenseCount(userId)
        );
        
        // Se non ci sono spese, restituisci valori vuoti immediatamente
        if (userExpenseCount === 0) {
            console.log(`[PROFILING] === Early return: 0 expenses found in getChartData ===`);
            return {
                categoryExpenses: [],
                monthlyTrend: [],
                targetCurrency,
            };
        }

        // Date ranges
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
        const endOfCurrentYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        const startOfPreviousYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfPreviousYear = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        
        const [
            categoryExpenses,
            monthlyTrend,
        ] = await Promise.all([
            executeQuery(() => 
                getTopCategoriesForPeriod(userId, startOfCurrentMonth, endOfCurrentMonth, limit, targetCurrency)
            ),
            executeQuery(() => 
                getMonthlyTrend(userId, 12, targetCurrency)
            ),
        ]);

        console.log(`[PROFILING] === COMPLETED getChartData ===`);
        return {
            categoryExpenses,
            monthlyTrend,
            targetCurrency,
        };
    });

export const getRecentExpenses = protectedProcedure
    .input(z.object({
        limit: z.number().min(1).max(50).default(10),
        targetCurrency: z.string().default('EUR'),
    }).optional())
    .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const limit = input?.limit ?? 10;
        const targetCurrency = input?.targetCurrency ?? 'EUR';

        console.log(`[PROFILING] === STARTING getRecentExpenses for userId: ${userId}, currency: ${targetCurrency} ===`);

        // OTTIMIZZAZIONE: Controllo rapido se l'utente ha spese prima di fare calcoli costosi
        const userExpenseCount = await executeQuery( 
            () => RawDashboardDB.getUserExpenseCount(userId)
        );
        
        // Se non ci sono spese, restituisci array vuoto immediatamente
        if (userExpenseCount === 0) {
            return [];
        }

        const rawExpenses = await executeQuery(() => 
            RawDashboardDB.getRecentExpenses(userId, limit)
        );
        
        // Get categories for all expenses
        const allCategories = await RawDashboardDB.getCategoriesByUser(userId);
        const categoryMap = new Map(allCategories.map(c => [c.id, c]));
        
        // Map raw expenses to include category data
        const expenses = rawExpenses.map(expense => ({
            ...expense,
            category: categoryMap.get(expense.categoryId) || { id: expense.categoryId, name: 'Unknown' }
        }));

        // Converte gli importi nella valuta target usando tassi storici quando disponibili
        const convertedExpenses = await Promise.all(
            expenses.map(async (expense) => {
                // Pass expense ID to enable historical rate conversion
                const convertedAmount = await convertCurrencyOptimized(expense.amount, expense.currency, targetCurrency, [], expense.id);
                
                // Get historical rate information for display
                let historicalRate: number | null = null;
                let rateSource: 'historical' | 'current' | 'same_currency' = 'same_currency';
                
                if (expense.currency !== targetCurrency) {
                    try {
                        historicalRate = await historicalRateService.getHistoricalRate(expense.id, expense.currency, targetCurrency);
                        rateSource = historicalRate !== null ? 'historical' : 'current';
                    } catch (error) {
                        console.warn(`Failed to get historical rate info for expense ${expense.id}:`, error);
                        rateSource = 'current';
                    }
                }
                
                return {
                    ...expense,
                    convertedAmount,
                    originalAmount: expense.amount,
                    originalCurrency: expense.currency,
                    targetCurrency,
                    historicalRate,
                    rateSource,
                };
            })
        );

        console.log(`[PROFILING] === COMPLETED getRecentExpenses ===`);
        return convertedExpenses;
    }); 