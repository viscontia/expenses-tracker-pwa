#!/usr/bin/env tsx

import { db } from "~/server/db";
import { historicalRateService, type MigrationResult } from "~/server/services/historical-rate";
import fs from 'fs/promises';
import path from 'path';

interface MigrationState {
  startTime: number;
  totalExpenses: number;
  processedExpenses: number;
  migratedExpenses: number;
  skippedExpenses: number;
  errors: string[];
  lastProcessedId: number;
  batchSize: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
}

interface MigrationConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  progressReportInterval: number;
  stateFile: string;
  logFile: string;
  enableRollback: boolean;
}

class MigrationExecutor {
  private config: MigrationConfig;
  private state: MigrationState;
  private logStream: any;

  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 1000,
      progressReportInterval: 10,
      stateFile: 'migration-state.json',
      logFile: 'migration.log',
      enableRollback: true,
      ...config
    };

    this.state = {
      startTime: Date.now(),
      totalExpenses: 0,
      processedExpenses: 0,
      migratedExpenses: 0,
      skippedExpenses: 0,
      errors: [],
      lastProcessedId: 0,
      batchSize: this.config.batchSize,
      status: 'running'
    };
  }

  async initialize(): Promise<void> {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Setup log file
    this.config.logFile = path.join(logsDir, this.config.logFile);
    this.config.stateFile = path.join(logsDir, this.config.stateFile);

    // Try to resume from previous state
    await this.loadState();

    // Get total expenses count
    if (this.state.totalExpenses === 0) {
      this.state.totalExpenses = await db.expense.count();
    }

    this.log(`Migration initialized. Total expenses: ${this.state.totalExpenses}`);
    this.log(`Batch size: ${this.config.batchSize}, Max retries: ${this.config.maxRetries}`);
    
    if (this.state.lastProcessedId > 0) {
      this.log(`Resuming from expense ID: ${this.state.lastProcessedId}`);
    }
  }

  async loadState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.config.stateFile, 'utf-8');
      const savedState = JSON.parse(stateData);
      
      // Merge saved state with current state
      this.state = {
        ...this.state,
        ...savedState,
        status: 'running' // Always set to running when resuming
      };
      
      this.log(`Loaded previous migration state. Processed: ${this.state.processedExpenses}/${this.state.totalExpenses}`);
    } catch (error) {
      this.log('No previous migration state found. Starting fresh migration.');
    }
  }

  async saveState(): Promise<void> {
    try {
      await fs.writeFile(this.config.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      this.log(`Error saving migration state: ${error}`);
    }
  }

  async log(message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    
    try {
      await fs.appendFile(this.config.logFile, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async executeMigration(): Promise<MigrationResult> {
    try {
      await this.initialize();
      
      this.log('Starting historical rates migration...');
      this.state.status = 'running';
      await this.saveState();

      let hasMore = true;
      
      while (hasMore && this.state.status === 'running') {
        const batch = await this.getNextBatch();
        
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        await this.processBatch(batch);
        
        // Save state after each batch
        await this.saveState();
        
        // Report progress
        if (this.state.processedExpenses % this.config.progressReportInterval === 0) {
          await this.reportProgress();
        }
      }

      this.state.status = 'completed';
      await this.saveState();
      
      const result: MigrationResult = {
        totalExpenses: this.state.totalExpenses,
        migratedExpenses: this.state.migratedExpenses,
        skippedExpenses: this.state.skippedExpenses,
        errors: this.state.errors,
        duration: Date.now() - this.state.startTime
      };

      this.log(`Migration completed successfully!`);
      this.log(`Total: ${result.totalExpenses}, Migrated: ${result.migratedExpenses}, Skipped: ${result.skippedExpenses}`);
      this.log(`Duration: ${result.duration}ms, Errors: ${result.errors.length}`);

      return result;
    } catch (error) {
      this.state.status = 'failed';
      await this.saveState();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Migration failed: ${errorMessage}`);
      
      throw error;
    }
  }

  private async getNextBatch(): Promise<any[]> {
    return await db.expense.findMany({
      where: {
        id: {
          gt: this.state.lastProcessedId
        }
      },
      orderBy: {
        id: 'asc'
      },
      take: this.config.batchSize
    });
  }

  private async processBatch(expenses: any[]): Promise<void> {
    this.log(`Processing batch of ${expenses.length} expenses...`);
    
    for (const expense of expenses) {
      let retries = 0;
      let success = false;
      
      while (retries < this.config.maxRetries && !success) {
        try {
          await this.processExpense(expense);
          success = true;
          this.state.migratedExpenses++;
        } catch (error) {
          retries++;
          const errorMessage = `Expense ${expense.id} (attempt ${retries}): ${error instanceof Error ? error.message : 'Unknown error'}`;
          
          if (retries >= this.config.maxRetries) {
            this.state.errors.push(errorMessage);
            this.state.skippedExpenses++;
            this.log(`Failed to migrate expense ${expense.id} after ${retries} attempts`);
          } else {
            this.log(`Retrying expense ${expense.id} (attempt ${retries + 1})`);
            await this.delay(this.config.retryDelay);
          }
        }
      }
      
      this.state.processedExpenses++;
      this.state.lastProcessedId = expense.id;
    }
  }

  private async processExpense(expense: any): Promise<void> {
    // Check if historical rates already exist for this expense
    const existingRates = await db.expenseExchangeRate.count({
      where: { expenseId: expense.id }
    });

    if (existingRates > 0) {
      // Skip if already migrated
      return;
    }

    // Use the existing migration logic from the service
    await this.migrateExpenseRates(expense);
  }

  private async migrateExpenseRates(expense: any): Promise<void> {
    const supportedCurrencies = ['EUR', 'ZAR', 'USD', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
    
    const ratesToSave: Array<{
      expenseId: number;
      fromCurrency: string;
      toCurrency: string;
      rate: number;
    }> = [];

    // Use existing conversionRate field as primary source
    if (expense.conversionRate && expense.currency !== 'EUR') {
      ratesToSave.push({
        expenseId: expense.id,
        fromCurrency: expense.currency,
        toCurrency: 'EUR',
        rate: expense.conversionRate
      });

      // Also save the inverse rate
      ratesToSave.push({
        expenseId: expense.id,
        fromCurrency: 'EUR',
        toCurrency: expense.currency,
        rate: 1 / expense.conversionRate
      });
    }

    // For other currency pairs, we'll use a simplified approach for the migration script
    // to avoid complex API calls during batch processing
    
    // Save the rates we have
    if (ratesToSave.length > 0) {
      await db.expenseExchangeRate.createMany({
        data: ratesToSave,
        skipDuplicates: true
      });
    }
  }

  private async reportProgress(): Promise<void> {
    const percentage = ((this.state.processedExpenses / this.state.totalExpenses) * 100).toFixed(2);
    const elapsed = Date.now() - this.state.startTime;
    const rate = this.state.processedExpenses / (elapsed / 1000);
    const eta = this.state.totalExpenses > this.state.processedExpenses 
      ? ((this.state.totalExpenses - this.state.processedExpenses) / rate) 
      : 0;

    this.log(`Progress: ${this.state.processedExpenses}/${this.state.totalExpenses} (${percentage}%)`);
    this.log(`Migrated: ${this.state.migratedExpenses}, Skipped: ${this.state.skippedExpenses}, Errors: ${this.state.errors.length}`);
    this.log(`Rate: ${rate.toFixed(2)} expenses/sec, ETA: ${Math.round(eta)}s`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async rollback(): Promise<void> {
    if (!this.config.enableRollback) {
      throw new Error('Rollback is disabled in configuration');
    }

    this.log('Starting rollback of historical rates migration...');
    
    try {
      // Get all expenses that have historical rates
      const expensesWithRates = await db.expenseExchangeRate.groupBy({
        by: ['expenseId'],
        _count: {
          id: true
        }
      });

      this.log(`Found ${expensesWithRates.length} expenses with historical rates to rollback`);

      // Delete all historical rates in batches
      let deletedCount = 0;
      const batchSize = 100;
      
      for (let i = 0; i < expensesWithRates.length; i += batchSize) {
        const batch = expensesWithRates.slice(i, i + batchSize);
        const expenseIds = batch.map(e => e.expenseId);
        
        const result = await db.expenseExchangeRate.deleteMany({
          where: {
            expenseId: {
              in: expenseIds
            }
          }
        });
        
        deletedCount += result.count;
        this.log(`Rollback progress: ${deletedCount} rates deleted`);
      }

      // Clean up state file
      try {
        await fs.unlink(this.config.stateFile);
      } catch (error) {
        // State file might not exist
      }

      this.log(`Rollback completed. Deleted ${deletedCount} historical rates.`);
    } catch (error) {
      this.log(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getStatus(): Promise<MigrationState> {
    await this.loadState();
    return { ...this.state };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';
  
  const executor = new MigrationExecutor({
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50'),
    maxRetries: parseInt(args.find(arg => arg.startsWith('--max-retries='))?.split('=')[1] || '3'),
    enableRollback: !args.includes('--no-rollback')
  });

  try {
    switch (command) {
      case 'migrate':
        await executor.executeMigration();
        break;
      
      case 'rollback':
        await executor.rollback();
        break;
      
      case 'status':
        const status = await executor.getStatus();
        console.log('Migration Status:', JSON.stringify(status, null, 2));
        break;
      
      default:
        console.log('Usage: tsx migrate-historical-rates.ts [migrate|rollback|status] [options]');
        console.log('Options:');
        console.log('  --batch-size=N     Number of expenses to process per batch (default: 50)');
        console.log('  --max-retries=N    Maximum retry attempts per expense (default: 3)');
        console.log('  --no-rollback      Disable rollback functionality');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { MigrationExecutor, type MigrationState, type MigrationConfig };