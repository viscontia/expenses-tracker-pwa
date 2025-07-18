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

describe('HistoricalRateService', () => {
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

  describe('saveRatesForExpense', () => {
    it('should save historical rates for all supported currency pairs', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      // Mock successful rate fetching
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 42 });

      await service.saveRatesForExpense(expenseId, expenseDate);

      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            expenseId: 1,
            fromCurrency: expect.any(String),
            toCurrency: expect.any(String),
            rate: 1.2,
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should continue saving rates even if some fail', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      // Mock some successful and some failed rate fetching
      mockFetchExchangeRate
        .mockResolvedValueOnce(1.2) // First call succeeds
        .mockRejectedValueOnce(new Error('API error')) // Second call fails
        .mockResolvedValueOnce(0.8); // Third call succeeds
      
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      await service.saveRatesForExpense(expenseId, expenseDate);

      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch rate'),
        expect.any(Error)
      );
    });

    it('should throw error if database operation fails', async () => {
      const expenseId = 1;
      const expenseDate = new Date('2024-01-15');
      
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockRejectedValue(new Error('DB error'));

      await expect(service.saveRatesForExpense(expenseId, expenseDate))
        .rejects.toThrow(`${HistoricalRateError.DATABASE_ERROR}: Failed to save historical rates`);
    });
  });

  describe('getHistoricalRate', () => {
    it('should return 1 for same currency conversion', async () => {
      const rate = await service.getHistoricalRate(1, 'EUR', 'EUR');
      expect(rate).toBe(1);
    });

    it('should return historical rate when found', async () => {
      const mockRate = { rate: 1.2345 };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const rate = await service.getHistoricalRate(1, 'EUR', 'USD');

      expect(rate).toBe(1.2345);
      expect(mockDb.expenseExchangeRate.findUnique).toHaveBeenCalledWith({
        where: {
          expenseId_fromCurrency_toCurrency: {
            expenseId: 1,
            fromCurrency: 'EUR',
            toCurrency: 'USD',
          },
        },
      });
    });

    it('should return null when historical rate not found', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);

      const rate = await service.getHistoricalRate(1, 'EUR', 'USD');

      expect(rate).toBeNull();
    });

    it('should throw error if database operation fails', async () => {
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(service.getHistoricalRate(1, 'EUR', 'USD'))
        .rejects.toThrow(`${HistoricalRateError.DATABASE_ERROR}: Failed to retrieve historical rate`);
    });
  });

  describe('convertWithHistoricalRate', () => {
    it('should return same amount for same currency', async () => {
      const result = await service.convertWithHistoricalRate(100, 'EUR', 'EUR');
      expect(result).toBe(100);
    });

    it('should use historical rate when expenseId provided and rate exists', async () => {
      const mockRate = { rate: 1.5 };
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockRate as any);

      const result = await service.convertWithHistoricalRate(100, 'EUR', 'USD', 1);

      expect(result).toBe(150);
    });

    it('should fallback to current rate when no historical rate found', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockFetchExchangeRate.mockResolvedValue(1.3);

      const result = await service.convertWithHistoricalRate(100, 'EUR', 'USD', 1);

      expect(result).toBe(130);
      expect(mockFetchExchangeRate).toHaveBeenCalledWith('EUR', 'USD');
    });

    it('should use current rate when no expenseId provided', async () => {
      mockFetchExchangeRate.mockResolvedValue(1.4);

      const result = await service.convertWithHistoricalRate(100, 'EUR', 'USD');

      expect(result).toBe(140);
      expect(mockFetchExchangeRate).toHaveBeenCalledWith('EUR', 'USD');
    });

    it('should throw error if conversion fails', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockFetchExchangeRate.mockRejectedValue(new Error('API error'));

      await expect(service.convertWithHistoricalRate(100, 'EUR', 'USD', 1))
        .rejects.toThrow(`${HistoricalRateError.API_UNAVAILABLE}: Failed to convert currency`);
    });
  });

  describe('migrateExistingExpenses', () => {
    it('should migrate expenses without existing historical rates', async () => {
      const mockExpenses = [
        { id: 1, date: new Date('2024-01-01'), currency: 'ZAR', conversionRate: 18.5 },
        { id: 2, date: new Date('2024-01-02'), currency: 'EUR', conversionRate: 1.0 },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count
        .mockResolvedValueOnce(0) // First expense has no rates
        .mockResolvedValueOnce(5); // Second expense already has rates
      
      // Mock closest historical rate finding
      mockFindClosestHistoricalRate.mockResolvedValue({
        rate: 1.1,
        date: new Date('2024-01-01'),
        daysDifference: 0
      });
      
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 42 });

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(2);
      expect(result.migratedExpenses).toBe(1);
      expect(result.skippedExpenses).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should use existing conversionRate as primary source', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          currency: 'ZAR', 
          conversionRate: 18.5,
          amount: 100 
        },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // Mock closest historical rate for other currency pairs
      mockFindClosestHistoricalRate.mockResolvedValue({
        rate: 1.1,
        date: new Date('2024-01-01'),
        daysDifference: 0
      });
      
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 42 });

      await service.migrateExistingExpenses();

      // Verify that createMany was called with data including the existing conversion rate
      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            expenseId: 1,
            fromCurrency: 'ZAR',
            toCurrency: 'EUR',
            rate: 18.5,
          }),
          expect.objectContaining({
            expenseId: 1,
            fromCurrency: 'EUR',
            toCurrency: 'ZAR',
            rate: 1 / 18.5,
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should use closest historical rates when available', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          currency: 'EUR', 
          conversionRate: 1.0,
          amount: 100 
        },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // Mock closest historical rate finding
      mockFindClosestHistoricalRate
        .mockResolvedValueOnce({
          rate: 1.15,
          date: new Date('2023-12-30'),
          daysDifference: 2
        })
        .mockResolvedValueOnce(null) // No historical rate found
        .mockResolvedValueOnce({
          rate: 0.85,
          date: new Date('2024-01-02'),
          daysDifference: 1
        });
      
      // Mock current API rate as fallback
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 42 });

      await service.migrateExistingExpenses();

      // Verify closest historical rate was used
      expect(mockFindClosestHistoricalRate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        new Date('2024-01-01'),
        30
      );
      
      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            rate: 1.15, // From closest historical rate
          }),
          expect.objectContaining({
            rate: 1.2, // From current API (fallback)
          }),
          expect.objectContaining({
            rate: 0.85, // From closest historical rate
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should fallback to current API rates when no historical rates found', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          currency: 'EUR', 
          conversionRate: 1.0,
          amount: 100 
        },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // Mock no historical rates found
      mockFindClosestHistoricalRate.mockResolvedValue(null);
      
      // Mock current API rate as fallback
      mockFetchExchangeRate.mockResolvedValue(1.25);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 42 });

      await service.migrateExistingExpenses();

      // Verify current API rate was used as fallback
      expect(mockFetchExchangeRate).toHaveBeenCalled();
      expect(mockDb.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            rate: 1.25, // From current API
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should handle migration errors gracefully', async () => {
      const mockExpenses = [
        { id: 1, date: new Date('2024-01-01'), currency: 'ZAR', conversionRate: 18.5 },
        { id: 2, date: new Date('2024-01-02'), currency: 'EUR', conversionRate: 1.0 },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // First expense succeeds, second fails
      mockFindClosestHistoricalRate.mockResolvedValue({
        rate: 1.1,
        date: new Date('2024-01-01'),
        daysDifference: 0
      });
      mockFetchExchangeRate.mockResolvedValue(1.2);
      mockDb.expenseExchangeRate.createMany
        .mockResolvedValueOnce({ count: 42 })
        .mockRejectedValueOnce(new Error('DB error'));

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(2);
      expect(result.migratedExpenses).toBe(1);
      expect(result.skippedExpenses).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Expense 2:');
    });

    it('should handle complete migration failure', async () => {
      mockDb.expense.findMany.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(0);
      expect(result.migratedExpenses).toBe(0);
      expect(result.skippedExpenses).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Migration failed:');
    });

    it('should skip expenses that already have historical rates', async () => {
      const mockExpenses = [
        { id: 1, date: new Date('2024-01-01'), currency: 'ZAR', conversionRate: 18.5 },
        { id: 2, date: new Date('2024-01-02'), currency: 'EUR', conversionRate: 1.0 },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count
        .mockResolvedValueOnce(10) // First expense already has rates
        .mockResolvedValueOnce(5);  // Second expense already has rates

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(2);
      expect(result.migratedExpenses).toBe(0);
      expect(result.skippedExpenses).toBe(2);
      expect(result.errors).toHaveLength(0);
      
      // Verify no migration attempts were made
      expect(mockDb.expenseExchangeRate.createMany).not.toHaveBeenCalled();
    });

    it('should handle API failures gracefully during migration', async () => {
      const mockExpenses = [
        { 
          id: 1, 
          date: new Date('2024-01-01'), 
          currency: 'ZAR', 
          conversionRate: 18.5,
          amount: 100 
        },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // Mock no historical rates found for some pairs
      mockFindClosestHistoricalRate.mockResolvedValue(null);
      
      // Mock API failure for some calls
      mockFetchExchangeRate.mockRejectedValue(new Error('API unavailable'));
      
      // Should still save some rates (at least the existing conversion rate)
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 10 });

      const result = await service.migrateExistingExpenses();

      expect(result.totalExpenses).toBe(1);
      expect(result.migratedExpenses).toBe(1);
      expect(result.skippedExpenses).toBe(0);
      expect(result.errors).toHaveLength(0);
      
      // Verify warning was logged for API failures
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch current rate'),
        expect.any(Error)
      );
    });
  });
});