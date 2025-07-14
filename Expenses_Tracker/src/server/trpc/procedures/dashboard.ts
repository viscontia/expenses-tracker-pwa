import { z } from "zod";
import { protectedProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

/**
 * Converte un importo da una valuta all'altra usando i tassi di cambio più recenti
 */
const convertCurrency = async (amount: number, fromCurrency: string, toCurrency: string): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Cerca il tasso di cambio più recente
  const exchangeRate = await db.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (exchangeRate) {
    return amount * exchangeRate.rate;
  }

  // Se non trova il tasso diretto, prova il tasso inverso
  const inverseRate = await db.exchangeRate.findFirst({
    where: {
      fromCurrency: toCurrency,
      toCurrency: fromCurrency,
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (inverseRate && inverseRate.rate !== 0) {
    return amount / inverseRate.rate;
  }

  // Fallback: se non trova nessun tasso, restituisce l'importo originale
  console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  return amount;
};

/**
 * Calculates the total expenses in a target currency for a given user and period.
 * It converts amounts from other currencies using real-time exchange rates.
 */
const getTotalExpensesForPeriod = async (
  userId: number, 
  startDate: Date, 
  endDate: Date, 
  targetCurrency: string = 'EUR'
): Promise<number> => {
    const expenses = await db.expense.findMany({
        where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
    });

    let total = 0;
    for (const expense of expenses) {
        const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency);
        total += convertedAmount;
    }
    return total;
};

// Nuova funzione per ottenere le statistiche transazioni
const getTransactionCount = async (userId: number, startDate: Date, endDate: Date): Promise<number> => {
    const count = await db.expense.count({
        where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
    });
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
            getTotalExpensesForPeriod(userId, startOfCurrentMonth, endOfCurrentMonth, targetCurrency),
            getTotalExpensesForPeriod(userId, startOfPreviousMonth, endOfPreviousMonth, targetCurrency),
            getTotalExpensesForPeriod(userId, startOfPreviousMonth, comparativeDateInPreviousMonth, targetCurrency),
            getTotalExpensesForPeriod(userId, startOfCurrentYear, endOfCurrentYear, targetCurrency),
            getTotalExpensesForPeriod(userId, startOfPreviousYear, endOfPreviousYear, targetCurrency),
            getTotalExpensesForPeriod(userId, startOfPreviousYear, comparativeDateInPreviousYear, targetCurrency),
            getTransactionCount(userId, startOfCurrentMonth, endOfCurrentMonth),
        ]);

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
    const expenses = await db.expense.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        select: { amount: true, currency: true, categoryId: true },
    });

    const categoryTotals = new Map<number, number>();

    for (const expense of expenses) {
        const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency);
        const currentTotal = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, currentTotal + convertedAmount);
    }

    const sortedCategories = Array.from(categoryTotals.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id]) => id);

    if (sortedCategories.length === 0) return [];
    
    const categories = await db.category.findMany({
        where: { id: { in: sortedCategories } },
        select: { id: true, name: true },
    });

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
        const total = await getTotalExpensesForPeriod(userId, startDate, endDate, targetCurrency);
        
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
        const total = await getTotalExpensesForPeriod(userId, startDate, endDate, targetCurrency);

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
            getTopCategoriesForPeriod(userId, startOfCurrentMonth, endOfCurrentMonth, limit, targetCurrency),
            getMonthlyTrend(userId, 12, targetCurrency),
        ]);

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

        const expenses = await db.expense.findMany({
            where: { userId },
            include: { category: true },
            orderBy: { date: 'desc' },
            take: limit,
        });

        // Converte gli importi nella valuta target
        const convertedExpenses = await Promise.all(
            expenses.map(async (expense) => {
                const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency);
                return {
                    ...expense,
                    convertedAmount,
                    originalAmount: expense.amount,
                    originalCurrency: expense.currency,
                    targetCurrency,
                };
            })
        );

        return convertedExpenses;
    }); 