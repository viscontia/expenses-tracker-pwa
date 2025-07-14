import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { baseProcedure } from '../main'; // Adjust if needed
import { db } from '../../db';
import { verifyToken } from '../../utils/auth';

// Then the rest of the file

// For getAuthenticatedUserId, if not defined, add:
const getAuthenticatedUserId = (token: string): number => {
  try {
    const { userId } = verifyToken(token);
    return userId;
  } catch (error) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
};

// Change enum to string:
currency: z.string().length(3),

// Add procedure for getExpensesByCategoryAndPeriod
export const getExpensesByCategoryAndPeriod = baseProcedure
  .input(z.object({
    token: z.string(),
    categoryId: z.number(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    sortBy: z.enum(['date', 'amount', 'description']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }))
  .query(async ({ input }) => {
    const userId = getAuthenticatedUserId(input.token);
    return db.expense.findMany({
      where: {
        userId,
        categoryId: input.categoryId,
        date: { gte: new Date(input.startDate), lte: new Date(input.endDate) },
      },
      orderBy: { [input.sortBy]: input.sortOrder },
      include: { category: true },
    });
  });

// For getMonthlyTrends:
export const getMonthlyTrends = baseProcedure
  .input(z.object({ token: z.string(), months: z.number().default(12) }))
  .query(async ({ input }) => {
    const userId = getAuthenticatedUserId(input.token);
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - input.months + 1);
    startDate.setDate(1);

    const trends = await db.$queryRaw`
      SELECT 
        date_trunc('month', date) as month,
        SUM(amount) as total
      FROM expenses
      WHERE user_id = ${userId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      GROUP BY month
      ORDER BY month ASC
    `;
    return trends;
  });

// Similarly for getYearlyTrends:
export const getYearlyTrends = baseProcedure
  .input(z.object({ token: z.string(), years: z.number().default(5) }))
  .query(async ({ input }) => {
    const userId = getAuthenticatedUserId(input.token);
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - input.years + 1);
    startDate.setMonth(0);
    startDate.setDate(1);

    const trends = await db.$queryRaw`
      SELECT 
        date_trunc('year', date) as year,
        SUM(amount) as total
      FROM expenses
      WHERE user_id = ${userId}
        AND date >= ${startDate}
        AND date <= ${endDate}
      GROUP BY year
      ORDER BY year ASC
    `;
    return trends;
  });