import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '~/server/db';
import { historicalRateService } from '~/server/services/historical-rate';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    expense: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    exchangeRate: {
      findFirst: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the historical rate service
vi.mock('~/server/services/historical-rate', () => ({
  historicalRateService: {
    convertWithHistoricalRate: vi.fn(),
    getHistoricalRate: vi.fn(),
  },
}));

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Dashboard Currency Conversion Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockClear();
  });

  // Import the functions we need to test by recreating them
  const convertCurrency = async (
    amount: number, 
    fromCurrency: string, 
    toCurrency: string, 
    expenseId?: number
  ): Promise<number> => {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // Try to use historical rate if expenseId is provided
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
        // Continue to fallback logic below
      }
    }

    // Fallback to current rates logic
    const exchangeRate = await db.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (exchangeRate) {
      return amount * exchangeRate.rate;
    }

    // Try inverse rate
    const inverseRate = await db.exchangeRate.findFirst({
      where: {
        fromCurrency: toCurrency,
        toCurrency: fromCurrency,
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (inverseRate && inverseRate.rate !== 0) {
      return amount / inverseRate.rate;
    }

    // Fallback: return original amount
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
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let total = 0;
    for (const expense of expenses) {
      // Pass expense ID to enable historical rate conversion
      const convertedAmount = await convertCurrency(expense.amount, expense.currency, targetCurrency, expense.id);
      total += convertedAmount;
    }
    return total;
  };

  describe('convertCurrency function', () => {
    it('should return same amount when currencies are identical', async () => {
      const result = await convertCurrency(100, 'EUR', 'EUR');
      expect(result).toBe(100);
      
      // Should not call any external services
      expect(historicalRateService.convertWithHistoricalRate).not.toHaveBeenCalled();
      expect(db.exchangeRate.findFirst).not.toHaveBeenCalled();
    });

    it('should use historical rate when expenseId is provided and historical rate is available', async () => {
      const mockHistoricalAmount = 120;
      (historicalRateService.convertWithHistoricalRate as any).mockResolvedValue(mockHistoricalAmount);

      const result = await convertCurrency(100, 'USD', 'EUR', 123);

      expect(result).toBe(mockHistoricalAmount);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledWith(
        100, 'USD', 'EUR', 123
      );
      // Should not fallback to current rates
      expect(db.exchangeRate.findFirst).not.toHaveBeenCalled();
    });

    it('should fallback to current rates when historical rate fails', async () => {
      const historicalError = new Error('Historical rate not found');
      (historicalRateService.convertWithHistoricalRate as any).mockRejectedValue(historicalError);
      
      const mockExchangeRate = { rate: 1.2 };
      (db.exchangeRate.findFirst as any).mockResolvedValue(mockExchangeRate);

      const result = await convertCurrency(100, 'USD', 'EUR', 123);

      expect(result).toBe(120); // 100 * 1.2
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledWith(
        100, 'USD', 'EUR', 123
      );
      expect(db.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: { fromCurrency: 'USD', toCurrency: 'EUR' },
        orderBy: { date: 'desc' },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to use historical rate for expense 123, falling back to current rates:',
        historicalError
      );
    });

    it('should use current rates when no expenseId is provided', async () => {
      const mockExchangeRate = { rate: 1.5 };
      (db.exchangeRate.findFirst as any).mockResolvedValue(mockExchangeRate);

      const result = await convertCurrency(100, 'USD', 'EUR');

      expect(result).toBe(150); // 100 * 1.5
      expect(historicalRateService.convertWithHistoricalRate).not.toHaveBeenCalled();
      expect(db.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: { fromCurrency: 'USD', toCurrency: 'EUR' },
        orderBy: { date: 'desc' },
      });
    });

    it('should use inverse rate when direct rate is not available', async () => {
      // No direct rate found
      (db.exchangeRate.findFirst as any)
        .mockResolvedValueOnce(null) // First call for direct rate
        .mockResolvedValueOnce({ rate: 0.8 }); // Second call for inverse rate

      const result = await convertCurrency(100, 'USD', 'EUR');

      expect(result).toBe(125); // 100 / 0.8
      expect(db.exchangeRate.findFirst).toHaveBeenCalledTimes(2);
      expect(db.exchangeRate.findFirst).toHaveBeenNthCalledWith(1, {
        where: { fromCurrency: 'USD', toCurrency: 'EUR' },
        orderBy: { date: 'desc' },
      });
      expect(db.exchangeRate.findFirst).toHaveBeenNthCalledWith(2, {
        where: { fromCurrency: 'EUR', toCurrency: 'USD' },
        orderBy: { date: 'desc' },
      });
    });

    it('should return original amount when no rates are available', async () => {
      // No rates found
      (db.exchangeRate.findFirst as any).mockResolvedValue(null);

      const result = await convertCurrency(100, 'USD', 'EUR');

      expect(result).toBe(100);
      expect(consoleSpy).toHaveBeenCalledWith('No exchange rate found for USD to EUR');
    });

    it('should handle zero inverse rate gracefully', async () => {
      // No direct rate, inverse rate is zero
      (db.exchangeRate.findFirst as any)
        .mockResolvedValueOnce(null) // Direct rate
        .mockResolvedValueOnce({ rate: 0 }); // Inverse rate with zero

      const result = await convertCurrency(100, 'USD', 'EUR');

      expect(result).toBe(100); // Should return original amount
      expect(consoleSpy).toHaveBeenCalledWith('No exchange rate found for USD to EUR');
    });
  });

  describe('getTotalExpensesForPeriod function', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const userId = 1;

    it('should calculate total with historical rates for all expenses', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD' },
        { id: 2, amount: 50, currency: 'EUR' },
        { id: 3, amount: 200, currency: 'GBP' },
      ];

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      
      // Mock historical conversions - EUR to EUR should not call the service (same currency)
      (historicalRateService.convertWithHistoricalRate as any)
        .mockResolvedValueOnce(85) // USD to EUR for expense 1
        .mockResolvedValueOnce(175); // GBP to EUR for expense 3

      const result = await getTotalExpensesForPeriod(userId, startDate, endDate, 'EUR');

      expect(result).toBe(310); // 85 + 50 + 175
      expect(db.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      });
      // Only 2 calls because EUR to EUR doesn't call the service
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(2);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(1, 100, 'USD', 'EUR', 1);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(2, 200, 'GBP', 'EUR', 3);
    });

    it('should handle mixed historical and current rates', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD' },
        { id: 2, amount: 50, currency: 'GBP' },
      ];

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      
      // First expense uses historical rate, second falls back to current rate
      (historicalRateService.convertWithHistoricalRate as any)
        .mockResolvedValueOnce(85) // Historical rate for expense 1
        .mockRejectedValueOnce(new Error('Historical rate not found')); // Fails for expense 2
      
      // Mock current rate for fallback
      (db.exchangeRate.findFirst as any).mockResolvedValue({ rate: 1.15 });

      const result = await getTotalExpensesForPeriod(userId, startDate, endDate, 'EUR');

      expect(result).toBe(142.5); // 85 + (50 * 1.15)
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(2);
      expect(db.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: { fromCurrency: 'GBP', toCurrency: 'EUR' },
        orderBy: { date: 'desc' },
      });
    });

    it('should return 0 when no expenses found', async () => {
      (db.expense.findMany as any).mockResolvedValue([]);

      const result = await getTotalExpensesForPeriod(userId, startDate, endDate, 'EUR');

      expect(result).toBe(0);
      expect(db.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      });
      expect(historicalRateService.convertWithHistoricalRate).not.toHaveBeenCalled();
    });

    it('should use default EUR currency when not specified', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD' },
      ];

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      (historicalRateService.convertWithHistoricalRate as any).mockResolvedValue(85);

      const result = await getTotalExpensesForPeriod(userId, startDate, endDate);

      expect(result).toBe(85);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledWith(100, 'USD', 'EUR', 1);
    });

    it('should handle conversion errors gracefully', async () => {
      const mockExpenses = [
        { id: 1, amount: 100, currency: 'USD' },
        { id: 2, amount: 50, currency: 'EUR' },
      ];

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      
      // Historical conversion fails for USD, but EUR to EUR should not call the service
      (historicalRateService.convertWithHistoricalRate as any)
        .mockRejectedValue(new Error('Service unavailable'));
      
      // Mock current rates for USD to EUR fallback
      (db.exchangeRate.findFirst as any)
        .mockResolvedValueOnce({ rate: 0.9 }); // USD to EUR

      const result = await getTotalExpensesForPeriod(userId, startDate, endDate, 'EUR');

      expect(result).toBe(140); // (100 * 0.9) + 50
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to use historical rate for expense 1, falling back to current rates:',
        expect.any(Error)
      );
      // Only one call because EUR to EUR doesn't trigger the historical service
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle large number of expenses efficiently', async () => {
      // Create 100 mock expenses
      const mockExpenses = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        amount: 100,
        currency: i % 2 === 0 ? 'USD' : 'EUR',
      }));

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      
      // Mock historical rates - only for USD expenses (50 calls expected)
      (historicalRateService.convertWithHistoricalRate as any).mockResolvedValue(85);

      const startTime = Date.now();
      const result = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second for this test)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // 50 USD expenses (85 each) + 50 EUR expenses (100 each) = 4250 + 5000 = 9250
      expect(result).toBe(9250);
      // Only 50 calls because EUR to EUR doesn't call the service (same currency)
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(50);
    });

    it('should maintain accuracy with decimal amounts', async () => {
      const mockExpenses = [
        { id: 1, amount: 99.99, currency: 'USD' },
        { id: 2, amount: 0.01, currency: 'EUR' },
        { id: 3, amount: 1234.56, currency: 'GBP' },
      ];

      (db.expense.findMany as any).mockResolvedValue(mockExpenses);
      
      // Mock historical conversions - EUR to EUR should not call the service (same currency)
      (historicalRateService.convertWithHistoricalRate as any)
        .mockResolvedValueOnce(84.99) // 99.99 USD to EUR for expense 1
        .mockResolvedValueOnce(1111.11); // 1234.56 GBP to EUR for expense 3

      const result = await getTotalExpensesForPeriod(1, new Date('2024-01-01'), new Date('2024-01-31'), 'EUR');

      expect(result).toBe(1196.11); // 84.99 + 0.01 + 1111.11
      expect(Number.isFinite(result)).toBe(true);
      // Only 2 calls because EUR to EUR doesn't call the service
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(2);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(1, 99.99, 'USD', 'EUR', 1);
      expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(2, 1234.56, 'GBP', 'EUR', 3);
    });
  });

  describe('Dashboard Procedures Integration', () => {
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
        // Pass expense ID to enable historical rate conversion
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

    describe('getTopCategoriesForPeriod integration', () => {
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

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        (db.category.findMany as any).mockResolvedValue(mockCategories);
        
        // Mock historical conversions
        (historicalRateService.convertWithHistoricalRate as any)
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
        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(3);
        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(1, 100, 'USD', 'EUR', 1);
        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(2, 200, 'GBP', 'EUR', 2);
        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenNthCalledWith(3, 75, 'USD', 'EUR', 4);
      });

      it('should handle mixed historical and current rates in category aggregation', async () => {
        const mockExpenses = [
          { id: 1, amount: 100, currency: 'USD', categoryId: 1 },
          { id: 2, amount: 50, currency: 'GBP', categoryId: 1 },
        ];

        const mockCategories = [
          { id: 1, name: 'Food' },
        ];

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        (db.category.findMany as any).mockResolvedValue(mockCategories);
        
        // First expense uses historical rate, second falls back to current rate
        (historicalRateService.convertWithHistoricalRate as any)
          .mockResolvedValueOnce(85) // Historical rate for expense 1
          .mockRejectedValueOnce(new Error('Historical rate not found')); // Fails for expense 2
        
        // Mock current rate for fallback
        (db.exchangeRate.findFirst as any).mockResolvedValue({ rate: 1.15 });

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

        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledTimes(2);
        expect(db.exchangeRate.findFirst).toHaveBeenCalledWith({
          where: { fromCurrency: 'GBP', toCurrency: 'EUR' },
          orderBy: { date: 'desc' },
        });
      });

      it('should limit results correctly', async () => {
        const mockExpenses = [
          { id: 1, amount: 100, currency: 'EUR', categoryId: 1 },
          { id: 2, amount: 200, currency: 'EUR', categoryId: 2 },
          { id: 3, amount: 50, currency: 'EUR', categoryId: 3 },
        ];

        const mockCategories = [
          { id: 1, name: 'Food' },
          { id: 2, name: 'Transport' },
          { id: 3, name: 'Entertainment' },
        ];

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        (db.category.findMany as any).mockResolvedValue(mockCategories);

        const result = await getTopCategoriesForPeriod(
          1, 
          new Date('2024-01-01'), 
          new Date('2024-01-31'), 
          2, // Limit to 2 categories
          'EUR'
        );

        expect(result).toHaveLength(2);
        expect(result).toEqual([
          { id: 2, name: 'Transport', amount: 200 },
          { id: 1, name: 'Food', amount: 100 },
        ]);
      });
    });

    describe('getRecentExpenses with rate information', () => {
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

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        (historicalRateService.convertWithHistoricalRate as any).mockResolvedValue(85);
        (historicalRateService.getHistoricalRate as any)
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

        expect(historicalRateService.convertWithHistoricalRate).toHaveBeenCalledWith(100, 'USD', 'EUR', 1);
        expect(historicalRateService.getHistoricalRate).toHaveBeenCalledWith(1, 'USD', 'EUR');
      });

      it('should handle current rate fallback with proper rate source', async () => {
        const mockExpenses = [
          { 
            id: 1, 
            amount: 100, 
            currency: 'GBP', 
            date: new Date('2024-01-15'),
            category: { id: 1, name: 'Food' }
          },
        ];

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        
        // Historical conversion fails, falls back to current rate
        (historicalRateService.convertWithHistoricalRate as any)
          .mockRejectedValue(new Error('Historical rate not found'));
        (historicalRateService.getHistoricalRate as any)
          .mockResolvedValue(null); // No historical rate available
        
        // Mock current rate for fallback
        (db.exchangeRate.findFirst as any).mockResolvedValue({ rate: 1.15 });

        const result = await getRecentExpenses(1, 10, 'EUR');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 1,
          originalAmount: 100,
          originalCurrency: 'GBP',
          targetCurrency: 'EUR',
          historicalRate: null,
          rateSource: 'current',
        });
        expect(result[0].convertedAmount).toBeCloseTo(115, 2); // 100 * 1.15

        expect(historicalRateService.getHistoricalRate).toHaveBeenCalledWith(1, 'GBP', 'EUR');
      });

      it('should handle rate service errors gracefully', async () => {
        const mockExpenses = [
          { 
            id: 1, 
            amount: 100, 
            currency: 'USD', 
            date: new Date('2024-01-15'),
            category: { id: 1, name: 'Food' }
          },
        ];

        (db.expense.findMany as any).mockResolvedValue(mockExpenses);
        (historicalRateService.convertWithHistoricalRate as any).mockResolvedValue(85);
        
        // getHistoricalRate throws an error
        (historicalRateService.getHistoricalRate as any)
          .mockRejectedValue(new Error('Database connection failed'));

        const result = await getRecentExpenses(1, 10, 'EUR');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 1,
          convertedAmount: 85,
          originalAmount: 100,
          originalCurrency: 'USD',
          targetCurrency: 'EUR',
          historicalRate: null,
          rateSource: 'current', // Falls back to current when error occurs
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to get historical rate info for expense 1:',
          expect.any(Error)
        );
      });
    });
  });
});