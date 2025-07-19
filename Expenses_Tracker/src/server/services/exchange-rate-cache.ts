/**
 * Exchange Rate Cache Service - Fase 4
 * 
 * Cache specializzato per tassi di cambio con:
 * - TTL ottimizzato per diversi tipi di tassi
 * - Cache warming per coppie di valute comuni
 * - Invalidazione intelligente
 * - Metrics per monitoraggio performance
 */

export interface ExchangeRateCacheEntry {
  value: number;
  timestamp: number;
  fromCurrency: string;
  toCurrency: string;
  source: 'api' | 'database' | 'fallback';
  accessCount: number;
  lastAccessed: number;
}

export interface ExchangeRateCacheMetrics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  apiCallsSaved: number;
  averageAccessCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export class ExchangeRateCacheService {
  private static instance: ExchangeRateCacheService;
  private cache = new Map<string, ExchangeRateCacheEntry>();
  private hitCount = 0;
  private missCount = 0;
  private apiCallsSaved = 0;
  
  // Configuration
  private readonly maxEntries = 1000;
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour
  private readonly historicalTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  static getInstance(): ExchangeRateCacheService {
    if (!ExchangeRateCacheService.instance) {
      ExchangeRateCacheService.instance = new ExchangeRateCacheService();
    }
    return ExchangeRateCacheService.instance;
  }

  private constructor() {
    this.startCleanupTimer();
    console.log('💾 Exchange rate cache service initialized');
  }

  /**
   * Get exchange rate from cache
   */
  getExchangeRate(fromCurrency: string, toCurrency: string, isHistorical: boolean = false): number | null {
    const key = this.generateKey(fromCurrency, toCurrency);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL
    const now = Date.now();
    const ttl = isHistorical ? this.historicalTTL : this.defaultTTL;
    
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.hitCount++;
    this.apiCallsSaved++;
    
    return entry.value;
  }

  /**
   * Set exchange rate in cache
   */
  setExchangeRate(
    fromCurrency: string, 
    toCurrency: string, 
    rate: number, 
    source: 'api' | 'database' | 'fallback' = 'api'
  ): void {
    const key = this.generateKey(fromCurrency, toCurrency);
    const now = Date.now();
    
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const entry: ExchangeRateCacheEntry = {
      value: rate,
      timestamp: now,
      fromCurrency,
      toCurrency,
      source,
      accessCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get rate with automatic fallback and caching
   */
  async getOrFetchRate(
    fromCurrency: string, 
    toCurrency: string, 
    fetchFn: () => Promise<number>,
    isHistorical: boolean = false
  ): Promise<number> {
    // Try cache first
    const cached = this.getExchangeRate(fromCurrency, toCurrency, isHistorical);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch and cache
    try {
      const rate = await fetchFn();
      this.setExchangeRate(fromCurrency, toCurrency, rate, 'api');
      return rate;
    } catch (error) {
      console.error('💾 Failed to fetch exchange rate:', error);
      throw error;
    }
  }

  /**
   * Batch get multiple exchange rates
   */
  getBatchRates(pairs: Array<{ from: string; to: string; historical?: boolean }>): Array<{
    from: string;
    to: string;
    rate: number | null;
    cached: boolean;
  }> {
    return pairs.map(({ from, to, historical = false }) => {
      const rate = this.getExchangeRate(from, to, historical);
      return {
        from,
        to,
        rate,
        cached: rate !== null
      };
    });
  }

  /**
   * Batch set multiple exchange rates
   */
  setBatchRates(entries: Array<{
    from: string;
    to: string;
    rate: number;
    source?: 'api' | 'database' | 'fallback';
  }>): void {
    entries.forEach(({ from, to, rate, source = 'api' }) => {
      this.setExchangeRate(from, to, rate, source);
    });
  }

  /**
   * Invalidate cache entries for specific currencies
   */
  invalidateCurrency(currency: string): number {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.fromCurrency === currency || entry.toCurrency === currency) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    console.log(`💾 Invalidated ${removed} cache entries for currency: ${currency}`);
    return removed;
  }

  /**
   * Warm cache with provided exchange rate pairs
   */
  warmCacheWithRates(rates: Array<{ from: string; to: string; rate: number }>): void {
    console.log('💾 Starting exchange rate cache warming...');
    
    let warmed = 0;
    rates.forEach(({ from, to, rate }) => {
      this.setExchangeRate(from, to, rate, 'api');
      warmed++;
    });

    console.log(`💾 Cache warming completed: ${warmed} rates cached`);
  }

  /**
   * Get cache performance metrics
   */
  getMetrics(): ExchangeRateCacheMetrics {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    const totalAccesses = this.hitCount + this.missCount;
    const hitRate = totalAccesses > 0 ? this.hitCount / totalAccesses : 0;
    
    const averageAccessCount = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length 
      : 0;

    const timestamps = entries.map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : now;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : now;

    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      apiCallsSaved: this.apiCallsSaved,
      averageAccessCount,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const entriesBefore = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.apiCallsSaved = 0;
    
    console.log(`💾 Cache cleared: ${entriesBefore} entries removed`);
  }

  /**
   * Get cache status summary
   */
  getStatusSummary(): {
    size: number;
    hitRate: number;
    apiCallsSaved: number;
    oldestAgeMinutes: number;
  } {
    const metrics = this.getMetrics();
    const now = Date.now();
    const oldestAgeMinutes = metrics.totalEntries > 0 
      ? Math.round((now - metrics.oldestEntry) / (1000 * 60))
      : 0;

    return {
      size: metrics.totalEntries,
      hitRate: Math.round(metrics.hitRate * 100) / 100,
      apiCallsSaved: metrics.apiCallsSaved,
      oldestAgeMinutes,
    };
  }

  /**
   * Private: Generate cache key
   */
  private generateKey(fromCurrency: string, toCurrency: string): string {
    return `${fromCurrency}:${toCurrency}`;
  }

  /**
   * Private: Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Private: Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Use shorter TTL for better freshness
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`💾 Cache cleanup: ${removed} expired entries removed`);
    }
  }

  /**
   * Private: Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Destroy cache service
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
    console.log('💾 Exchange rate cache service destroyed');
  }
}

// Export singleton instance
export const exchangeRateCache = ExchangeRateCacheService.getInstance(); 