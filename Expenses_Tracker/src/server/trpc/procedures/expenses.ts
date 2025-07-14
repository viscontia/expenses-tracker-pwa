import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";

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
    const where: any = { userId };
    if (input.categoryIds && input.categoryIds.length > 0) {
      where.categoryId = { in: input.categoryIds };
    }
    if (input.startDate || input.endDate) {
      where.date = {};
      if (input.startDate) where.date.gte = new Date(input.startDate);
      if (input.endDate) where.date.lte = new Date(input.endDate);
    }
    const expenses = await db.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
      take: input.limit,
      skip: input.offset,
    });
    const total = await db.expense.count({ where });
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
    const category = await db.category.findFirst({
      where: { id: input.categoryId, userId },
    });
    if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    const expense = await db.expense.create({
      data: { ...input, userId, date: new Date(input.date) },
      include: { category: true },
    });
    return expense;
  });

export const updateExpense = protectedProcedure
  .input(updateExpenseSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const existingExpense = await db.expense.findFirst({
      where: { id: input.id, userId },
    });
    if (!existingExpense) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    if (input.categoryId) {
      const category = await db.category.findFirst({
        where: { id: input.categoryId, userId },
      });
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    }
    const expense = await db.expense.update({
      where: { id: input.id },
      data: { 
        ...input, 
        ...(input.date && { date: new Date(input.date) }) 
      },
      include: { category: true },
    });
    return expense;
  });

export const deleteExpense = protectedProcedure
  .input(deleteExpenseSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const existingExpense = await db.expense.findFirst({
      where: { id: input.id, userId },
    });
    if (!existingExpense) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
    await db.expense.delete({ where: { id: input.id } });
    return { success: true };
  });
