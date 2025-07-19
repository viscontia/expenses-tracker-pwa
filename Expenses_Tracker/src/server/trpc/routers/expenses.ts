import { createTRPCRouter } from "~/server/trpc/main";
import { 
  getExpenses, 
  getExpenseById,
  createExpense, 
  updateExpense, 
  deleteExpense
} from "~/server/trpc/procedures/expenses";

export const expensesRouter = createTRPCRouter({
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
}); 