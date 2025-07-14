import {
  createCallerFactory,
  createTRPCRouter,
} from "~/server/trpc/main";
import { authRouter } from "./routers/auth";
import { categoriesRouter } from "./routers/categories";
import { expensesRouter } from "./routers/expenses";
import { currencyRouter } from "./routers/currency";
import { dashboardRouter } from "./routers/dashboard";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  categories: categoriesRouter,
  expenses: expensesRouter,
  currency: currencyRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
