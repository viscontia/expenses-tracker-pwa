import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure, protectedProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { hashPassword, verifyPassword, signToken } from "~/server/utils/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const tokenSchema = z.object({
  token: z.string(),
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  defaultCurrency: z.string().optional(),
  currencyOrder: z.array(z.string()).optional(),
  chartCategoryCount: z.number().optional(),
});

export const register = baseProcedure
  .input(registerSchema)
  .mutation(async ({ input }) => {
    const { email, password } = input;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User with this email already exists",
      });
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const newUser = await db.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
      },
    });

    // Generate token
    const token = signToken(newUser.id, process.env.JWT_SECRET!);

    const { password: _, ...userResponse } = newUser;
    return { user: userResponse, token };
  });

export const login = baseProcedure
  .input(loginSchema)
  .mutation(async ({ input }) => {
    const { email, password } = input;

    // Find user
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = signToken(user.id, process.env.JWT_SECRET!);

    const { password: _, ...userResponse } = user;

    return {
      user: userResponse,
      token,
    };
  });

export const getCurrentUser = protectedProcedure.query(async ({ ctx }) => {
  try {
    const user = await db.user.findUnique({
      where: { id: ctx.user.id },
    });

    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not found - please login again",
      });
    }

    const { password, ...userResponse } = user;
    return userResponse;
  } catch (error) {
    // If there's any database error, treat as unauthorized
    throw new TRPCError({
      code: "UNAUTHORIZED", 
      message: "Authentication failed - please login again",
    });
  }
});

export const updatePreferences = protectedProcedure
  .input(
    z.object({
      theme: z.enum(["light", "dark"]).optional(),
      defaultCurrency: z.string().optional(),
      currencyOrder: z.array(z.string()).optional(),
      chartCategoryCount: z.number().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const user = await db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
    }

    const currentPreferences = (user.preferences as object) ?? {};

    const updatedPreferences = {
      ...currentPreferences,
      ...input,
    };

    await db.user.update({
      where: { id: userId },
      data: {
        preferences: updatedPreferences,
      },
    });

    return { success: true };
  });
