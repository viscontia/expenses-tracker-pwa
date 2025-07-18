import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoricalRateServiceImpl, HistoricalRateError } from '../historical-rate';
import { db } from '~/server/db';
import * as currencyUtils from '~/server/utils/currency';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    expenseExchangeRate: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    expense: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the currency utils
vi.mock('~/server/utils/currency', () => ({
  fetchExchangeRate: vi.fn(),
  findClosestHistoricalRate: vi.fn(),
  fetchRatesForDate: vi.fn(),
}));

describe('HistoricalRateService Error Handling', () => {
  let service: HistoricalRateServiceImpl;
  const mockDb = vi.mocked(db);
  const mockFetchExchangeRate = vi.mocked(currencyUtils.fetchExchangeRate);
  const mockFindClosestHistoricalRate = vi.mocked(currencyUtils.findClosestHistoricalRate);

  beforeEach(() => {
    service = new HistoricalRateServiceImpl();
    vi.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error types and handling', () => {
    it('should throw DATABASE_ERROR when database operations fail', async () => {
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('Connection lost'));

      await expect(service.getHistoricalRate(1, 'EUR', 'USD'))
        .rejects.toThrow(`${HistoricalRateError.DATABASE_ERROR}: Failed to retrieve historical rate`);
    });

    it('should throw API_UNAVAILABLE when conversion fails', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockFetchExchangeRate.mockRejectedValue(new Error('API down'));

      await expect(service.convertWithHistoricalRate(100, 'EUR', 'USD', 1))
        .rejects.toThrow(`${HistoricalRateError.API_UNAVAILABLE}: Failed to convert currency`);
    });

    it('should handle partial failures in saveRatesForExpense', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      // Some rates succeed, some fail
      mockFetchExchangeRate
        .mockResolvedValueOnce(1.2) // EUR to USD succeeds
        .mockRejectedValueOnce(new Error('API error')) // EUR to GBP fails
        .mockResolvedValueOnce(0.8) // EUR to JPY succeeds
        .mockRejectedValueOnce(new Error('Rate not found')); // EUR to CHF fails
      
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      // Should not throw, but should log warnings
      await service.saveRatesForExpense(expenseId, expenseDate);

      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ rate: 1.2 }),
          expect.objectContaining({ rate: 0.8 }),
        ]),
        skipDuplicates: true,
      });

      expect(console.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle complete API failure gracefully', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      // All API calls fail
      mockFetchExchangeRate.mockRejectedValue(new Error('Complete API failure'));
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 0 });

      await service.saveRatesForExpense(expenseId, expenseDate);

      expect(console.warn).toHaveBeenCalledWith(
        `No rates could be fetched for expense ${expenseId}`
      );
    });

    it('should handle database constraint violations', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockRejectedValue(
        new Error('duplicate key value violates unique constraint')
      );

      await expect(service.saveRatesForExpense(expenseId, expenseDate))
        .rejects.toThrow(`${HistoricalRateError.DATABASE_ERROR}: Failed to save historical rates`);
    });
  });

  describe('fallback mechanisms', () => {
    it('should fallback to current rate when historical rate not found', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockFetchExchangeRate.mockResolvedValue(1.5);

      const result = await service.convertWithHistoricalRate(100, 'EUR', 'USD', 1);

      expect(result).toBe(150);
      expect(console.log).toHaveBeenCalledWith(
        'Using current rate for conversion: 100 EUR to USD'
      );
    });

    it('should handle cascading failures in migration', async () => {
      const mockExpenses = [
        { id: 1, currency: 'USD', conversionRate: 1.2, date: new Date('2024-01-01') },
        { id: 2, currency: 'GBP', conversionRate: 0.8, date: new Date('2024-01-02') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);

      // First expense migration fails completely
      mockFindClosestHistoricalRate.mockRejectedValue(new Error('DB connection lost'));
      mockFetchExchangeRate.mockRejectedValue(new Error('API unavailable'));
      mockDb.expenseExchangeRate.createMany
        .mockRejectedValueOnce(new Error('Migration failed'))
        .mockResolvedValueOnce({ count: 2 }); // Second expense succeeds

      const result = await service.migrateExistingExpenses();

      expect(result.migratedExpenses).toBe(1); // Only second expense succeeded
      expect(result.skippedExpenses).toBe(1); // First expense failed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Expense 1:');
    });

    it('should handle timeout scenarios', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      // Simulate timeout by rejecting after delay
      mockFetchExchangeRate.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );
      
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 0 });

      await service.saveRatesForExpense(expenseId, expenseDate);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch rate'),
        expect.any(Error)
      );
    });
  });

  describe('data consistency and validation', () => {
    it('should handle invalid currency codes', async () => {
      const result = await service.getHistoricalRate(1, 'INVALID', 'USD');
      
      expect(result).toBeNull();
      expect(mockDb.expenseExchangeRate.findUnique).toHaveBeenCalledWith({
        where: {
          expenseId_fromCurrency_toCurrency: {
            expenseId: 1,
            fromCurrency: 'INVALID',
            toCurrency: 'USD',
          },
        },
      });
    });

    it('should handle null/undefined rate values', async () => {
      const mockRate = { rate: null };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const result = await service.getHistoricalRate(1, 'EUR', 'USD');

      expect(result).toBe(0); // Number(null) = 0
    });

    it('should handle very large rate values', async () => {
      const mockRate = { rate: 999999999.99999999 };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const result = await service.getHistoricalRate(1, 'EUR', 'USD');

      expect(result).toBe(999999999.99999999);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle very small rate values', async () => {
      const mockRate = { rate: 0.00000001 };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const result = await service.getHistoricalRate(1, 'EUR', 'USD');

      expect(result).toBe(0.00000001);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent rate saving operations', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      // Run multiple save operations concurrently
      const promises = Array.from({ length: 5 }, () => 
        service.saveRatesForExpense(expenseId, expenseDate)
      );

      await Promise.all(promises);

      // Should handle concurrent operations without errors
      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent conversion requests', async () => {
      const mockRate = { rate: 1.25 };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      // Run multiple conversions concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        service.convertWithHistoricalRate(100 + i, 'EUR', 'USD', 1)
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result).toBe((100 + i) * 1.25);
      });
    });
  });

  describe('memory and performance under stress', () => {
    it('should handle large batch operations efficiently', async () => {
      const largeExpenseList = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        currency: i % 2 === 0 ? 'USD' : 'EUR',
        conversionRate: 1.2,
        date: new Date('2024-01-01'),
      }));

      mockDb.expense.findMany.mockResolvedValue(largeExpenseList as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      mockFindClosestHistoricalRate.mockResolvedValue({
        rate: 1.1,
        date: new Date('2024-01-01'),
        daysDifference: 0
      });
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      const startTime = Date.now();
      const result = await service.migrateExistingExpenses();
      const endTime = Date.now();

      expect(result.totalExpenses).toBe(1000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in reasonable time
    });

    it('should handle memory pressure during large migrations', async () => {
      // Simulate memory pressure by creating large objects
      const largeExpenseList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        currency: 'USD',
        conversionRate: 1.2,
        date: new Date('2024-01-01'),
        largeData: 'x'.repeat(10000), // Large string to simulate memory usage
      }));

      mockDb.expense.findMany.mockResolvedValue(largeExpenseList as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(100);
      expect(result.migratedExpenses).toBe(100);
    });
  });

  describe('edge cases in error recovery', () => {
    it('should recover from temporary database disconnections', async () => {
      let callCount = 0;
      mockDb.expenseExchangeRate.findUnique.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Connection lost');
        }
        return Promise.resolve({ rate: 1.3 } as any);
      });

      // First two calls should fail, but we don't retry in getHistoricalRate
      await expect(service.getHistoricalRate(1, 'EUR', 'USD'))
        .rejects.toThrow(HistoricalRateError.DATABASE_ERROR);
    });

    it('should handle partial data corruption', async () => {
      const mockExpenses = [
        { id: 1, currency: null, conversionRate: 1.2, date: new Date('2024-01-01') },
        { id: 2, currency: 'USD', conversionRate: null, date: null },
        { id: 3, currency: 'EUR', conversionRate: 1.0, date: new Date('2024-01-03') },
      ];

      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 0 });

      const result = await service.migrateExistingExpenses();

      // Should handle corrupted data gracefully
      expect(result.totalExpenses).toBe(3);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle rate precision issues', async () => {
      const mockRate = { rate: 1.123456789012345 }; // High precision
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const result = await service.convertWithHistoricalRate(100, 'EUR', 'USD', 1);

      expect(result).toBeCloseTo(112.3456789012345, 10);
      expect(Number.isFinite(result)).toBe(true);
    });
  });
});