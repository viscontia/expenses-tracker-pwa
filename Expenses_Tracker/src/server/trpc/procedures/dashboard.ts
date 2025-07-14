import { z } from "zod";
import { protectedProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";

/**
 * Calculates the total expenses in EUR for a given user and period.
 * It converts amounts from other currencies using the conversionRate.
 * @param userId - The ID of the user.
 * @param startDate - The start date of the period.
 * @param endDate - The end date of the period.
 * @returns The total expenses in EUR.
 */
const getTotalExpensesForPeriod = async (userId: number, startDate: Date, endDate: Date): Promise<number> => {
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
        if (expense.currency === 'EUR') {
            total += expense.amount;
        } else if (expense.conversionRate > 0) {
            // Assuming conversionRate stores how many units of the foreign currency one EUR is.
            // E.g., if currency is ZAR and rate is 20, it means 1 EUR = 20 ZAR.
            total += expense.amount / expense.conversionRate;
        }
    }
    return total;
};

const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
};

export const getKpis = protectedProcedure
    .query(async ({ ctx }) => {
        const userId = ctx.user.id;
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
        ] = await Promise.all([
            getTotalExpensesForPeriod(userId, startOfCurrentMonth, endOfCurrentMonth),
            getTotalExpensesForPeriod(userId, startOfPreviousMonth, endOfPreviousMonth),
            getTotalExpensesForPeriod(userId, startOfPreviousMonth, comparativeDateInPreviousMonth),
            getTotalExpensesForPeriod(userId, startOfCurrentYear, endOfCurrentYear),
            getTotalExpensesForPeriod(userId, startOfPreviousYear, endOfPreviousYear),
            getTotalExpensesForPeriod(userId, startOfPreviousYear, comparativeDateInPreviousYear),
        ]);

        return {
            totalCurrentMonth,
            totalPreviousMonth,
            comparativeCurrentMonth,
            totalCurrentYear,
            totalPreviousYear,
            comparativeCurrentYear,
        };
    });

const getTopCategoriesForPeriod = async (userId: number, startDate: Date, endDate: Date, limit: number) => {
    const expenses = await db.expense.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        select: { amount: true, currency: true, conversionRate: true, categoryId: true },
    });

    const categoryTotals = new Map<number, number>();

    for (const expense of expenses) {
        let amountInEur = 0;
        if (expense.currency === 'EUR') {
            amountInEur = expense.amount;
        } else if (expense.conversionRate > 0) {
            amountInEur = expense.amount / expense.conversionRate;
        }

        const currentTotal = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, currentTotal + amountInEur);
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
        category: categoryMap.get(id) || 'Unknown',
        amount: categoryTotals.get(id) || 0,
    }));
};

const getMonthlyTrend = async (userId: number, months: number) => {
    const trendData: { month: string, amount: number }[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        const total = await getTotalExpensesForPeriod(userId, startDate, endDate);
        
        trendData.push({
            month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
            amount: total,
        });
    }
    return trendData.reverse();
};

const getYearlyTrend = async (userId: number, years: number) => {
    const trendData: { year: string, amount: number }[] = [];
    const now = new Date();

    for (let i = 0; i < years; i++) {
        const year = now.getFullYear() - i;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        const total = await getTotalExpensesForPeriod(userId, startDate, endDate);

        trendData.push({
            year: String(year),
            amount: total,
        });
    }
    return trendData.reverse();
};


export const getChartData = protectedProcedure
    .input(z.object({
        topCategoriesLimit: z.number().min(1).max(20).default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const now = new Date();
        
        const limit = input?.topCategoriesLimit ?? 10;

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
            topCategoriesCurrentMonth,
            topCategoriesPreviousMonth,
            topCategoriesCurrentYear,
            topCategoriesPreviousYear,
            monthOverMonthTrend,
            yearOverYearTrend,
        ] = await Promise.all([
            getTopCategoriesForPeriod(userId, startOfCurrentMonth, endOfCurrentMonth, limit),
            getTopCategoriesForPeriod(userId, startOfPreviousMonth, endOfPreviousMonth, limit),
            getTopCategoriesForPeriod(userId, startOfCurrentYear, endOfCurrentYear, limit),
            getTopCategoriesForPeriod(userId, startOfPreviousYear, endOfPreviousYear, limit),
            getMonthlyTrend(userId, 12),
            getYearlyTrend(userId, 5),
        ]);

        const combineCategoryData = (
            current: { category: string, amount: number }[], 
            previous: { category: string, amount: number }[]
        ) => {
            const combined = new Map<string, { current: number, previous: number }>();
            current.forEach(c => combined.set(c.category, { current: c.amount, previous: 0 }));
            previous.forEach(p => {
                const existing = combined.get(p.category);
                if (existing) {
                    existing.previous = p.amount;
                } else {
                    combined.set(p.category, { current: 0, previous: p.amount });
                }
            });
            return Array.from(combined.entries()).map(([category, amounts]) => ({ category, ...amounts }));
        };

        const comparisonMonth = combineCategoryData(topCategoriesCurrentMonth, topCategoriesPreviousMonth);
        const comparisonYear = combineCategoryData(topCategoriesCurrentYear, topCategoriesPreviousYear);

        return {
            topCategoriesCurrentMonth,
            topCategoriesPreviousMonth,
            topCategoriesCurrentYear,
            topCategoriesPreviousYear,
            comparisonMonth,
            comparisonYear,
            monthOverMonthTrend,
            yearOverYearTrend,
        };
    });

export const getRecentExpenses = protectedProcedure
    .input(z.object({
        limit: z.number().min(1).max(50).default(10),
    }).optional())
    .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const limit = input?.limit ?? 10;

        const expenses = await db.expense.findMany({
            where: { userId },
            include: { category: true },
            orderBy: { date: 'desc' },
            take: limit,
        });

        return expenses;
    }); 