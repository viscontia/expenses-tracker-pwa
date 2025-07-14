import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  icon: z.string().min(1),
});

const updateCategorySchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  icon: z.string().min(1).optional(),
});

const deleteCategorySchema = z.object({
  id: z.number(),
});

export const getCategories = protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const categories = await db.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    return categories;
  });

export const createCategory = protectedProcedure
  .input(createCategorySchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    // Check if category with same name already exists for this user
    const existingCategory = await db.category.findFirst({
      where: {
        userId,
        name: input.name,
      },
    });

    if (existingCategory) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Category with this name already exists",
      });
    }

    const category = await db.category.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        icon: input.icon,
      },
    });

    return category;
  });

export const updateCategory = protectedProcedure
  .input(updateCategorySchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    // Check if category exists and belongs to user
    const existingCategory = await db.category.findFirst({
      where: {
        id: input.id,
        userId,
      },
    });

    if (!existingCategory) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Category not found",
      });
    }

    // Check if updating name would create a duplicate
    if (input.name && input.name !== existingCategory.name) {
      const duplicateCategory = await db.category.findFirst({
        where: {
          userId,
          name: input.name,
          id: { not: input.id },
        },
      });

      if (duplicateCategory) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Category with this name already exists",
        });
      }
    }

    const category = await db.category.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description,
        icon: input.icon,
      },
    });

    return category;
  });

export const deleteCategory = protectedProcedure
  .input(deleteCategorySchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    // Check if category exists and belongs to user
    const existingCategory = await db.category.findFirst({
      where: {
        id: input.id,
        userId,
      },
    });

    if (!existingCategory) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Category not found",
      });
    }

    // Check if category is being used by any expenses
    const expenseCount = await db.expense.count({
      where: {
        categoryId: input.id,
        userId,
      },
    });

    if (expenseCount > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cannot delete category that is being used by expenses",
      });
    }

    await db.category.delete({
      where: { id: input.id },
    });

    return { success: true };
  });
