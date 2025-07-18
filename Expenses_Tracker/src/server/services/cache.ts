/**
 * Caching service for historical rates
 * Provides in-memory caching with TTL and LRU eviction
 */

import { logger } from "~/server/utils/logger";
import { monitoringService } from "~/server/services/monitoring";

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: number;
  newestEntry: number;
}

export class HistoricalRateCacheService {
  private static instance: HistoricalRateCacheService;
  private cache = new Map<string, CacheEntry<any>>();
  private hitCount = 0;
  private missCount = 0;
  private maxEntries = 1000; // Maximum number of cached entries
  private defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds
  private cleanupInterval: NodeJS.Timeout;

  static getInstance(): HistoricalRateCacheService {
    if (!HistoricalRateCacheService.instance) {
      HistoricalRateCacheService.instance = new HistoricalRateCacheService();
    }
    return HistoricalRateCacheService.instance;
  }

  constructor() {
    // Start cleanup interval every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('Historical rate cache service initialized', {
      operation: 'cache_init',
      metadata: { maxEntries: this.maxEntries, defaultTTL: this.defaultTTL }
    });
  }

  /**
   * Generate cache key for historical rate
   */
  private generateRateKey(expenseId: number, fromCurrency: string, toCurrency: string): string {
    return `rate:${expenseId}:${fromCurrency}:${toCurrency}`;
  }

  /**
   * Generate cache key for expense rates
   */
  private generateExpenseRatesKey(expenseId: number): string {
    return `expense_rates:${expenseId}`;
  }

  /**
   * Generate cache key for conversion result
   */
  private generateConversionKey(amount: number, fromCurrency: string, toCurrency: string, expenseId?: number): string {
    const expenseKey = expenseId ? `:${expenseId}` : '';
    return `conversion:${amount}:${fromCurrency}:${toCurrency}${expenseKey}`;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl || this.defaultTTL;

    // If cache is full, remove least recently used entry
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);

    logger.debug('Cache entry set', {
      operation: 'cache_set',
      metadata: { key, ttl: entryTTL, cacheSize: this.cache.size }
    });
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (!entry) {
      this.missCount++;
      logger.debug('Cache miss', {
        operation: 'cache_miss',
        metadata: { key }
      });
      return null;
    }

    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      logger.debug('Cache entry expired', {
        operation: 'cache_expired',
        metadata: { key, age: now - entry.timestamp, ttl: entry.ttl }
      });
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.hitCount++;

    logger.debug('Cache hit', {
      operation: 'cache_hit',
      metadata: { key, accessCount: entry.accessCount }
    });

    return entry.value;
  }

  /**
   * Cache historical rate
   */
  cacheHistoricalRate(expenseId: number, fromCurrency: string, toCurrency: string, rate: number): void {
    const key = this.generateRateKey(expenseId, fromCurrency, toCurrency);
    // Historical rates are relatively stable, cache for longer
    this.set(key, rate, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Get cached historical rate
   */
  getCachedHistoricalRate(expenseId: number, fromCurrency: string, toCurrency: string): number | null {
    const key = this.generateRateKey(expenseId, fromCurrency, toCurrency);
    return this.get<number>(key);
  }

  /**
   * Cache all rates for an expense
   */
  cacheExpenseRates(expenseId: number, rates: Array<{ fromCurrency: string; toCurrency: string; rate: number }>): void {
    const key = this.generateExpenseRatesKey(expenseId);
    // Cache expense rates for 24 hours
    this.set(key, rates, 24 * 60 * 60 * 1000);

    // Also cache individual rates
    rates.forEach(rate => {
      this.cacheHistoricalRate(expenseId, rate.fromCurrency, rate.toCurrency, rate.rate);
    });

    logger.info('Cached expense rates', {
      operation: 'cache_expense_rates',
      expenseId,
      metadata: { rateCount: rates.length }
    });
  }

  /**
   * Get cached expense rates
   */
  getCachedExpenseRates(expenseId: number): Array<{ fromCurrency: string; toCurrency: string; rate: number }> | null {
    const key = this.generateExpenseRatesKey(expenseId);
    return this.get<Array<{ fromCurrency: string; toCurrency: string; rate: number }>>(key);
  }

  /**
   * Cache conversion result
   */
  cacheConversion(amount: number, fromCurrency: string, toCurrency: string, result: number, expenseId?: number): void {
    const key = this.generateConversionKey(amount, fromCurrency, toCurrency, expenseId);
    // Conversion results are cached for shorter time as they depend on current rates
    const ttl = expenseId ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000; // 24h for historical, 30min for current
    this.set(key, result, ttl);
  }

  /**
   * Get cached conversion result
   */
  getCachedConversion(amount: number, fromCurrency: string, toCurrency: string, expenseId?: number): number | null {
    const key = this.generateConversionKey(amount, fromCurrency, toCurrency, expenseId);
    return this.get<number>(key);
  }

  /**
   * Invalidate cache entries for a specific expense
   */
  invalidateExpense(expenseId: number): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
      if (key.includes(`:${expenseId}:`) || key.includes(`expense_rates:${expenseId}`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    logger.info('Invalidated cache entries for expense', {
      operation: 'cache_invalidate_expense',
      expenseId,
      metadata: { deletedKeys: keysToDelete.length }
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Evicted LRU cache entry', {
        operation: 'cache_evict_lru',
        metadata: { key: oldestKey, age: Date.now() - oldestTime }
      });
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      logger.info('Cache cleanup completed', {
        operation: 'cache_cleanup',
        metadata: { 
          expiredEntries: keysToDelete.length,
          remainingEntries: this.cache.size
        }
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let oldestEntry = now;
    let newestEntry = 0;
    let memoryUsage = 0;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
      // Rough memory usage estimation
      memoryUsage += key.length * 2 + JSON.stringify(entry.value).length * 2 + 64; // 64 bytes for entry metadata
    }

    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      memoryUsage,
      oldestEntry: oldestEntry === now ? 0 : oldestEntry,
      newestEntry
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    logger.info('Cache cleared', {
      operation: 'cache_clear',
      metadata: { entriesCleared }
    });
  }

  /**
   * Warm cache with frequently accessed rates
   */
  async warmCache(expenseIds: number[]): Promise<void> {
    logger.info('Starting cache warming', {
      operation: 'cache_warm_start',
      metadata: { expenseCount: expenseIds.length }
    });

    // This would typically fetch from database and populate cache
    // Implementation depends on the specific data access patterns
    
    logger.info('Cache warming completed', {
      operation: 'cache_warm_complete',
      metadata: { expenseCount: expenseIds.length }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    logger.info('Cache service destroyed', {
      operation: 'cache_destroy'
    });
  }
}

// Export singleton instance
export const cacheService = HistoricalRateCacheService.getInstance();