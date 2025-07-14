import { createTRPCRouter } from "~/server/trpc/main";
import { getKpis, getChartData, getRecentExpenses } from "~/server/trpc/procedures/dashboard";

export const dashboardRouter = createTRPCRouter({
  getKpis,
  getChartData,
  getRecentExpenses,
}); 