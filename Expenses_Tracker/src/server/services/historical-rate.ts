import { RawHistoricalRatesDB } from "~/server/db-raw";
import { fetchExchangeRate, findClosestHistoricalRate, fetchRatesForDate } from "~/server/utils/currency";
import { logger } from "~/server/utils/logger";
import { cacheService } from "~/server/services/cache";

export interface HistoricalRateService {
  saveRatesForExpense(expenseId: number, expenseDate: Date): Promise<void>;
  getHistoricalRate(expenseId: number, fromCurrency: string, toCurrency: string): Promise<number | null>;
  convertWithHistoricalRate(amount: number, fromCurrency: string, toCurrency: string, expenseId?: number): Promise<number>;
  migrateExistingExpenses(): Promise<MigrationResult>;
}

export interface MigrationResult {
  totalExpenses: number;
  migratedExpenses: number;
  skippedExpenses: number;
  errors: string[];
  duration: number;
}

export enum HistoricalRateError {
  RATE_NOT_FOUND = 'HISTORICAL_RATE_NOT_FOUND',
  API_UNAVAILABLE = 'EXCHANGE_API_UNAVAILABLE',
  INVALID_CURRENCY = 'INVALID_CURRENCY_CODE',
  DATABASE_ERROR = 'DATABASE_OPERATION_FAILED'
}

