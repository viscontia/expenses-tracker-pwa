import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  fetchRatesForDate, 
  findClosestHistoricalRate, 
  convertAmountWithHistory,
  fetchExchangeRate 
} from '../currency';
import { db } from '~/server/db';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    exchangeRate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    expenseExchangeRate: {
      findUnique: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('Enhanced Currency Utilities', () => {
  const mockDb = vi.mocked(db);
  const mockFetch = vi.mocked(fetch);

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

  describe('fetchRatesForDate', () => {
    it('should return existing rates from database for the target date', async () => {
      const targetDate = new Date('2024-01-15');
      const mockRates = [
        { fromCurrency: 'EUR', toCurrency: 'USD', rate: 1.2 },
        { fromCurrency: 'EUR', toCurrency: 'GBP', rate: 0.85 },
      ];

      mockDb.exchangeRate.findMany.mockResolvedValue(mockRates as any);

      const result = await fetchRatesForDate('EUR', targetDate, ['USD', 'GBP']);

      expect(result).toEqual({
        USD: 1.2,
        GBP: 0.85,
      });

      expect(mockDb.exchangeRate.findMany).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'EUR',
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      });
    });

    it('should fetch missing rates from API when not in database', async () => {
      const targetDate = new Date('2024-01-15');
      
      // No existing rates in database
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      
      // Mock API responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { USD: 1.2, GBP: 0.85 }
        }),
      } as Response);
      
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await fetchRatesForDate('EUR', targetDate, ['USD', 'GBP']);

      expect(result).toEqual({
        USD: 1.2,
        GBP: 0.85,
      });

      expect(mockFetch).toHaveBeenCalledTimes(2); // Once for each missing currency
    });

    it('should handle API failures gracefully', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      
      // Mock fetchExchangeRate to use fallback
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await fetchRatesForDate('EUR', targetDate, ['USD']);

      expect(result).toEqual({ USD: 1 }); // fallback rate
    });

    it('should throw error if database operation fails', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(fetchRatesForDate('EUR', targetDate))
        .rejects.toThrow('Failed to fetch rates for EUR on 2024-01-15T00:00:00.000Z');
    });
  });

  describe('findClosestHistoricalRate', () => {
    it('should return rate 1 for same currency', async () => {
      const targetDate = new Date('2024-01-15');
      
      const result = await findClosestHistoricalRate('EUR', 'EUR', targetDate);

      expect(result).toEqual({
        rate: 1,
        date: targetDate,
        daysDifference: 0,
      });
    });

    it('should find the closest rate within the date range', async () => {
      const targetDate = new Date('2024-01-15');
      const mockRates = [
        { rate: 1.1, date: new Date('2024-01-10') }, // 5 days before
        { rate: 1.2, date: new Date('2024-01-14') }, // 1 day before (closest)
        { rate: 1.3, date: new Date('2024-01-18') }, // 3 days after
      ];

      mockDb.exchangeRate.findMany.mockResolvedValue(mockRates as any);

      const result = await findClosestHistoricalRate('EUR', 'USD', targetDate);

      expect(result).toEqual({
        rate: 1.2,
        date: new Date('2024-01-14'),
        daysDifference: 1,
      });

      expect(mockDb.exchangeRate.findMany).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          date: {
            gte: new Date('2024-01-08'), // 7 days before
            lte: new Date('2024-01-22'), // 7 days after
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('should return null when no rates found within range', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockResolvedValue([]);

      const result = await findClosestHistoricalRate('EUR', 'USD', targetDate);

      expect(result).toBeNull();
    });

    it('should respect maxDaysDifference parameter', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockResolvedValue([]);

      const result = await findClosestHistoricalRate('EUR', 'USD', targetDate, 3);

      expect(result).toBeNull();
      expect(mockDb.exchangeRate.findMany).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          date: {
            gte: new Date('2024-01-12'), // 3 days before
            lte: new Date('2024-01-18'), // 3 days after
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('should throw error if database operation fails', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(findClosestHistoricalRate('EUR', 'USD', targetDate))
        .rejects.toThrow('Failed to find closest historical rate for EUR to USD');
    });
  });

  describe('convertAmountWithHistory', () => {
    it('should return same amount for same currency', async () => {
      const result = await convertAmountWithHistory(100, 'EUR', 'EUR');

      expect(result).toEqual({
        convertedAmount: 100,
        rate: 1,
        source: 'current',
      });
    });

    it('should use historical rate when expenseId provided and rate exists', async () => {
      const mockHistoricalRate = {
        rate: 1.25,
        createdAt: new Date('2024-01-15'),
      };

      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockHistoricalRate as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);

      expect(result).toEqual({
        convertedAmount: 125,
        rate: 1.25,
        source: 'historical',
        sourceDate: new Date('2024-01-15'),
      });

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

    it('should fallback to closest rate when historical rate not found', async () => {
      const mockExpense = { date: new Date('2024-01-15') };
      const mockClosestRate = {
        rate: 1.15,
        date: new Date('2024-01-14'),
        daysDifference: 1,
      };

      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.expense.findUnique.mockResolvedValue(mockExpense as any);
      mockDb.exchangeRate.findMany.mockResolvedValue([
        { rate: 1.15, date: new Date('2024-01-14') }
      ] as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);

      expect(result.convertedAmount).toBeCloseTo(115, 2);
      expect(result.rate).toBe(1.15);
      expect(result.source).toBe('closest');
      expect(result.sourceDate).toEqual(new Date('2024-01-14'));
      expect(result.daysDifference).toBe(1);
    });

    it('should use current rate when no expenseId provided', async () => {
      // Mock current rate fetch
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: { USD: 1.3 } }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD');

      expect(result).toEqual({
        convertedAmount: 130,
        rate: 1.3,
        source: 'current',
      });
    });

    it('should use fallback rate when all other methods fail', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.expense.findUnique.mockResolvedValue({ date: new Date() } as any);
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await convertAmountWithHistory(100, 'EUR', 'ZAR', 1);

      expect(result.convertedAmount).toBe(2000); // 100 * 20.0 (fallback rate)
      expect(result.rate).toBe(20.0);
      expect(result.source).toBe('current'); // fetchExchangeRate returns fallback as 'current'
    });

    it('should skip closest rate fallback when fallbackToClosest is false', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: { USD: 1.4 } }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1, false);

      expect(result).toEqual({
        convertedAmount: 140,
        rate: 1.4,
        source: 'current',
      });

      // Should not have tried to find expense or closest rate
      expect(mockDb.expense.findUnique).not.toHaveBeenCalled();
    });
  });
});