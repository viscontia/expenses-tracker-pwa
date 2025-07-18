import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { MigrationExecutor, type MigrationConfig } from '../migrate-historical-rates';
import { db } from '~/server/db';
import fs from 'fs/promises';

// Mock the database
vi.mock('~/server/db', () => ({
  db: {
    expense: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    expenseExchangeRate: {
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    }
  }
}));

// Mock fs operations
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    unlink: vi.fn(),
  }
}));

describe('MigrationExecutor', () => {
  let executor: MigrationExecutor;
  let testConfig: Partial<MigrationConfig>;
  let mockExpenses: any[];

  beforeAll(() => {
    // Setup test data
    mockExpenses = [
      {
        id: 1,
        currency: 'USD',
        amount: 100,
        conversionRate: 0.85,
        date: new Date('2024-01-01'),
      },
      {
        id: 2,
        currency: 'GBP',
        amount: 50,
        conversionRate: 1.15,
        date: new Date('2024-01-02'),
      },
      {
        id: 3,
        currency: 'EUR',
        amount: 75,
        conversionRate: null,
        date: new Date('2024-01-03'),
      }
    ];
  });

  beforeEach(() => {
    testConfig = {
      batchSize: 2,
      maxRetries: 2,
      retryDelay: 100,
      progressReportInterval: 1,
      stateFile: 'test-migration-state.json',
      logFile: 'test-migration.log',
      enableRollback: true
    };

    executor = new MigrationExecutor(testConfig);

    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.readFile as any).mockRejectedValue(new Error('File not found'));
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.appendFile as any).mockResolvedValue(undefined);
    (fs.unlink as any).mockResolvedValue(undefined);
    
    (db.expense.count as any).mockResolvedValue(mockExpenses.length);
    (db.expense.findMany as any).mockImplementation((params: any) => {
      const startId = params?.where?.id?.gt || 0;
      const take = params?.take || mockExpenses.length;
      return Promise.resolve(
        mockExpenses
          .filter(e => e.id > startId)
          .slice(0, take)
      );
    });
    
    (db.expenseExchangeRate.count as any).mockResolvedValue(0);
    (db.expenseExchangeRate.createMany as any).mockResolvedValue({ count: 2 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      const defaultExecutor = new MigrationExecutor();
      await defaultExecutor.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    it('should load previous state if available', async () => {
      const savedState = {
        totalExpenses: 5,
        processedExpenses: 2,
        lastProcessedId: 2
      };
      
      (fs.readFile as any).mockResolvedValueOnce(JSON.stringify(savedState));
      
      await executor.initialize();
      const status = await executor.getStatus();
      
      expect(status.totalExpenses).toBe(5);
      expect(status.processedExpenses).toBe(2);
      expect(status.lastProcessedId).toBe(2);
    });

    it('should start fresh if no previous state exists', async () => {
      await executor.initialize();
      const status = await executor.getStatus();
      
      expect(status.totalExpenses).toBe(mockExpenses.length);
      expect(status.processedExpenses).toBe(0);
      expect(status.lastProcessedId).toBe(0);
    });
  });

  describe('batch processing', () => {
    it('should process expenses in batches', async () => {
      const result = await executor.executeMigration();
      
      expect(result.totalExpenses).toBe(mockExpenses.length);
      expect(result.migratedExpenses).toBe(2); // Only USD and GBP have conversion rates
      expect(result.skippedExpenses).toBe(1); // EUR has no conversion rate
      expect(db.expense.findMany).toHaveBeenCalledTimes(2); // Two batches
    });

    it('should handle batch processing with resume capability', async () => {
      // Simulate resuming from expense ID 1
      const savedState = {
        totalExpenses: mockExpenses.length,
        processedExpenses: 1,
        lastProcessedId: 1,
        migratedExpenses: 1,
        skippedExpenses: 0,
        errors: []
      };
      
      (fs.readFile as any).mockResolvedValueOnce(JSON.stringify(savedState));
      
      const result = await executor.executeMigration();
      
      expect(result.totalExpenses).toBe(mockExpenses.length);
      expect(db.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { gt: 1 } }
        })
      );
    });

    it('should save state after each batch', async () => {
      await executor.executeMigration();
      
      // Should save state multiple times (after each batch + final)
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-migration-state.json'),
        expect.stringContaining('"status"')
      );
    });
  });

  describe('error handling and retries', () => {
    it('should retry failed expenses up to maxRetries', async () => {
      // Make the first expense fail twice, then succeed
      let attemptCount = 0;
      (db.expenseExchangeRate.createMany as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Database error');
        }
        return Promise.resolve({ count: 2 });
      });
      
      const result = await executor.executeMigration();
      
      expect(attemptCount).toBe(3); // 2 failures + 1 success
      expect(result.errors.length).toBe(0);
    });

    it('should skip expenses that fail after maxRetries', async () => {
      // Make all database operations fail
      (db.expenseExchangeRate.createMany as any).mockRejectedValue(new Error('Persistent error'));
      
      const result = await executor.executeMigration();
      
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.skippedExpenses).toBeGreaterThan(0);
    });

    it('should handle migration failure gracefully', async () => {
      // Make expense count fail
      (db.expense.count as any).mockRejectedValue(new Error('Database connection error'));
      
      await expect(executor.executeMigration()).rejects.toThrow('Database connection error');
      
      const status = await executor.getStatus();
      expect(status.status).toBe('failed');
    });
  });

  describe('rollback functionality', () => {
    it('should rollback migration successfully', async () => {
      const mockExpensesWithRates = [
        { expenseId: 1, _count: { id: 5 } },
        { expenseId: 2, _count: { id: 3 } }
      ];
      
      (db.expenseExchangeRate.groupBy as any).mockResolvedValue(mockExpensesWithRates);
      (db.expenseExchangeRate.deleteMany as any).mockResolvedValue({ count: 8 });
      
      await executor.rollback();
      
      expect(db.expenseExchangeRate.deleteMany).toHaveBeenCalledWith({
        where: {
          expenseId: {
            in: [1, 2]
          }
        }
      });
      
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-migration-state.json')
      );
    });

    it('should throw error if rollback is disabled', async () => {
      const noRollbackExecutor = new MigrationExecutor({ enableRollback: false });
      
      await expect(noRollbackExecutor.rollback()).rejects.toThrow('Rollback is disabled');
    });

    it('should handle rollback errors gracefully', async () => {
      (db.expenseExchangeRate.groupBy as any).mockRejectedValue(new Error('Database error'));
      
      await expect(executor.rollback()).rejects.toThrow('Database error');
    });
  });

  describe('progress reporting', () => {
    it('should calculate progress correctly', async () => {
      const logSpy = vi.spyOn(executor as any, 'log').mockResolvedValue(undefined);
      
      await executor.executeMigration();
      
      // Should log progress reports
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress:')
      );
    });

    it('should calculate ETA correctly', async () => {
      const logSpy = vi.spyOn(executor as any, 'log').mockResolvedValue(undefined);
      
      // Mock a longer running migration
      (db.expense.count as any).mockResolvedValue(100);
      
      await executor.executeMigration();
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate:')
      );
    });
  });

  describe('state management', () => {
    it('should save and load state correctly', async () => {
      const testState = {
        totalExpenses: 10,
        processedExpenses: 5,
        migratedExpenses: 4,
        skippedExpenses: 1,
        errors: ['test error'],
        lastProcessedId: 5,
        status: 'running'
      };
      
      (fs.readFile as any).mockResolvedValueOnce(JSON.stringify(testState));
      
      await executor.initialize();
      const status = await executor.getStatus();
      
      expect(status.totalExpenses).toBe(testState.totalExpenses);
      expect(status.processedExpenses).toBe(testState.processedExpenses);
      expect(status.migratedExpenses).toBe(testState.migratedExpenses);
      expect(status.errors).toEqual(testState.errors);
    });

    it('should handle corrupted state file', async () => {
      (fs.readFile as any).mockResolvedValueOnce('invalid json');
      
      // Should not throw and should start fresh
      await executor.initialize();
      const status = await executor.getStatus();
      
      expect(status.processedExpenses).toBe(0);
    });
  });

  describe('expense migration logic', () => {
    it('should migrate expenses with existing conversion rates', async () => {
      const result = await executor.executeMigration();
      
      expect(db.expenseExchangeRate.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            fromCurrency: 'USD',
            toCurrency: 'EUR',
            rate: 0.85
          }),
          expect.objectContaining({
            fromCurrency: 'EUR',
            toCurrency: 'USD',
            rate: expect.closeTo(1.176, 2) // 1/0.85
          })
        ]),
        skipDuplicates: true
      });
    });

    it('should skip expenses that already have historical rates', async () => {
      // Mock that first expense already has rates
      (db.expenseExchangeRate.count as any)
        .mockResolvedValueOnce(5) // First expense has rates
        .mockResolvedValue(0); // Others don't
      
      const result = await executor.executeMigration();
      
      // Should process all expenses but skip the first one
      expect(result.totalExpenses).toBe(mockExpenses.length);
    });

    it('should handle expenses without conversion rates', async () => {
      // Test with EUR expense that has no conversion rate
      const eurOnlyExpenses = [mockExpenses[2]]; // EUR expense
      (db.expense.findMany as any).mockResolvedValue(eurOnlyExpenses);
      (db.expense.count as any).mockResolvedValue(1);
      
      const result = await executor.executeMigration();
      
      // Should process but not create any rates for EUR-only expense
      expect(result.totalExpenses).toBe(1);
    });
  });
});

