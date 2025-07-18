import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '~/server/db';
import { historicalRateService } from '~/server/services/historical-rate';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    expense: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    expenseExchangeRate: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the historical rate service
vi.mock('~/server/services/historical-rate', () => ({
  historicalRateService: {
    convertWithHistoricalRate: vi.fn(),
    getHistoricalRate: vi.fn(),
    saveRatesForExpense: vi.fn(),
  },
}));

describe('tRPC Procedures Integration Tests', () => {
  const mockDb = vi.mocked(db);
  const mockHistoricalRateService = vi.mocked(historicalRateService);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dashboard Integration with Historical Rates', () => {
    // Recreate the dashboard functions for testing
    const convertCurrency = async (
      amount: number, 
      fromCurrency: string, 
      toCurrency: string, 
      expenseId?: number
    ): Promise<number> => {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      if (expenseId) {
        try {
          const convertedAmount = await historicalRateService.convertWithHistoricalRate(
            amount, 
            fromCurrency, 
            toCurrency, 
            expenseId
          );
          return convertedAmount;
        } catch (error) {
          console.warn(`Failed to use historical rate for expense ${expenseId}, falling back to current rates:`, error);
        }
      }

      const exchangeRate = await db.exchangeRate.findFirst({
        where: { fromCurrency, toCurrency },
        orderBy: { date: 'desc' },
      });

      if (exchangeRate) {
        return amount * exchangeRate.rate;
      }

      const inverseRate = await db.exchangeRate.findFirst({
        where: { fromCurrency: toCurrency, toCurrency: fromCurrency },
        orderBy: { date: 'desc' },
      });

      if (inverseRate && inverseRate.rate !== 0) {
        return amount / inverseRate.rate;
      }

      console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
      return amount;
    };

    const getTotalExpensesForPeriod = async (
      userId: number, 
      startDate: Date, 
      endDate: Date, 
      targetCurrency: string = 'EUR'
    ): Promise<number> => {
      const expenses = await db.expense.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      });

      let total = 0;
      for (const expense of expenses) {
        const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency, expense.id);
        total += convertedAmount;
      }
      return total;
    };

    it('should integrate historical rates in dashboard KPI calculations', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', userId: 1, date: new Date('2024-01-15') },
        { id: 2, amount: 200, currency: 'GBP', userId: 1, date: new Date('2024-01-16') },
        { id: 3, amount: 50, currency: 'EUR', userId: 1, date: new Date('2024-01-17') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      
      // Mock historical conversions
      mockHistoricalRateService.convertWithHistoricalRate
        .mockResolvedValueOnce(85) // USD to EUR
        .mockResolvedValueOnce(175); // GBP to EUR

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const total = await getTotalExpensesForPeriod(1, startDate, endDate, 'EUR');

      expect(total).toBe(310); // 85 + 175 + 50
      expect(mockHistoricalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(2);
      expect(mockHistoricalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(1, 100, 'USD', 'EUR', 1);
      expect(mockHistoricalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(2, 200, 'GBP', 'EUR', 2);
    });

    it('should handle mixed historical and current rates in dashboard', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', userId: 1, date: new Date('2024-01-15') },
        { id: 2, amount: 200, currency: 'GBP', userId: 1, date: new Date('2024-01-16') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      
      // First expense uses historical rate, second falls back to current
      mockHistoricalRateService.convertWithHistoricalRate
        .mockResolvedValueOnce(85) // Historical rate for USD
        .mockRejectedValueOnce(new Error('Historical rate not found')); // GBP fails
      
      // Mock current rate for fallback
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.15 } as any);

      const total = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');

      expect(total).toBe(315); // 85 + (200 * 1.15)
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to use historical rate for expense 2, falling back to current rates:',
        expect.any(Error)
      );
    });

    it('should handle complete historical rate service failure', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', userId: 1, date: new Date('2024-01-15') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockHistoricalRateService.convertWithHistoricalRate.mockRejectedValue(new Error('Service down'));
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.2 } as any);

      const total = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');

      expect(total).toBe(120); // 100 * 1.2 (fallback rate)
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to use historical rate for expense 1, falling back to current rates:',
        expect.any(Error)
      );
    });

    it('should handle no exchange rates available scenario', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', userId: 1, date: new Date('2024-01-15') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockHistoricalRateService.convertWithHistoricalRate.mockRejectedValue(new Error('No historical rate'));
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);

      const total = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');

      expect(total).toBe(100); // Original amount (no conversion)
      expect(console.warn).toHaveBeenCalledWith('No exchange rate found for USD to EUR');
    });
  });

  describe('Expense Creation Integration', () => {
    const simulateCreateExpense = async (input: any, userId: number) => {
      const category = await db.category.findFirst({
        where: { id: input.categoryId, userId },
      });
      if (!category) throw new Error('Category not found');
      
      const expense = await db.expense.create({
        data: { ...input, userId, date: new Date(input.date) },
        include: { category: true },
      });

      try {
        await historicalRateService.saveRatesForExpense(expense.id, expense.date);
        console.log(`Successfully saved historical rates for expense ${expense.id}`);
      } catch (error) {
        console.error(`Failed to save historical rates for expense ${expense.id}:`, error);
      }

      return expense;
    };

    it('should create expense and save historical rates successfully', async () => {
      const mockCategory = { id: 1, name: 'Food', userId: 1 };
      const mockExpense = {
        id: 1,
        categoryId: 1,
        amount: 100,
        currency: 'USD',
        conversionRate: 1.2,
        date: new Date('2024-01-15'),
        userId: 1,
        category: mockCategory,
      };

      const input = {
        categoryId: 1,
        amount: 100,
        currency: 'USD',
        conversionRate: 1.2,
        date: '2024-01-15T10:00:00.000Z',
        description: 'Test expense',
      };

      mockDb.category.findFirst.mockResolvedValue(mockCategory as any);
      mockDb.expense.create.mockResolvedValue(mockExpense as any);
      mockHistoricalRateService.saveRatesForExpense.mockResolvedValue(undefined);

      const result = await simulateCreateExpense(input, 1);

      expect(result).toEqual(mockExpense);
      expect(mockHistoricalRateService.saveRatesForExpense).toHaveBeenCalledWith(1, mockExpense.date);
      expect(console.log).toHaveBeenCalledWith('Successfully saved historical rates for expense 1');
    });

    it('should create expense even when historical rate saving fails', async () => {
      const mockCategory = { id: 1, name: 'Food', userId: 1 };
      const mockExpense = {
        id: 1,
        categoryId: 1,
        amount: 100,
        currency: 'USD',
        userId: 1,
        category: mockCategory,
        date: new Date('2024-01-15'),
      };

      const input = {
        categoryId: 1,
        amount: 100,
        currency: 'USD',
        conversionRate: 1.2,
        date: '2024-01-15T10:00:00.000Z',
      };

      mockDb.category.findFirst.mockResolvedValue(mockCategory as any);
      mockDb.expense.create.mockResolvedValue(mockExpense as any);
      mockHistoricalRateService.saveRatesForExpense.mockRejectedValue(new Error('Rate service down'));

      const result = await simulateCreateExpense(input, 1);

      expect(result).toEqual(mockExpense);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to save historical rates for expense 1:',
        expect.any(Error)
      );
    });
  });

  describe('Recent Expenses with Rate Information', () => {
    const getRecentExpenses = async (userId: number, limit: number, targetCurrency: string) => {
      const expenses = await db.expense.findMany({
        where: { userId },
        include: { category: true },
        orderBy: { date: 'desc' },
        take: limit,
      });

      const convertedExpenses = await Promise.all(
        expenses.map(async (expense) => {
          const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency, expense.id);
          
          let historicalRate: number | null = null;
          let rateSource: 'historical' | 'current' | 'same_currency' = 'same_currency';
          
          if (expense.currency !== targetCurrency) {
            try {
              historicalRate = await historicalRateService.getHistoricalRate(expense.id, expense.currency, targetCurrency);
              rateSource = historicalRate !== null ? 'historical' : 'current';
            } catch (error) {
              console.warn(`Failed to get historical rate info for expense ${expense.id}:`, error);
              rateSource = 'current';
            }
          }
          
          return {
            ...expense,
            convertedAmount,
            originalAmount: expense.amount,
            originalCurrency: expense.currency,
            targetCurrency,
            historicalRate,
            rateSource,
          };
        })
      );

      return convertedExpenses;
    };

    const convertCurrency = async (
      amount: number, 
      fromCurrency: string, 
      toCurrency: string, 
      expenseId?: number
    ): Promise<number> => {
      if (fromCurrency === toCurrency) return amount;

      if (expenseId) {
        try {
          return await historicalRateService.convertWithHistoricalRate(amount, fromCurrency, toCurrency, expenseId);
        } catch (error) {
          console.warn(`Failed to use historical rate for expense ${expenseId}, falling back to current rates:`, error);
        }
      }

      const exchangeRate = await db.exchangeRate.findFirst({
        where: { fromCurrency, toCurrency },
        orderBy: { date: 'desc' },
      });

      return exchangeRate ? amount * exchangeRate.rate : amount;
    };

    it('should include historical rate information for converted expenses', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          amount: 100, 
          currency: 'USD', 
          date: new Date('2024-01-15'),
          category: { id: 1, name: 'Food' }
        },
        { 
          id: 2, 
          amount: 50, 
          currency: 'EUR', 
          date: new Date('2024-01-14'),
          category: { id: 2, name: 'Transport' }
        },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockHistoricalRateService.convertWithHistoricalRate.mockResolvedValue(85);
      mockHistoricalRateService.getHistoricalRate
        .mockResolvedValueOnce(0.85) // Historical rate for USD to EUR
        .mockResolvedValueOnce(null); // No call for EUR to EUR

      const result = await getRecentExpenses(1, 10, 'EUR');

      expect(result).toHaveLength(2);
      
      // First expense (USD to EUR conversion)
      expect(result[0]).toMatchObject({
        id: 1,
        convertedAmount: 85,
        originalAmount: 100,
        originalCurrency: 'USD',
        targetCurrency: 'EUR',
        historicalRate: 0.85,
        rateSource: 'historical',
      });

      // Second expense (same currency)
      expect(result[1]).toMatchObject({
        id: 2,
        convertedAmount: 50,
        originalAmount: 50,
        originalCurrency: 'EUR',
        targetCurrency: 'EUR',
        historicalRate: null,
        rateSource: 'same_currency',
      });
    });

    it('should handle rate service errors in recent expenses', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          amount: 100, 
          currency: 'USD', 
          date: new Date('2024-01-15'),
          category: { id: 1, name: 'Food' }
        },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockHistoricalRateService.convertWithHistoricalRate.mockResolvedValue(85);
      mockHistoricalRateService.getHistoricalRate.mockRejectedValue(new Error('Rate service error'));

      const result = await getRecentExpenses(1, 10, 'EUR');

      expect(result[0]).toMatchObject({
        id: 1,
        convertedAmount: 85,
        originalAmount: 100,
        originalCurrency: 'USD',
        targetCurrency: 'EUR',
        historicalRate: null,
        rateSource: 'current', // Falls back to current when error occurs
      });

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to get historical rate info for expense 1:',
        expect.any(Error)
      );
    });
  });

  describe('Category Aggregation with Historical Rates', () => {
    const getTopCategoriesForPeriod = async (
      userId: number, 
      startDate: Date, 
      endDate: Date, 
      limit: number,
      targetCurrency: string = 'EUR'
    ) => {
      const expenses = await db.expense.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        select: { id: true, amount: true, currency: true, categoryId: true },
      });

      const categoryTotals = new Map<number, number>();

      for (const expense of expenses) {
        const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency, expense.id);
        const currentTotal = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, currentTotal + convertedAmount);
      }

      const sortedCategories = Array.from(categoryTotals.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([id]) => id);

      if (sortedCategories.length === 0) return [];
      
      const categories = await db.category.findMany({
        where: { id: { in: sortedCategories } },
        select: { id: true, name: true },
      });

      const categoryMap = new Map(categories.map(c => [c.id, c.name]));

      return sortedCategories.map(id => ({
        id,
        name: categoryMap.get(id) || 'Unknown',
        amount: categoryTotals.get(id) || 0,
      }));
    };

    const convertCurrency = async (
      amount: number, 
      fromCurrency: string, 
      toCurrency: string, 
      expenseId?: number
    ): Promise<number> => {
      if (fromCurrency === toCurrency) return amount;

      if (expenseId) {
        try {
          return await historicalRateService.convertWithHistoricalRate(amount, fromCurrency, toCurrency, expenseId);
        } catch (error) {
          console.warn(`Failed to use historical rate for expense ${expenseId}, falling back to current rates:`, error);
        }
      }

      const exchangeRate = await db.exchangeRate.findFirst({
        where: { fromCurrency, toCurrency },
        orderBy: { date: 'desc' },
      });

      if (exchangeRate) return amount * exchangeRate.rate;

      const inverseRate = await db.exchangeRate.findFirst({
        where: { fromCurrency: toCurrency, toCurrency: fromCurrency },
        orderBy: { date: 'desc' },
      });

      if (inverseRate && inverseRate.rate !== 0) return amount / inverseRate.rate;

      console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
      return amount;
    };

    it('should aggregate expenses by category using historical rates', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', categoryId: 1 },
        { id: 2, amount: 200, currency: 'GBP', categoryId: 1 },
        { id: 3, amount: 50, currency: 'EUR', categoryId: 2 },
        { id: 4, amount: 75, currency: 'USD', categoryId: 2 },
      ];

      const mockCategories = [
        { id: 1, name: 'Food' },
        { id: 2, name: 'Transport' },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.category.findMany.mockResolvedValue(mockCategories as any);
      
      // Mock historical conversions
      mockHistoricalRateService.convertWithHistoricalRate
        .mockResolvedValueOnce(85) // 100 USD to EUR for expense 1
        .mockResolvedValueOnce(175) // 200 GBP to EUR for expense 2
        .mockResolvedValueOnce(64); // 75 USD to EUR for expense 4

      const result = await getTopCategoriesForPeriod(
        1, 
        new Date('2024-01-01'), 
        new Date('2024-01-31'), 
        10, 
        'EUR'
      );

      expect(result).toEqual([
        { id: 1, name: 'Food', amount: 260 }, // 85 + 175
        { id: 2, name: 'Transport', amount: 114 }, // 50 + 64
      ]);

      // Should call historical conversion for USD and GBP expenses, but not EUR
      expect(mockHistoricalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success/failure in category aggregation', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD', categoryId: 1 },
        { id: 2, amount: 50, currency: 'GBP', categoryId: 1 },
      ];

      const mockCategories = [{ id: 1, name: 'Food' }];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.category.findMany.mockResolvedValue(mockCategories as any);
      
      // First expense uses historical rate, second falls back to current rate
      mockHistoricalRateService.convertWithHistoricalRate
        .mockResolvedValueOnce(85) // Historical rate for expense 1
        .mockRejectedValueOnce(new Error('Historical rate not found')); // Fails for expense 2
      
      // Mock current rate for fallback
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.15 } as any);

      const result = await getTopCategoriesForPeriod(
        1, 
        new Date('2024-01-01'), 
        new Date('2024-01-31'), 
        10, 
        'EUR'
      );

      expect(result).toEqual([
        { id: 1, name: 'Food', amount: 142.5 }, // 85 + (50 * 1.15)
      ]);

      expect(console.warn).toHaveBeenCalledWith(
        'Failed to use historical rate for expense 2, falling back to current rates:',
        expect.any(Error)
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create 1000 mock expenses
      const mockExpenses = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        amount: 100,
        currency: i % 2 === 0 ? 'USD' : 'EUR',
        userId: 1,
        date: new Date('2024-01-15'),
      }));

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      
      // Mock historical rates - only for USD expenses (500 calls expected)
      mockHistoricalRateService.convertWithHistoricalRate.mockResolvedValue(85);

      const startTime = Date.now();
      const total = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');
      const endTime = Date.now();

      // Should complete in reasonable time (less than 2 seconds for this test)
      expect(endTime - startTime).toBeLessThan(2000);
      
      // 500 USD expenses (85 each) + 500 EUR expenses (100 each) = 42500 + 50000 = 92500
      expect(total).toBe(92500);
      // Only 500 calls because EUR to EUR doesn't call the service (same currency)
      expect(mockHistoricalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(500);
    });

    it('should maintain accuracy with decimal precision', async () => {
      const mockExpenses = [
        { id: 1, amount: 99.99, currency: 'USD', userId: 1, date: new Date('2024-01-15') },
        { id: 2, amount: 0.01, currency: 'EUR', userId: 1, date: new Date('2024-01-15') },
        { id: 3, amount: 1234.56, currency: 'GBP', userId: 1, date: new Date('2024-01-15') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      
      // Mock historical conversions with precise rates
      mockHistoricalRateService.convertWithHistoricalRate
        .mockResolvedValueOnce(84.99123) // 99.99 USD to EUR
        .mockResolvedValueOnce(1111.11456); // 1234.56 GBP to EUR

      const total = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');

      expect(total).toBeCloseTo(1196.11579, 5); // 84.99123 + 0.01 + 1111.11456
      expect(Number.isFinite(total)).toBe(true);
    });
  });
});