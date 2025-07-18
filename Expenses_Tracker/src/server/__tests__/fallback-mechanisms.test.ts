import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { historicalRateService } from '~/server/services/historical-rate';
import { fetchExchangeRate, convertAmountWithHistory } from '~/server/utils/currency';
import { db } from '~/server/db';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    exchangeRate: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    expenseExchangeRate: {
      findUnique: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    expense: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('Fallback Mechanisms and Error Handling', () => {
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

  describe('Historical Rate Service Fallback Chain', () => {
    it('should fallback through the complete chain: historical -> current API -> fallback', async () => {
      // Step 1: Historical rate not found
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      
      // Step 2: Current rate API fails
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API unavailable'));
      
      // Step 3: Should use hardcoded fallback
      const result = await historicalRateService.convertWithHistoricalRate(100, 'ZAR', 'EUR', 1);
      
      expect(result).toBe(5); // 100 * 0.05 (hardcoded fallback)
      expect(console.log).toHaveBeenCalledWith(
        'Using current rate for conversion: 100 ZAR to EUR'
      );
    });

    it('should handle database connection failures gracefully', async () => {
      // Database completely unavailable
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('Connection lost'));
      
      await expect(
        historicalRateService.convertWithHistoricalRate(100, 'EUR', 'USD', 1)
      ).rejects.toThrow('DATABASE_ERROR: Failed to convert currency');
    });

    it('should handle partial database failures', async () => {
      // Historical rate lookup fails, but current rate works
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('Table not found'));
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.2 } as any);
      
      await expect(
        historicalRateService.convertWithHistoricalRate(100, 'EUR', 'USD', 1)
      ).rejects.toThrow('DATABASE_ERROR: Failed to convert currency');
    });

    it('should handle API rate limiting and timeouts', async () => {
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      
      // Simulate API rate limiting
      mockFetch.mockRejectedValue(new Error('Rate limit exceeded'));
      
      const result = await historicalRateService.convertWithHistoricalRate(100, 'EUR', 'ZAR', 1);
      
      expect(result).toBe(2000); // 100 * 20.0 (hardcoded fallback)
      expect(console.log).toHaveBeenCalledWith(
        'Using current rate for conversion: 100 EUR to ZAR'
      );
    });
  });

  describe('Currency Conversion Fallback Hierarchy', () => {
    it('should use cached rate when available', async () => {
      const recentRate = {
        rate: 1.15,
        date: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };
      
      mockDb.exchangeRate.findFirst.mockResolvedValue(recentRate as any);
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1.15);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch from API when cache is stale', async () => {
      const staleRate = {
        rate: 1.10,
        date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };
      
      mockDb.exchangeRate.findFirst
        .mockResolvedValueOnce(staleRate as any) // First call finds stale rate
        .mockResolvedValueOnce(null); // Second call for last known rate
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: { USD: 1.20 } }),
      } as Response);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1.20);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should fallback to last known rate when API fails', async () => {
      const lastKnownRate = { rate: 1.18 };
      
      mockDb.exchangeRate.findFirst
        .mockResolvedValueOnce(null) // No recent rate
        .mockResolvedValueOnce(lastKnownRate as any); // Last known rate
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1.18);
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching exchange rate:',
        expect.any(Error)
      );
    });

    it('should use hardcoded fallback as last resort', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('Complete API failure'));
      
      const result = await fetchExchangeRate('ZAR', 'EUR');
      
      expect(result).toBe(0.05); // Hardcoded fallback
    });

    it('should return 1 for unknown currency pairs', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API failure'));
      
      const result = await fetchExchangeRate('XYZ', 'ABC');
      
      expect(result).toBe(1); // Ultimate fallback
    });
  });

  describe('Enhanced Conversion with History Fallbacks', () => {
    it('should gracefully handle all fallback scenarios', async () => {
      // Test the complete fallback chain in convertAmountWithHistory
      
      // 1. Historical rate fails
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('Historical lookup failed'));
      
      // 2. Closest rate lookup fails
      mockDb.expense.findUnique.mockResolvedValue({ date: new Date() } as any);
      mockDb.exchangeRate.findMany.mockRejectedValue(new Error('Closest rate lookup failed'));
      
      // 3. Current rate succeeds
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.25 } as any);
      
      const result = await convertAmountWithHistory(100, 'EUR', 'USD', 1);
      
      expect(result).toEqual({
        convertedAmount: 125,
        rate: 1.25,
        source: 'current',
      });
      
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to retrieve historical rate for expense 1:',
        expect.any(Error)
      );
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to find closest historical rate for expense 1:',
        expect.any(Error)
      );
    });

    it('should handle complete system failure gracefully', async () => {
      // Everything fails except hardcoded fallback
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('DB error'));
      mockDb.expense.findUnique.mockRejectedValue(new Error('DB error'));
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('API error'));
      
      const result = await convertAmountWithHistory(100, 'EUR', 'ZAR', 1);
      
      expect(result.convertedAmount).toBe(2000); // Hardcoded fallback
      expect(result.source).toBe('current');
    });

    it('should maintain precision through fallback chain', async () => {
      // Test that precision is maintained even through fallbacks
      mockDb.expenseExchangeRate.findUnique.mockResolvedValue(null);
      mockDb.expense.findUnique.mockResolvedValue({ date: new Date() } as any);
      mockDb.exchangeRate.findMany.mockResolvedValue([]);
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.23456789 } as any);
      
      const result = await convertAmountWithHistory(123.456, 'EUR', 'USD', 1);
      
      expect(result.convertedAmount).toBeCloseTo(152.415, 3);
      expect(result.rate).toBe(1.23456789);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary database outages', async () => {
      let callCount = 0;
      mockDb.exchangeRate.findFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary DB outage');
        }
        return Promise.resolve({ rate: 1.3 } as any);
      });
      
      // First call should fail, but the service should handle it
      try {
        await fetchExchangeRate('EUR', 'USD');
      } catch (error) {
        // Expected to fail on first attempt
      }
      
      // Second call should succeed
      const result = await fetchExchangeRate('EUR', 'USD');
      expect(result).toBe(1.3);
    });

    it('should handle malformed API responses', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      } as Response);
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1); // Should fallback to hardcoded rate
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching exchange rate:',
        expect.any(Error)
      );
    });

    it('should handle JSON parsing errors', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1); // Should fallback
    });

    it('should handle network timeouts', async () => {
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );
      
      const result = await fetchExchangeRate('EUR', 'USD');
      
      expect(result).toBe(1); // Should fallback
    });
  });

  describe('Historical Rate Service Error Scenarios', () => {
    it('should handle saveRatesForExpense failures gracefully', async () => {
      // Mock API failures for some currencies
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Error('API error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rates: { USD: 1.2 } }),
        } as Response);
      });
      
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 1 });
      
      // Should not throw even if some rates fail
      await expect(
        historicalRateService.saveRatesForExpense(1, new Date())
      ).resolves.not.toThrow();
      
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch rate'),
        expect.any(Error)
      );
    });

    it('should handle database constraint violations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rates: { USD: 1.2 } }),
      } as Response);
      mockDb.exchangeRate.findFirst.mockResolvedValue(null);
      mockDb.exchangeRate.create.mockResolvedValue({} as any);
      
      // Simulate unique constraint violation
      mockDb.expenseExchangeRate.createMany.mockRejectedValue(
        new Error('Unique constraint violation')
      );
      
      await expect(
        historicalRateService.saveRatesForExpense(1, new Date())
      ).rejects.toThrow('DATABASE_ERROR: Failed to save historical rates');
    });

    it('should handle migration errors with detailed reporting', async () => {
      const mockExpenses = [
        { id: 1, currency: 'USD', conversionRate: 1.2, date: new Date() },
        { id: 2, currency: 'EUR', conversionRate: null, date: new Date() },
      ];
      
      mockDb.expense.findMany.mockResolvedValue(mockExpenses as any);
      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      
      // First expense succeeds, second fails
      mockDb.expenseExchangeRate.createMany
        .mockResolvedValueOnce({ count: 2 })
        .mockRejectedValueOnce(new Error('Migration error'));
      
      const result = await historicalRateService.migrateExistingExpenses();
      
      expect(result.totalExpenses).toBe(2);
      expect(result.migratedExpenses).toBe(1);
      expect(result.skippedExpenses).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Expense 2:');
    });
  });

  describe('System Integration Fallbacks', () => {
    it('should maintain service availability during partial outages', async () => {
      // Simulate scenario where historical rates are down but current rates work
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(new Error('Historical service down'));
      mockDb.exchangeRate.findFirst.mockResolvedValue({ rate: 1.25 } as any);
      
      const result = await historicalRateService.convertWithHistoricalRate(100, 'EUR', 'USD', 1);
      
      // Should still work using current rates
      expect(result).toBe(125);
    });

    it('should handle cascading failures with grace', async () => {
      // Multiple systems failing in sequence
      const errors = [
        'Historical DB down',
        'Current rates DB down', 
        'External API down'
      ];
      
      let errorIndex = 0;
      const mockError = () => {
        throw new Error(errors[errorIndex++] || 'Unknown error');
      };
      
      mockDb.expenseExchangeRate.findUnique.mockImplementation(mockError);
      mockDb.exchangeRate.findFirst.mockImplementation(mockError);
      mockFetch.mockImplementation(mockError);
      
      // Should still return a fallback value
      const result = await historicalRateService.convertWithHistoricalRate(100, 'ZAR', 'EUR');
      
      expect(result).toBe(5); // Hardcoded fallback
    });

    it('should provide meaningful error context for debugging', async () => {
      mockDb.expenseExchangeRate.findUnique.mockRejectedValue(
        new Error('Connection timeout after 30s')
      );
      
      await expect(
        historicalRateService.getHistoricalRate(1, 'EUR', 'USD')
      ).rejects.toThrow('DATABASE_ERROR: Failed to retrieve historical rate');
      
      expect(console.error).toHaveBeenCalledWith(
        'Error retrieving historical rate for expense 1:',
        expect.objectContaining({
          message: 'Connection timeout after 30s'
        })
      );
    });
  });
});