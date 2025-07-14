import { createTRPCRouter } from "~/server/trpc/main";
import { 
  getExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense
} from "~/server/trpc/procedures/expenses";

export const expensesRouter = createTRPCRouter({
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
}); 