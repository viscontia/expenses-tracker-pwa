import { createTRPCRouter } from './trpc';
import { getExpensesByCategoryAndPeriod, getMonthlyTrends, getYearlyTrends } from '~/server/trpc/procedures/expenses';

export const appRouter = createTRPCRouter({
  // ... existing procedures
  getExpensesByCategoryAndPeriod,
  getMonthlyTrends,
  getYearlyTrends,
});