export class HistoricalRateServiceImpl implements HistoricalRateService {
  private readonly supportedCurrencies = ['EUR', 'ZAR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];

  async saveRatesForExpense(expenseId: number, expenseDate: Date): Promise<void> {
    const startTime = Date.now();
    logger.logRateSaveStart(expenseId, expenseDate);
    
    try {
      // 🚀 OTTIMIZZAZIONE CRITICA: Salva solo i tassi necessari per questa spesa
      // PROBLEMA RISOLTO: Prima salvava 56 tassi per spesa (8x7 combinazioni) = CONGELAMENTO!
      // SOLUZIONE: Salva solo il tasso specifico necessario
      
      // Ottieni la spesa per sapere quale valuta stiamo usando
      const expense = await RawHistoricalRatesDB.findExpenseById(expenseId);
      if (!expense) {
        logger.error(`Expense ${expenseId} not found for historical rate save`);
        return;
      }

      const ratesToSave: Array<{
        expenseId: number;
        fromCurrency: string;
        toCurrency: string;
        rate: number;
      }> = [];

      const expenseCurrency = expense.currency;
      
      // Solo se non è EUR, salviamo il tasso necessario per la conversione
      if (expenseCurrency !== 'EUR') {
        try {
          // Salva solo il tasso dalla valuta della spesa verso EUR (valuta base)
          const rateToEur = await fetchExchangeRate(expenseCurrency, 'EUR');
          if (rateToEur && rateToEur > 0) {
            ratesToSave.push({
              expenseId,
              fromCurrency: expenseCurrency,
              toCurrency: 'EUR',
              rate: rateToEur
            });
            logger.debug(`Fetched rate ${expenseCurrency}→EUR: ${rateToEur}`);
          }
        } catch (error) {
          logger.logApiRateFetchFailure(expenseCurrency, 'EUR', error instanceof Error ? error : String(error));
        }
      }

      // Salva i tassi nel database (0-1 tassi invece di 56!)
      if (ratesToSave.length > 0) {
        await RawHistoricalRatesDB.createManyExpenseExchangeRates(
          ratesToSave.map(rate => ({
            expenseId: rate.expenseId,
            fromCurrency: rate.fromCurrency,
            toCurrency: rate.toCurrency,
            rate: rate.rate,
            date: expenseDate
          }))
        );

        const duration = Date.now() - startTime;
        logger.logRateSaveSuccess(expenseId, ratesToSave.length, duration);
        console.log(`✅ [HistoricalRate] Saved ${ratesToSave.length} rate(s) for expense ${expenseId} in ${duration}ms`);
      } else {
        const duration = Date.now() - startTime;
        console.log(`ℹ️ [HistoricalRate] No rates needed for EUR expense ${expenseId} (${duration}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error : String(error);
      logger.logRateSaveFailure(expenseId, errorMsg, duration);
      console.error(`❌ [HistoricalRate] Failed to save rates for expense ${expenseId}:`, errorMsg);
      // NON facciamo throw per non bloccare l'inserimento della spesa
    }
  }

  async getHistoricalRate(expenseId: number, fromCurrency: string, toCurrency: string): Promise<number | null> {
    const startTime = Date.now();
    
    try {
      if (fromCurrency === toCurrency) {
        return 1;
      }

      // Check cache first
      const cachedRate = cacheService.getCachedHistoricalRate(expenseId, fromCurrency, toCurrency);
      if (cachedRate !== null) {
        const duration = Date.now() - startTime;
        logger.logRateRetrievalSuccess(expenseId, fromCurrency, toCurrency, cachedRate);
        return cachedRate;
      }

      const historicalRate = await RawHistoricalRatesDB.findExpenseExchangeRate(expenseId, fromCurrency, toCurrency);

      const duration = Date.now() - startTime;

      if (historicalRate) {
        const rate = Number(historicalRate.rate);
        
        // Cache the retrieved rate
        cacheService.cacheHistoricalRate(expenseId, fromCurrency, toCurrency, rate);
        
        logger.logRateRetrievalSuccess(expenseId, fromCurrency, toCurrency, rate);
        return rate;
      }

      logger.logRateRetrievalMiss(expenseId, fromCurrency, toCurrency);
      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logDatabaseError('rate_retrieval', error instanceof Error ? error : String(error), {
        expenseId,
        fromCurrency,
        toCurrency
      });
      throw new Error(`${HistoricalRateError.DATABASE_ERROR}: Failed to retrieve historical rate`);
    }
  }

  async convertWithHistoricalRate(
    amount: number, 
    fromCurrency: string, 
    toCurrency: string, 
    expenseId?: number
  ): Promise<number> {
    const startTime = Date.now();
    
    try {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      // Check cache for conversion result first
      const cachedConversion = cacheService.getCachedConversion(amount, fromCurrency, toCurrency, expenseId);
      if (cachedConversion !== null) {
        const duration = Date.now() - startTime;
        logger.logConversionWithHistoricalRate(amount, fromCurrency, toCurrency, cachedConversion / amount, expenseId || 0);
        return cachedConversion;
      }

      // Try to use historical rate if expenseId is provided
      if (expenseId) {
        const historicalRate = await this.getHistoricalRate(expenseId, fromCurrency, toCurrency);
        if (historicalRate !== null) {
          const convertedAmount = amount * historicalRate;
          const duration = Date.now() - startTime;
          
          // Cache the conversion result
          cacheService.cacheConversion(amount, fromCurrency, toCurrency, convertedAmount, expenseId);
          
          logger.logConversionWithHistoricalRate(amount, fromCurrency, toCurrency, historicalRate, expenseId);
          
          return convertedAmount;
        }
      }

      // Fallback to current rate
      const currentRate = await fetchExchangeRate(fromCurrency, toCurrency);
      const convertedAmount = amount * currentRate;
      const duration = Date.now() - startTime;
      
      // Cache the conversion result (shorter TTL for current rates)
      cacheService.cacheConversion(amount, fromCurrency, toCurrency, convertedAmount);
      
      logger.logConversionWithCurrentRate(amount, fromCurrency, toCurrency, currentRate);
      
      return convertedAmount;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error : String(error);
      
      logger.error('Currency conversion failed', {
        operation: 'conversion_error',
        fromCurrency,
        toCurrency,
        expenseId,
        error: errorMsg,
        duration,
        metadata: { amount }
      });
      
      throw new Error(`${HistoricalRateError.API_UNAVAILABLE}: Failed to convert currency`);
    }
  }

  async migrateExistingExpenses(): Promise<MigrationResult> {
    const startTime = Date.now();
    let migratedExpenses = 0;
    let skippedExpenses = 0;
    const errors: string[] = [];

    try {
      const expenses = await RawHistoricalRatesDB.findAllExpensesForMigration(1000); // Get all expenses in batches
      
      logger.logMigrationStart(expenses.length);

      for (const expense of expenses) {
        try {
          // Check if historical rates already exist for this expense
          const existingRates = await RawHistoricalRatesDB.countExpenseExchangeRates(expense.id);

          if (existingRates > 0) {
            logger.debug('Skipping expense - historical rates already exist', {
              operation: 'migration_skip',
              expenseId: expense.id,
              metadata: { existingRatesCount: existingRates }
            });
            skippedExpenses++;
            continue;
          }

          await this.migrateExpenseRates(expense);
          migratedExpenses++;
          
          logger.logMigrationProgress(expense.id, migratedExpenses, expenses.length);
        } catch (error) {
          const errorMessage = `Expense ${expense.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          logger.error('Migration failed for expense', {
            operation: 'migration_expense_error',
            expenseId: expense.id,
            error: errorMessage
          });
          skippedExpenses++;
        }
      }

      const duration = Date.now() - startTime;
      const result: MigrationResult = {
        totalExpenses: expenses.length,
        migratedExpenses,
        skippedExpenses,
        errors,
        duration
      };

      logger.logMigrationComplete(result);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Migration failed completely', {
        operation: 'migration_failure',
        error: errorMsg,
        duration,
        metadata: { migratedExpenses, skippedExpenses }
      });
      
      return {
        totalExpenses: 0,
        migratedExpenses,
        skippedExpenses,
        errors: [...errors, `Migration failed: ${errorMsg}`],
        duration
      };
    }
  }

