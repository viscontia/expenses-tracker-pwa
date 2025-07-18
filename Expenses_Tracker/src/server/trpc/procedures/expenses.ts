import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, baseProcedure } from "~/server/trpc/main";
import { RawExpensesDB } from "~/server/db-raw";
import { historicalRateService } from "~/server/services/historical-rate";

const createExpenseSchema = z.object({
  categoryId: z.number(),
  amount: z.number().positive(),
  currency: z.enum(['ZAR', 'EUR']),
  conversionRate: z.number().positive(),
  date: z.string().datetime(),
  description: z.string().max(200).optional(),
});

const updateExpenseSchema = z.object({
  id: z.number(),
  categoryId: z.number().optional(),
  amount: z.number().positive().optional(),
  currency: z.enum(['ZAR', 'EUR']).optional(),
  conversionRate: z.number().positive().optional(),
  date: z.string().datetime().optional(),
  description: z.string().max(200).optional(),
});

const deleteExpenseSchema = z.object({
  id: z.number(),
});

const getExpensesSchema = z.object({
  categoryIds: z.array(z.number()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const analyticsSchema = z.object({
  categoryCount: z.number().min(1).max(50).default(10),
});

export const getExpenses = protectedProcedure
  .input(getExpensesSchema)
  .query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    
    const startDate = input.startDate ? new Date(input.startDate) : undefined;
    const endDate = input.endDate ? new Date(input.endDate) : undefined;
    
    const expenses = await RawExpensesDB.getExpensesWithCategories(
      userId,
      input.categoryIds,
      startDate,
      endDate,
      input.limit,
      input.offset
    );
    
    const total = await RawExpensesDB.countExpenses(
      userId,
      input.categoryIds,
      startDate,
      endDate
    );
    
    return {
      expenses,
      total,
      hasMore: total > input.offset + input.limit,
    };
  });

export const createExpense = protectedProcedure
  .input(createExpenseSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const category = await RawExpensesDB.findCategoryById(input.categoryId, userId);
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    
    const expense = await RawExpensesDB.createExpense(
      userId,
      input.categoryId,
      input.amount,
      input.currency,
      input.conversionRate,
      input.date,
      input.description
    );

    // Save historical rates after expense creation
    // This operation should not fail the expense creation if it encounters errors
    try {
      await historicalRateService.saveRatesForExpense(expense.id, expense.date);
      console.log(`Successfully saved historical rates for expense ${expense.id}`);
    } catch (error) {
      // Log the error but don't fail the expense creation
      console.error(`Failed to save historical rates for expense ${expense.id}:`, error);
      // In a production environment, you might want to queue this for retry
      // or send an alert to monitoring systems
    }

    return {
      ...expense,
      category
    };
  });

export const updateExpense = protectedProcedure
  .input(updateExpenseSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const existingExpense = await RawExpensesDB.findExpenseById(input.id, userId);
    if (!existingExpense) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    
    if (input.categoryId) {
      const category = await RawExpensesDB.findCategoryById(input.categoryId, userId);
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    }
    
    const expense = await RawExpensesDB.updateExpense(
      input.id,
      userId,
      {
        categoryId: input.categoryId,
        amount: input.amount,
        currency: input.currency,
        conversionRate: input.conversionRate,
        date: input.date,
        description: input.description
      }
    );

    // If the date was updated, save new historical rates for the new date
    if (input.date && new Date(input.date).getTime() !== existingExpense.date.getTime()) {
      try {
        await historicalRateService.saveRatesForExpense(expense.id, expense.date);
        console.log(`Successfully saved historical rates for updated expense ${expense.id}`);
      } catch (error) {
        // Log the error but don't fail the expense update
        console.error(`Failed to save historical rates for updated expense ${expense.id}:`, error);
      }
    }

    // Get category info for return
    const category = await RawExpensesDB.findCategoryById(expense.categoryId, userId);
    
    return {
      ...expense,
      category
    };
  });

export const deleteExpense = protectedProcedure
  .input(deleteExpenseSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const existingExpense = await RawExpensesDB.findExpenseById(input.id, userId);
    if (!existingExpense) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    await RawExpensesDB.deleteExpense(input.id, userId);
    return { success: true };
  });
