/**
 * Enhanced Cache Service for Exchange Rates - Fase 4
 * 
 * Sistema di cache avanzato con:
 * - TTL configurabile per diversi tipi di dati
 * - Cache warming e preloading
 * - Metrics e performance monitoring  
 * - Invalidazione intelligente
 * - Supporto per cache layering
 */

import { logger } from "~/server/utils/logger";

export interface EnhancedCacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  keyType: CacheKeyType;
  size: number; // Approximate memory size
}

export type CacheKeyType = 
  | 'exchange_rate_current'    // TTL: 1 hour
  | 'exchange_rate_historical' // TTL: 24 hours  
  | 'conversion_result'        // TTL: 30 minutes
  | 'api_response'            // TTL: 15 minutes
  | 'dashboard_data'          // TTL: 5 minutes
  | 'expense_calculation';     // TTL: 2 hours

export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number;
  ttlByType: Record<CacheKeyType, number>;
  enableMetrics: boolean;
  cleanupInterval: number;
  warningThreshold: number; // Memory usage warning threshold
}

export interface CacheMetrics {
  totalEntries: number;
  entriesByType: Record<CacheKeyType, number>;
  hitCount: number;
  missCount: number;
  hitRate: number;
  memoryUsage: number;
  averageAccessCount: number;
  oldestEntry: number;
  newestEntry: number;
  warmingStatus: 'idle' | 'warming' | 'complete';
  lastWarmingTime: number | null;
}

export class EnhancedCacheService {
  private static instance: EnhancedCacheService;
  private cache = new Map<string, EnhancedCacheEntry<any>>();
  private hitCount = 0;
  private missCount = 0;
  private warmingStatus: 'idle' | 'warming' | 'complete' = 'idle';
  private lastWarmingTime: number | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private config: CacheConfig = {
    maxEntries: 5000,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    ttlByType: {
      'exchange_rate_current': 60 * 60 * 1000,    // 1 hour
      'exchange_rate_historical': 24 * 60 * 60 * 1000, // 24 hours
      'conversion_result': 30 * 60 * 1000,        // 30 minutes
      'api_response': 15 * 60 * 1000,             // 15 minutes
      'dashboard_data': 5 * 60 * 1000,            // 5 minutes
      'expense_calculation': 2 * 60 * 60 * 1000,  // 2 hours
    },
    enableMetrics: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    warningThreshold: 50 * 1024 * 1024, // 50MB
  };

  static getInstance(): EnhancedCacheService {
    if (!EnhancedCacheService.instance) {
      EnhancedCacheService.instance = new EnhancedCacheService();
    }
    return EnhancedCacheService.instance;
  }

  private constructor() {
    this.startCleanupInterval();
    this.startMetricsInterval();
    
    logger.info('💾 Enhanced cache service initialized', {
      operation: 'enhanced_cache_init',
      config: {
        maxEntries: this.config.maxEntries,
        ttlTypes: Object.keys(this.config.ttlByType).length,
        cleanupInterval: this.config.cleanupInterval,
      }
    });
  }