describe('Integration Tests', () => {
  const integrationMockExpenses = [
    {
      id: 1,
      currency: 'USD',
      amount: 100,
      conversionRate: 0.85,
      date: new Date('2024-01-01'),
    },
    {
      id: 2,
      currency: 'GBP',
      amount: 50,
      conversionRate: 1.15,
      date: new Date('2024-01-02'),
    },
    {
      id: 3,
      currency: 'EUR',
      amount: 75,
      conversionRate: null,
      date: new Date('2024-01-03'),
    }
  ];

  describe('end-to-end migration flow', () => {
    it('should complete full migration cycle', async () => {
      const executor = new MigrationExecutor({
        batchSize: 1,
        maxRetries: 1,
        stateFile: 'integration-test-state.json',
        logFile: 'integration-test.log'
      });

      // Mock successful migration
      (db.expense.count as any).mockResolvedValue(2);
      (db.expense.findMany as any)
        .mockResolvedValueOnce([integrationMockExpenses[0]])
        .mockResolvedValueOnce([integrationMockExpenses[1]])
        .mockResolvedValueOnce([]);
      
      (db.expenseExchangeRate.count as any).mockResolvedValue(0);
      (db.expenseExchangeRate.createMany as any).mockResolvedValue({ count: 2 });
      
      const result = await executor.executeMigration();
      
      expect(result.totalExpenses).toBe(2);
      expect(result.migratedExpenses).toBe(2);
      expect(result.errors.length).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle resume after interruption', async () => {
      // First run - simulate interruption after processing 1 expense
      const executor1 = new MigrationExecutor({
        batchSize: 1,
        stateFile: 'resume-test-state.json'
      });

      const partialState = {
        totalExpenses: 3,
        processedExpenses: 1,
        migratedExpenses: 1,
        skippedExpenses: 0,
        errors: [],
        lastProcessedId: 1,
        status: 'running'
      };

      (fs.readFile as any).mockResolvedValueOnce(JSON.stringify(partialState));
      (db.expense.findMany as any)
        .mockResolvedValueOnce([integrationMockExpenses[1]]) // Resume from ID 1
        .mockResolvedValueOnce([integrationMockExpenses[2]])
        .mockResolvedValueOnce([]);

      await executor1.executeMigration();
      
      // Verify the migration completed successfully
      expect(db.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { gt: 1 } }
        })
      );
    });
  });
});
describe
('Additional Migration Tests', () => {
  let executor: MigrationExecutor;
  const mockDb = vi.mocked(db);
  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    executor = new MigrationExecutor({
      batchSize: 2,
      maxRetries: 2,
      retryDelay: 10,
      progressReportInterval: 1,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logging functionality', () => {
    it('should log messages to file and console', async () => {
      mockFs.appendFile.mockResolvedValue(undefined);

      await (executor as any).log('Test message');

      expect(console.log).toHaveBeenCalledWith('Test message');
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('migration.log'),
        expect.stringContaining('Test message')
      );
    });

    it('should handle log file write errors', async () => {
      mockFs.appendFile.mockRejectedValue(new Error('Write failed'));

      await (executor as any).log('Test message');

      expect(console.error).toHaveBeenCalledWith(
        'Failed to write to log file:',
        expect.any(Error)
      );
    });

    it('should include timestamp in log messages', async () => {
      mockFs.appendFile.mockResolvedValue(undefined);

      await (executor as any).log('Test message');

      expect(mockFs.appendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] Test message\n/)
      );
    });
  });

  describe('delay utility', () => {
    it('should delay execution for specified time', async () => {
      const startTime = Date.now();
      await (executor as any).delay(50);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty expense database', async () => {
      mockDb.expense.count.mockResolvedValue(0);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('No state file'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.appendFile.mockResolvedValue(undefined);
      mockDb.expense.findMany.mockResolvedValue([]);

      const result = await executor.executeMigration();

      expect(result).toEqual({
        totalExpenses: 0,
        migratedExpenses: 0,
        skippedExpenses: 0,
        errors: [],
        duration: expect.any(Number),
      });
    });

    it('should handle database connection failures during migration', async () => {
      mockDb.expense.count.mockResolvedValue(10);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('No state file'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.appendFile.mockResolvedValue(undefined);
      
      // First batch succeeds, second batch fails with connection error
      mockDb.expense.findMany
        .mockResolvedValueOnce([{ id: 1, amount: 100, currency: 'USD', conversionRate: 1.2 }])
        .mockRejectedValueOnce(new Error('Connection lost'));

      mockDb.expenseExchangeRate.count.mockResolvedValue(0);
      mockDb.expenseExchangeRate.createMany.mockResolvedValue({ count: 2 });

      await expect(executor.executeMigration()).rejects.toThrow('Connection lost');
    });

    it('should handle corrupted state file', async () => {
      mockDb.expense.count.mockResolvedValue(10);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('invalid json{');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.appendFile.mockResolvedValue(undefined);

      await (executor as any).initialize();

      // Should fall back to default state when JSON parsing fails
      expect(console.log).toHaveBeenCalledWith(
        'No previous migration state found. Starting fresh migration.'
      );
    });

    it('should handle file system permission errors', async () => {
      mockDb.expense.count.mockResolvedValue(10);
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));
      mockFs.readFile.mockRejectedValue(new Error('No state file'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.appendFile.mockResolvedValue(undefined);

      // Should continue even if directory creation fails
      await (executor as any).initialize();

      expect(mockDb.expense.count).toHaveBeenCalled();
    });
  });

  describe('rollback edge cases', () => {
    it('should process rollback in batches', async () => {
      // Create 250 expenses with rates (more than batch size of 100)
      const mockExpensesWithRates = Array.from({ length: 250 }, (_, i) => ({
        expenseId: i + 1,
        _count: { id: 2 },
      }));

      mockFs.appendFile.mockResolvedValue(undefined);
      mockDb.expenseExchangeRate.groupBy.mockResolvedValue(mockExpensesWithRates);
      mockDb.expenseExchangeRate.deleteMany.mockResolvedValue({ count: 100 });
      mockFs.unlink.mockResolvedValue(undefined);

      await executor.rollback();

      // Should be called 3 times (100 + 100 + 50)
      expect(mockDb.expenseExchangeRate.deleteMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('progress reporting edge cases', () => {
    it('should handle zero processing rate', async () => {
      (executor as any).state = {
        startTime: Date.now(), // Just started
        totalExpenses: 100,
        processedExpenses: 0,
        migratedExpenses: 0,
        skippedExpenses: 0,
        errors: [],
      };

      mockFs.appendFile.mockResolvedValue(undefined);

      await (executor as any).reportProgress();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 0/100 (0.00%)')
      );
    });
  });
});