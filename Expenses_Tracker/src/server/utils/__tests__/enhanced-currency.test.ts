import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  fetchExchangeRate,
  convertAmount,
  fetchRatesForDate, 
  findClosestHistoricalRate, 
  convertAmountWithHistory
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

  describe('fetchExchangeRate', () => {
    it('should return cached rate when available within time limit', async () => {
      const mockRate = {
        rate: 1.2,
        date: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      mockDb.exchangeRate.findFirst.mockResolvedValue(mockRate as any);

      const result = await fetchExchangeRate('EUR', 'USD');

      expect(result).toBe(1.2);
      expect(mockDb.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: {
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          date: {
            gte: expect.any(Date),
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('should fetch from API when no recent rate available', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { USD: 1.3 }
        }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await fetchExchangeRate('EUR', 'USD');

      expect(result).toBe(1.3);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.exchangerate-api.com/v4/latest/EUR'
      );
      expect(mockDb.exchangeRate.create).toHaveBeenCalledWith({
        data: {
          fromCurrency: 'EUR',
          toCurrency: 'USD',
          rate: 1.3,
          date: expect.any(Date),
        },
      });
    });

    it('should fallback to last known rate when API fails', async () => {
      mockDb.exchangeRate.findFirst
        .mockResolvedValueOnce(null) // No recent rate
        .mockResolvedValueOnce({ rate: 1.25 } as any); // Last known rate

      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await fetchExchangeRate('EUR', 'USD');

      expect(result).toBe(1.25);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching exchange rate:',
        expect.any(Error)
      );
    });

    it('should use hardcoded fallback when no rates available', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await fetchExchangeRate('ZAR', 'EUR');

      expect(result).toBe(0.05); // Hardcoded fallback
    });

    it('should handle API response errors', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const result = await fetchExchangeRate('EUR', 'USD');

      expect(result).toBe(1); // Ultimate fallback
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching exchange rate:',
        expect.any(Error)
      );
    });

    it('should handle missing currency in API response', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { GBP: 0.85 } // USD not included
        }),
      } as Response);

      const result = await fetchExchangeRate('EUR', 'USD');

      expect(result).toBe(1); // Ultimate fallback
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching exchange rate:',
        expect.any(Error)
      );
    });
  });

  describe('convertAmount', () => {
    it('should return same amount for same currency', async () => {
      const result = await convertAmount(100, 'EUR', 'EUR');

      expect(result).toEqual({
        convertedAmount: 100,
        rate: 1,
      });
    });

    it('should convert amount using fetched rate', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.2 } as any);

      const result = await convertAmount(100, 'EUR', 'USD');

      expect(result).toEqual({
        convertedAmount: 120,
        rate: 1.2,
      });
    });

    it('should handle conversion with API fetch', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { USD: 1.15 }
        }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await convertAmount(200, 'EUR', 'USD');

      expect(result).toEqual({
        convertedAmount: 230,
        rate: 1.15,
      });
    });
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
      
      // Mock API responses for fetchExchangeRate calls
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { USD: 1.2, GBP: 0.85 }
        }),
      } as Response);
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

    it('should use default supported currencies when not specified', async () => {
      const targetDate = new Date('2024-01-15');
      
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          rates: { ZAR: 20, USD: 1.2, GBP: 0.85, JPY: 130, CHF: 0.9, CAD: 1.35, AUD: 1.5 }
        }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);

      const result = await fetchRatesForDate('EUR', targetDate);

      // Should include all default supported currencies except EUR itself
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(['ZAR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'])
      );
      expect(Object.keys(result)).not.toContain('EUR');
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

    it('should find closest rate when multiple rates exist', async () => {
      const targetDate = new Date('2024-01-15T12:00:00.000Z');
      const mockRates = [
        { rate: 1.1, date: new Date('2024-01-13T10:00:00.000Z') }, // 2 days, 2 hours before
        { rate: 1.2, date: new Date('2024-01-15T10:00:00.000Z') }, // 2 hours before (closest)
        { rate: 1.3, date: new Date('2024-01-16T14:00:00.000Z') }, // 1 day, 2 hours after
      ];

      mockDb.exchangeRate.findMany.mockResolvedValue(mockRates as any);

      const result = await findClosestHistoricalRate('EUR', 'USD', targetDate);

      expect(result?.rate).toBe(1.2);
      expect(result?.daysDifference).toBe(0); // Same day
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
      const mockRates = [
        { rate: 1.15, date: new Date('2024-01-14') }
      ];

      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.expense.findUnique.mockResolvedValue(mockExpense as any);
      mockDb.exchangeRate.findMany.mockResolvedValue(mockRates as any);

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

    it('should handle errors in historical rate retrieval', async () => {
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('DB error'));
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.1 } as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);

      expect(result.convertedAmount).toBe(110);
      expect(result.source).toBe('current');
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to retrieve historical rate for expense 1:',
        expect.any(Error)
      );
    });

    it('should handle errors in closest rate fallback', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.expense.findUnique.mockResolvedValue({ date: new Date() } as any);
      mockDb.exchangeRate.findMany.mockRejectedValue(new Error('DB error'));
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.2 } as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);

      expect(result.convertedAmount).toBe(120);
      expect(result.source).toBe('current');
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to find closest historical rate for expense 1:',
        expect.any(Error)
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex conversion chain with multiple fallbacks', async () => {
      // Historical rate not found
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      
      // Expense found for closest rate lookup
      mockDb.expense.findUnique.mockResolvedValue({ date: new Date('2024-01-15') } as any);
      
      // No closest historical rate found
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      
      // Current rate found in database
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.25 } as any);

      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);

      expect(result).toEqual({
        convertedAmount: 125,
        rate: 1.25,
        source: 'current',
      });
    });

    it('should handle large amounts with precision', async () => {
      const mockHistoricalRate = {
        rate: 1.23456789,
        createdAt: new Date('2024-01-15'),
      };

      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(mockHistoricalRate as any);

      const result = await convertAmountWithHistory(999999.99, 'EUR', 'USD', 1);

      expect(result.convertedAmount).toBeCloseTo(1234567.88, 2);
      expect(result.rate).toBe(1.23456789);
      expect(result.source).toBe('historical');
    });

    it('should handle zero and negative amounts', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.2 } as any);

      const zeroResult = await convertAmountWithHistory(0, 'EUR', 'USD');
      expect(zeroResult.convertedAmount).toBe(0);

      const negativeResult = await convertAmountWithHistory(-100, 'EUR', 'USD');
      expect(negativeResult.convertedAmount).toBe(-120);
    });
  });
});