  /**
   * Migrate historical rates for a single expense using enhanced logic
   * 1. Use existing conversionRate field as primary source
   * 2. Find closest historical rates from exchange_rates table
   * 3. Fetch current rates as fallback
   */
  private async migrateExpenseRates(expense: any): Promise<void> {
    logger.debug('Starting expense rate migration', {
      operation: 'migrate_expense_rates',
      expenseId: expense.id,
      metadata: { 
        currency: expense.currency, 
        amount: expense.amount, 
        date: expense.date.toISOString() 
      }
    });
    
    const ratesToSave: Array<{
      expenseId: number;
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      source: 'existing_conversion_rate' | 'closest_historical' | 'current_api';
    }> = [];

    // Step 1: Use existing conversionRate field as primary source
    if (expense.conversionRate && expense.currency !== 'EUR') {
      logger.debug('Using existing conversion rate', {
        operation: 'migrate_use_existing_rate',
        expenseId: expense.id,
        fromCurrency: expense.currency,
        toCurrency: 'EUR',
        rate: expense.conversionRate
      });
      
      ratesToSave.push({
        expenseId: expense.id,
        fromCurrency: expense.currency,
        toCurrency: 'EUR',
        rate: expense.conversionRate,
        source: 'existing_conversion_rate'
      });

      // Also save the inverse rate
      ratesToSave.push({
        expenseId: expense.id,
        fromCurrency: 'EUR',
        toCurrency: expense.currency,
        rate: 1 / expense.conversionRate,
        source: 'existing_conversion_rate'
      });
    }

    // Step 2: Find closest historical rates from exchange_rates table for other currency pairs
    const processedPairs = new Set<string>();
    
    for (const fromCurrency of this.supportedCurrencies) {
      for (const toCurrency of this.supportedCurrencies) {
        if (fromCurrency === toCurrency) continue;
        
        const pairKey = `${fromCurrency}-${toCurrency}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Skip if we already have this rate from existing conversionRate
        const existingRate = ratesToSave.find(r => 
          r.fromCurrency === fromCurrency && r.toCurrency === toCurrency
        );
        if (existingRate) continue;

        try {
          // Try to find closest historical rate
          const closestRate = await findClosestHistoricalRate(
            fromCurrency, 
            toCurrency, 
            expense.date,
            30 // Allow up to 30 days difference
          );

          if (closestRate) {
            logger.debug('Found closest historical rate', {
              operation: 'migrate_use_historical_rate',
              expenseId: expense.id,
              fromCurrency,
              toCurrency,
              rate: closestRate.rate,
              metadata: { daysDifference: closestRate.daysDifference }
            });
            
            ratesToSave.push({
              expenseId: expense.id,
              fromCurrency,
              toCurrency,
              rate: closestRate.rate,
              source: 'closest_historical'
            });
          } else {
            // Step 3: Fallback to current API rate
            try {
              const currentRate = await fetchExchangeRate(fromCurrency, toCurrency);
              logger.debug('Using current API rate as fallback', {
                operation: 'migrate_use_current_rate',
                expenseId: expense.id,
                fromCurrency,
                toCurrency,
                rate: currentRate
              });
              
              ratesToSave.push({
                expenseId: expense.id,
                fromCurrency,
                toCurrency,
                rate: currentRate,
                source: 'current_api'
              });
            } catch (apiError) {
              logger.warn('Failed to fetch current rate during migration', {
                operation: 'migrate_api_failure',
                expenseId: expense.id,
                fromCurrency,
                toCurrency,
                error: apiError instanceof Error ? apiError.message : String(apiError)
              });
              // Continue with other rates
            }
          }
        } catch (error) {
          logger.warn('Error processing currency pair during migration', {
            operation: 'migrate_processing_error',
            expenseId: expense.id,
            fromCurrency,
            toCurrency,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other rates
        }
      }
    }

    // Save all rates in a single transaction
    if (ratesToSave.length > 0) {
      await RawHistoricalRatesDB.createManyExpenseExchangeRates(
        ratesToSave.map(rate => ({
          expenseId: rate.expenseId,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          rate: rate.rate,
          date: new Date(expense.date)
        }))
      );

      // Log migration statistics
      const sourceStats = ratesToSave.reduce((acc, rate) => {
        acc[rate.source] = (acc[rate.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      logger.info('Successfully migrated rates for expense', {
        operation: 'migrate_expense_success',
        expenseId: expense.id,
        metadata: { 
          totalRates: ratesToSave.length,
          sourceBreakdown: sourceStats
        }
      });
    } else {
      const errorMsg = 'No rates available for migration';
      logger.error('Migration failed - no rates available', {
        operation: 'migrate_expense_no_rates',
        expenseId: expense.id,
        error: errorMsg
      });
      throw new Error(errorMsg);
    }
  }
}

// Export singleton instance
export const historicalRateService = new HistoricalRateServiceImpl();