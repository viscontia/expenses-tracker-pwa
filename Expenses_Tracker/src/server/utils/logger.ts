/**
 * Structured logging utility for historical rate operations
 * Provides consistent logging format and monitoring capabilities
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  operation?: string;
  expenseId?: number;
  fromCurrency?: string;
  toCurrency?: string;
  rate?: number;
  source?: string;
  duration?: number;
  userId?: number;
  error?: Error | string;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  service: string;
}

export class HistoricalRateLogger {
  private static instance: HistoricalRateLogger;
  private readonly service = 'historical-rate-service';

  static getInstance(): HistoricalRateLogger {
    if (!HistoricalRateLogger.instance) {
      HistoricalRateLogger.instance = new HistoricalRateLogger();
    }
    return HistoricalRateLogger.instance;
  }

  private formatLogEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      service: this.service
    };
  }

  private writeLog(entry: LogEntry): void {
    const logString = JSON.stringify(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`🔍 ${logString}`);
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${logString}`);
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${logString}`);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${logString}`);
        break;
    }
  }

  debug(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.DEBUG, message, context));
  }

  info(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.INFO, message, context));
  }

  warn(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.WARN, message, context));
  }

  error(message: string, context: LogContext = {}): void {
    this.writeLog(this.formatLogEntry(LogLevel.ERROR, message, context));
  }

  // Specialized logging methods for historical rate operations
  logRateSaveStart(expenseId: number, expenseDate: Date): void {
    this.info('Starting historical rate save operation', {
      operation: 'save_rates_start',
      expenseId,
      metadata: { expenseDate: expenseDate.toISOString() }
    });
  }

  logRateSaveSuccess(expenseId: number, rateCount: number, duration: number): void {
    this.info('Historical rate save completed successfully', {
      operation: 'save_rates_success',
      expenseId,
      duration,
      metadata: { rateCount }
    });
  }

  logRateSaveFailure(expenseId: number, error: Error | string, duration: number): void {
    this.error('Historical rate save failed', {
      operation: 'save_rates_failure',
      expenseId,
      error,
      duration
    });
  }

  logRateRetrievalSuccess(expenseId: number, fromCurrency: string, toCurrency: string, rate: number): void {
    this.info('Historical rate retrieved successfully', {
      operation: 'rate_retrieval_success',
      expenseId,
      fromCurrency,
      toCurrency,
      rate
    });
  }

  logRateRetrievalMiss(expenseId: number, fromCurrency: string, toCurrency: string): void {
    this.warn('Historical rate not found, will use fallback', {
      operation: 'rate_retrieval_miss',
      expenseId,
      fromCurrency,
      toCurrency
    });
  }

  logConversionWithHistoricalRate(amount: number, fromCurrency: string, toCurrency: string, rate: number, expenseId: number): void {
    this.info('Currency conversion using historical rate', {
      operation: 'conversion_historical',
      expenseId,
      fromCurrency,
      toCurrency,
      rate,
      metadata: { amount, convertedAmount: amount * rate }
    });
  }

  logConversionWithCurrentRate(amount: number, fromCurrency: string, toCurrency: string, rate: number): void {
    this.warn('Currency conversion using current rate (fallback)', {
      operation: 'conversion_fallback',
      fromCurrency,
      toCurrency,
      rate,
      metadata: { amount, convertedAmount: amount * rate }
    });
  }

  logApiRateFetchFailure(fromCurrency: string, toCurrency: string, error: Error | string): void {
    this.error('Failed to fetch exchange rate from API', {
      operation: 'api_rate_fetch_failure',
      fromCurrency,
      toCurrency,
      error
    });
  }

  logMigrationStart(totalExpenses: number): void {
    this.info('Starting historical rate migration', {
      operation: 'migration_start',
      metadata: { totalExpenses }
    });
  }

  logMigrationProgress(expenseId: number, progress: number, total: number): void {
    this.debug('Migration progress update', {
      operation: 'migration_progress',
      expenseId,
      metadata: { progress, total, percentage: Math.round((progress / total) * 100) }
    });
  }

  logMigrationComplete(result: { totalExpenses: number; migratedExpenses: number; skippedExpenses: number; errors: string[]; duration: number }): void {
    this.info('Historical rate migration completed', {
      operation: 'migration_complete',
      duration: result.duration,
      metadata: result
    });
  }

  logDatabaseError(operation: string, error: Error | string, context: LogContext = {}): void {
    this.error('Database operation failed', {
      operation: `database_${operation}`,
      error,
      ...context
    });
  }
}

// Export singleton instance
export const logger = HistoricalRateLogger.getInstance();