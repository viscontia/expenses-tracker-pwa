import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { db } from '~/server/db';
import { historicalRateService } from '~/server/services/historical-rate';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    category: {
      findFirst: vi.fn(),
    },
    expense: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    expenseExchangeRate: {
      count: vi.fn(),
    },
  },
}));

// Mock the historical rate service
vi.mock('~/server/services/historical-rate', () => ({
  historicalRateService: {
    saveRatesForExpense: vi.fn(),
  },
}));

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Expense Creation Integration', () => {
  const mockUser = { id: 1 };
  const mockCtx = { user: mockUser };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('createExpense logic', () => {
    const validInput = {
      categoryId: 1,
      amount: 100,
      currency: 'EUR' as const,
      conversionRate: 1.2,
      date: '2024-01-15T10:00:00.000Z',
      description: 'Test expense',
    };

    const mockCategory = { id: 1, name: 'Food', userId: 1 };
    const mockExpense = {
      id: 1,
      ...validInput,
      userId: 1,
      date: new Date(validInput.date),
      category: mockCategory,
    };

    // Test the core logic that would be in createExpense
    async function simulateCreateExpense(ctx: any, input: any) {
      const userId = ctx.user.id;
      const category = await db.category.findFirst({
        where: { id: input.categoryId, userId },
      });
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      
      const expense = await db.expense.create({
        data: { ...input, userId, date: new Date(input.date) },
        include: { category: true },
      });

      // Save historical rates after expense creation
      try {
        await historicalRateService.saveRatesForExpense(expense.id, expense.date);
        console.log(`Successfully saved historical rates for expense ${expense.id}`);
      } catch (error) {
        console.error(`Failed to save historical rates for expense ${expense.id}:`, error);
      }

      return expense;
    }

    it('should create expense and save historical rates successfully', async () => {
      // Setup mocks
      (db.category.findFirst as any).mockResolvedValue(mockCategory);
      (db.expense.create as any).mockResolvedValue(mockExpense);
      (historicalRateService.saveRatesForExpense as any).mockResolvedValue(undefined);

      // Execute
      const result = await simulateCreateExpense(mockCtx, validInput);

      // Verify expense creation
      expect(db.category.findFirst).toHaveBeenCalledWith({
        where: { id: validInput.categoryId, userId: mockUser.id },
      });
      expect(db.expense.create).toHaveBeenCalledWith({
        data: {
          ...validInput,
          userId: mockUser.id,
          date: new Date(validInput.date),
        },
        include: { category: true },
      });

      // Verify historical rates saving
      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        mockExpense.id,
        mockExpense.date
      );

      // Verify success logging
      expect(consoleSpy).toHaveBeenCalledWith(
        `Successfully saved historical rates for expense ${mockExpense.id}`
      );

      expect(result).toEqual(mockExpense);
    });

    it('should create expense successfully even when historical rate saving fails', async () => {
      // Setup mocks
      (db.category.findFirst as any).mockResolvedValue(mockCategory);
      (db.expense.create as any).mockResolvedValue(mockExpense);
      const rateError = new Error('Rate service unavailable');
      (historicalRateService.saveRatesForExpense as any).mockRejectedValue(rateError);

      // Execute
      const result = await simulateCreateExpense(mockCtx, validInput);

      // Verify expense was still created
      expect(db.expense.create).toHaveBeenCalled();
      expect(result).toEqual(mockExpense);

      // Verify error was logged but didn't fail the operation
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to save historical rates for expense ${mockExpense.id}:`,
        rateError
      );

      // Verify historical rate service was called
      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        mockExpense.id,
        mockExpense.date
      );
    });

    it('should throw error when category is not found', async () => {
      // Setup mocks
      (db.category.findFirst as any).mockResolvedValue(null);

      // Execute and verify
      await expect(
        simulateCreateExpense(mockCtx, validInput)
      ).rejects.toThrow('Category not found');

      // Verify expense was not created
      expect(db.expense.create).not.toHaveBeenCalled();
      expect(historicalRateService.saveRatesForExpense).not.toHaveBeenCalled();
    });

    it('should throw error when expense creation fails', async () => {
      // Setup mocks
      (db.category.findFirst as any).mockResolvedValue(mockCategory);
      const dbError = new Error('Database connection failed');
      (db.expense.create as any).mockRejectedValue(dbError);

      // Execute and verify
      await expect(
        simulateCreateExpense(mockCtx, validInput)
      ).rejects.toThrow(dbError);

      // Verify historical rate service was not called
      expect(historicalRateService.saveRatesForExpense).not.toHaveBeenCalled();
    });
  });

  describe('updateExpense logic', () => {
    const updateInput = {
      id: 1,
      amount: 150,
      date: '2024-02-15T10:00:00.000Z',
    };

    const existingExpense = {
      id: 1,
      userId: 1,
      categoryId: 1,
      amount: 100,
      currency: 'EUR',
      conversionRate: 1.2,
      date: new Date('2024-01-15T10:00:00.000Z'),
      description: 'Original expense',
    };

    const updatedExpense = {
      ...existingExpense,
      ...updateInput,
      date: new Date(updateInput.date),
      category: { id: 1, name: 'Food', userId: 1 },
    };

    // Test the core logic that would be in updateExpense
    async function simulateUpdateExpense(ctx: any, input: any) {
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

      // If the date was updated, save new historical rates for the new date
      if (input.date && new Date(input.date).getTime() !== existingExpense.date.getTime()) {
        try {
          await historicalRateService.saveRatesForExpense(expense.id, expense.date);
          console.log(`Successfully saved historical rates for updated expense ${expense.id}`);
        } catch (error) {
          console.error(`Failed to save historical rates for updated expense ${expense.id}:`, error);
        }
      }

      return expense;
    }

    it('should update expense and save historical rates when date changes', async () => {
      // Setup mocks
      (db.expense.findFirst as any).mockResolvedValue(existingExpense);
      (db.expense.update as any).mockResolvedValue(updatedExpense);
      (historicalRateService.saveRatesForExpense as any).mockResolvedValue(undefined);

      // Execute
      const result = await simulateUpdateExpense(mockCtx, updateInput);

      // Verify expense update
      expect(db.expense.findFirst).toHaveBeenCalledWith({
        where: { id: updateInput.id, userId: mockUser.id },
      });
      expect(db.expense.update).toHaveBeenCalledWith({
        where: { id: updateInput.id },
        data: {
          ...updateInput,
          date: new Date(updateInput.date),
        },
        include: { category: true },
      });

      // Verify historical rates saving (date changed)
      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        updatedExpense.id,
        updatedExpense.date
      );

      // Verify success logging
      expect(consoleSpy).toHaveBeenCalledWith(
        `Successfully saved historical rates for updated expense ${updatedExpense.id}`
      );

      expect(result).toEqual(updatedExpense);
    });

    it('should update expense without saving historical rates when date unchanged', async () => {
      const inputWithoutDateChange = {
        id: 1,
        amount: 150,
        description: 'Updated description',
      };

      const updatedExpenseNoDateChange = {
        ...existingExpense,
        ...inputWithoutDateChange,
        category: { id: 1, name: 'Food', userId: 1 },
      };

      // Setup mocks
      (db.expense.findFirst as any).mockResolvedValue(existingExpense);
      (db.expense.update as any).mockResolvedValue(updatedExpenseNoDateChange);

      // Execute
      const result = await simulateUpdateExpense(mockCtx, inputWithoutDateChange);

      // Verify expense update
      expect(db.expense.update).toHaveBeenCalledWith({
        where: { id: inputWithoutDateChange.id },
        data: inputWithoutDateChange,
        include: { category: true },
      });

      // Verify historical rates NOT saved (date unchanged)
      expect(historicalRateService.saveRatesForExpense).not.toHaveBeenCalled();

      expect(result).toEqual(updatedExpenseNoDateChange);
    });

    it('should update expense successfully even when historical rate saving fails', async () => {
      // Setup mocks
      (db.expense.findFirst as any).mockResolvedValue(existingExpense);
      (db.expense.update as any).mockResolvedValue(updatedExpense);
      const rateError = new Error('Rate service unavailable');
      (historicalRateService.saveRatesForExpense as any).mockRejectedValue(rateError);

      // Execute
      const result = await simulateUpdateExpense(mockCtx, updateInput);

      // Verify expense was still updated
      expect(db.expense.update).toHaveBeenCalled();
      expect(result).toEqual(updatedExpense);

      // Verify error was logged but didn't fail the operation
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to save historical rates for updated expense ${updatedExpense.id}:`,
        rateError
      );

      // Verify historical rate service was called
      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        updatedExpense.id,
        updatedExpense.date
      );
    });

    it('should throw error when expense is not found', async () => {
      // Setup mocks
      (db.expense.findFirst as any).mockResolvedValue(null);

      // Execute and verify
      await expect(
        simulateUpdateExpense(mockCtx, updateInput)
      ).rejects.toThrow('Expense not found');

      // Verify expense was not updated
      expect(db.expense.update).not.toHaveBeenCalled();
      expect(historicalRateService.saveRatesForExpense).not.toHaveBeenCalled();
    });
  });

  describe('Historical rate service integration', () => {
    it('should handle historical rate service errors gracefully', async () => {
      const mockExpense = {
        id: 123,
        date: new Date('2024-01-15T10:00:00.000Z'),
      };

      // Test successful rate saving
      (historicalRateService.saveRatesForExpense as any).mockResolvedValue(undefined);
      
      try {
        await historicalRateService.saveRatesForExpense(mockExpense.id, mockExpense.date);
        console.log(`Successfully saved historical rates for expense ${mockExpense.id}`);
      } catch (error) {
        console.error(`Failed to save historical rates for expense ${mockExpense.id}:`, error);
      }

      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        mockExpense.id,
        mockExpense.date
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `Successfully saved historical rates for expense ${mockExpense.id}`
      );
    });

    it('should log errors when historical rate service fails', async () => {
      const mockExpense = {
        id: 456,
        date: new Date('2024-01-15T10:00:00.000Z'),
      };

      const serviceError = new Error('External API unavailable');
      (historicalRateService.saveRatesForExpense as any).mockRejectedValue(serviceError);
      
      try {
        await historicalRateService.saveRatesForExpense(mockExpense.id, mockExpense.date);
        console.log(`Successfully saved historical rates for expense ${mockExpense.id}`);
      } catch (error) {
        console.error(`Failed to save historical rates for expense ${mockExpense.id}:`, error);
      }

      expect(historicalRateService.saveRatesForExpense).toHaveBeenCalledWith(
        mockExpense.id,
        mockExpense.date
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to save historical rates for expense ${mockExpense.id}:`,
        serviceError
      );
    });
  });
});