  /**
   * Get value from cache with automatic TTL checking
   */
  get<T>(key: string, keyType: CacheKeyType): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      logger.debug('💾 Cache miss', { key, keyType });
      return null;
    }

    // Check TTL
    const now = Date.now();
    const ttl = this.config.ttlByType[keyType] || this.config.defaultTTL;
    
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      this.missCount++;
      logger.debug('💾 Cache expired', { key, keyType, age: now - entry.timestamp, ttl });
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.hitCount++;
    logger.debug('💾 Cache hit', { key, keyType, accessCount: entry.accessCount });
    
    return entry.value;
  }

  /**
   * Set value in cache with automatic TTL and size calculation
   */
  set<T>(key: string, value: T, keyType: CacheKeyType): void {
    const now = Date.now();
    const size = this.calculateSize(value);
    
    // Check if we need to evict old entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: EnhancedCacheEntry<T> = {
      value,
      timestamp: now,
      ttl: this.config.ttlByType[keyType] || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: now,
      keyType,
      size,
    };

    this.cache.set(key, entry);
    
    logger.debug('💾 Cache set', { 
      key, 
      keyType, 
      size, 
      ttl: entry.ttl,
      totalEntries: this.cache.size 
    });
  }

  /**
   * Get or compute value with automatic caching
   */
  async getOrSet<T>(
    key: string, 
    keyType: CacheKeyType, 
    computeFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key, keyType);
    if (cached !== null) {
      return cached;
    }

    logger.debug('💾 Cache miss, computing value', { key, keyType });
    const value = await computeFn();
    this.set(key, value, keyType);
    
    return value;
  }

  /**
   * Batch get multiple keys with different types
   */
  getBatch<T>(requests: Array<{ key: string; keyType: CacheKeyType }>): Array<{ key: string; value: T | null; hit: boolean }> {
    return requests.map(({ key, keyType }) => {
      const value = this.get<T>(key, keyType);
      return {
        key,
        value,
        hit: value !== null
      };
    });
  }

  /**
   * Batch set multiple values
   */
  setBatch<T>(entries: Array<{ key: string; value: T; keyType: CacheKeyType }>): void {
    entries.forEach(({ key, value, keyType }) => {
      this.set(key, value, keyType);
    });
    
    logger.debug('💾 Batch cache set', { count: entries.length });
  }

  /**
   * Invalidate entries by key pattern or type
   */
  invalidate(pattern?: string, keyType?: CacheKeyType): number {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const matchesPattern = !pattern || key.includes(pattern);
      const matchesType = !keyType || entry.keyType === keyType;
      
      if (matchesPattern && matchesType) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    logger.info('💾 Cache invalidated', { pattern, keyType, removed });
    return removed;
  }

  /**
   * Cache warming - preload common exchange rates
   */
  async warmCache(): Promise<void> {
    if (this.warmingStatus === 'warming') {
      logger.warn('💾 Cache warming already in progress');
      return;
    }

    this.warmingStatus = 'warming';
    const startTime = Date.now();
    
    logger.info('💾 Starting cache warming');

    try {
      // Import here to avoid circular dependencies
      const { fetchExchangeRate } = await import('~/server/utils/currency');
      
      // Common currency pairs to preload
      const commonPairs = [
        ['EUR', 'USD'], ['EUR', 'ZAR'], ['EUR', 'GBP'], ['EUR', 'JPY'],
        ['USD', 'EUR'], ['USD', 'ZAR'], ['USD', 'GBP'], ['USD', 'JPY'],
        ['ZAR', 'EUR'], ['ZAR', 'USD'], ['ZAR', 'GBP'], ['ZAR', 'JPY'],
      ];

      let warmed = 0;
      for (const [from, to] of commonPairs) {
        try {
          const rate = await fetchExchangeRate(from, to);
          const key = `rate:${from}:${to}`;
          this.set(key, rate, 'exchange_rate_current');
          warmed++;
        } catch (error) {
          logger.warn('💾 Failed to warm cache for pair', { from, to, error });
        }
      }

      this.warmingStatus = 'complete';
      this.lastWarmingTime = Date.now();
      
      const duration = Date.now() - startTime;
      logger.info('💾 Cache warming completed', { 
        pairs: warmed, 
        duration,
        totalEntries: this.cache.size 
      });
      
    } catch (error) {
      this.warmingStatus = 'idle';
      logger.error('💾 Cache warming failed', { error });
    }
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    const entriesByType = entries.reduce((acc, entry) => {
      acc[entry.keyType] = (acc[entry.keyType] || 0) + 1;
      return acc;
    }, {} as Record<CacheKeyType, number>);

    const totalAccesses = this.hitCount + this.missCount;
    const hitRate = totalAccesses > 0 ? this.hitCount / totalAccesses : 0;
    
    const memoryUsage = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageAccessCount = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length 
      : 0;

    const timestamps = entries.map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : now;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : now;

    return {
      totalEntries: this.cache.size,
      entriesByType,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      memoryUsage,
      averageAccessCount,
      oldestEntry,
      newestEntry,
      warmingStatus: this.warmingStatus,
      lastWarmingTime: this.lastWarmingTime,
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
    
    logger.info('💾 Cache cleared', { entriesBefore });
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('💾 Cache config updated', { newConfig });
  }

  /**
   * Private: Calculate approximate memory size of a value
   */
  private calculateSize(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return value.length * 2; // Assuming UTF-16
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 100; // Fallback estimate
      }
    }
    return 100; // Default estimate
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
      logger.debug('💾 Evicted oldest cache entry', { key: oldestKey, lastAccessed: oldestTime });
    }
  }

  /**
   * Private: Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const ttl = this.config.ttlByType[entry.keyType] || this.config.defaultTTL;
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('💾 Cache cleanup', { removed, remaining: this.cache.size });
    }
  }

  /**
   * Private: Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Private: Start metrics interval
   */
  private startMetricsInterval(): void {
    if (!this.config.enableMetrics) return;

    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      
      // Log metrics periodically
      logger.info('💾 Cache metrics', {
        operation: 'cache_metrics',
        ...metrics,
      });

      // Warn if memory usage is high
      if (metrics.memoryUsage > this.config.warningThreshold) {
        logger.warn('💾 High cache memory usage', {
          usage: metrics.memoryUsage,
          threshold: this.config.warningThreshold,
          entries: metrics.totalEntries,
        });
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.clear();
    logger.info('💾 Enhanced cache service destroyed');
  }
}

// Export singleton instance
export const enhancedCache = EnhancedCacheService.getInstance(); 