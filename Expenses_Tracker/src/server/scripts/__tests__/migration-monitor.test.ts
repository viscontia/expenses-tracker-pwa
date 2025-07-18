import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationMonitor } from '../migration-monitor';
import { MigrationExecutor } from '../migrate-historical-rates';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock MigrationExecutor
vi.mock('../migrate-historical-rates', () => ({
  MigrationExecutor: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn(),
  })),
}));

describe('MigrationMonitor', () => {
  let monitor: MigrationMonitor;
  const mockFs = vi.mocked(fs);
  const mockExecutor = vi.mocked(MigrationExecutor);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    
    monitor = new MigrationMonitor({
      refreshInterval: 100, // Fast refresh for testing
      showLogs: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultMonitor = new MigrationMonitor();
      expect(defaultMonitor).toBeInstanceOf(MigrationMonitor);
    });

    it('should accept custom config', () => {
      const customMonitor = new MigrationMonitor({
        refreshInterval: 10000,
        showLogs: true,
      });
      expect(customMonitor).toBeInstanceOf(MigrationMonitor);
    });
  });

  describe('displayStatus', () => {
    it('should display running migration status', async () => {
      const mockStatus = {
        status: 'running' as const,
        startTime: Date.now() - 60000, // 1 minute ago
        totalExpenses: 100,
        processedExpenses: 50,
        migratedExpenses: 45,
        skippedExpenses: 5,
        errors: ['Error 1', 'Error 2'],
        lastProcessedId: 50,
        batchSize: 10,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      // Access private method for testing
      await (monitor as any).displayStatus();

      expect(mockExecutorInstance.getStatus).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Historical Rates Migration Status')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Status: 🔄 RUNNING')
      );
    });

    it('should display completed migration status', async () => {
      const mockStatus = {
        status: 'completed' as const,
        startTime: Date.now() - 120000, // 2 minutes ago
        duration: 120000,
        totalExpenses: 100,
        processedExpenses: 100,
        migratedExpenses: 95,
        skippedExpenses: 5,
        errors: [],
        lastProcessedId: 100,
        batchSize: 10,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Status: ✅ COMPLETED')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Duration:')
      );
    });

    it('should display failed migration status', async () => {
      const mockStatus = {
        status: 'failed' as const,
        startTime: Date.now() - 60000,
        totalExpenses: 100,
        processedExpenses: 30,
        migratedExpenses: 25,
        skippedExpenses: 5,
        errors: ['Critical error occurred'],
        lastProcessedId: 30,
        batchSize: 10,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Status: ❌ FAILED')
      );
    });

    it('should handle status retrieval errors', async () => {
      const mockExecutorInstance = {
        getStatus: vi.fn().mockRejectedValue(new Error('Status unavailable')),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      expect(console.log).toHaveBeenCalledWith(
        '❌ Unable to read migration status'
      );
    });

    it('should display recent errors when present', async () => {
      const mockStatus = {
        status: 'running' as const,
        startTime: Date.now(),
        totalExpenses: 100,
        processedExpenses: 50,
        migratedExpenses: 45,
        skippedExpenses: 5,
        errors: [
          'Error 1: Database timeout',
          'Error 2: API unavailable',
          'Error 3: Invalid currency',
          'Error 4: Network error',
          'Error 5: Rate not found',
        ],
        lastProcessedId: 50,
        batchSize: 10,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      expect(console.log).toHaveBeenCalledWith('\n🚨 Recent Errors:');
      expect(console.log).toHaveBeenCalledWith('  ... and 2 more errors');
    });

    it('should calculate and display progress correctly', async () => {
      const mockStatus = {
        status: 'running' as const,
        startTime: Date.now() - 30000, // 30 seconds ago
        totalExpenses: 200,
        processedExpenses: 75,
        migratedExpenses: 70,
        skippedExpenses: 5,
        errors: [],
        lastProcessedId: 75,
        batchSize: 25,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      // Should display 37.50% progress (75/200)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('37.50%')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Processed: 75/200')
      );
    });
  });

  describe('displayRecentLogs', () => {
    it('should display recent log entries', async () => {
      const mockLogContent = `
[2024-01-15T10:00:00.000Z] Migration started
[2024-01-15T10:01:00.000Z] Processing batch 1
[2024-01-15T10:02:00.000Z] Migrated expense 1
[2024-01-15T10:03:00.000Z] Migrated expense 2
[2024-01-15T10:04:00.000Z] Processing batch 2
      `.trim();

      mockFs.readFile.mockResolvedValue(mockLogContent);

      await (monitor as any).displayRecentLogs();

      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('migration.log'),
        'utf-8'
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Migration started')
      );
    });

    it('should handle missing log file', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await (monitor as any).displayRecentLogs();

      expect(console.log).toHaveBeenCalledWith('  No logs available');
    });

    it('should limit to recent log entries', async () => {
      // Create 15 log entries
      const logLines = Array.from({ length: 15 }, (_, i) => 
        `[2024-01-15T10:${i.toString().padStart(2, '0')}:00.000Z] Log entry ${i + 1}`
      );
      const mockLogContent = logLines.join('\n');

      mockFs.readFile.mockResolvedValue(mockLogContent);

      const consoleSpy = vi.spyOn(console, 'log');
      await (monitor as any).displayRecentLogs();

      // Should only display last 10 entries (plus any other console.log calls)
      const logCalls = consoleSpy.mock.calls.filter(call => 
        call[0] && call[0].includes('Log entry')
      );
      expect(logCalls.length).toBe(10);
      
      // Should include the last entry
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Log entry 15')
      );
    });
  });

  describe('utility methods', () => {
    it('should format duration correctly', () => {
      const formatDuration = (monitor as any).formatDuration;

      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(3665000)).toBe('1h 1m 5s');
      expect(formatDuration(500)).toBe('0s');
    });

    it('should create progress bar correctly', () => {
      const createProgressBar = (monitor as any).createProgressBar;

      expect(createProgressBar(0, 10)).toBe('░░░░░░░░░░');
      expect(createProgressBar(50, 10)).toBe('█████░░░░░');
      expect(createProgressBar(100, 10)).toBe('██████████');
      expect(createProgressBar(25, 4)).toBe('█░░░');
    });

    it('should return correct status emoji', () => {
      const getStatusEmoji = (monitor as any).getStatusEmoji;

      expect(getStatusEmoji('running')).toBe('🔄');
      expect(getStatusEmoji('completed')).toBe('✅');
      expect(getStatusEmoji('failed')).toBe('❌');
      expect(getStatusEmoji('paused')).toBe('⏸️');
      expect(getStatusEmoji('unknown')).toBe('❓');
    });
  });

  describe('start and stop', () => {
    it('should start monitoring loop', async () => {
      const mockStatus = {
        status: 'completed' as const,
        startTime: Date.now(),
        totalExpenses: 0,
        processedExpenses: 0,
        migratedExpenses: 0,
        skippedExpenses: 0,
        errors: [],
        lastProcessedId: 0,
        batchSize: 10,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      // Start monitoring and stop it immediately
      const startPromise = monitor.start();
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 50));
      
      monitor.stop();
      
      // Wait for the monitoring loop to finish
      await startPromise;

      expect(mockExecutorInstance.getStatus).toHaveBeenCalled();
    });

    it('should handle errors in monitoring loop', async () => {
      const mockExecutorInstance = {
        getStatus: vi.fn().mockRejectedValue(new Error('Status error')),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      // Start monitoring and stop it quickly
      const startPromise = monitor.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      monitor.stop();
      
      await startPromise;

      expect(console.error).toHaveBeenCalledWith(
        'Monitor error:',
        expect.any(Error)
      );
    });

    it('should stop monitoring when requested', () => {
      expect((monitor as any).isRunning).toBe(false);
      
      // Simulate starting
      (monitor as any).isRunning = true;
      expect((monitor as any).isRunning).toBe(true);
      
      monitor.stop();
      expect((monitor as any).isRunning).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid status changes', async () => {
      const statuses = [
        { status: 'running' as const, processedExpenses: 10 },
        { status: 'running' as const, processedExpenses: 20 },
        { status: 'completed' as const, processedExpenses: 30 },
      ];

      let callCount = 0;
      const mockExecutorInstance = {
        getStatus: vi.fn().mockImplementation(() => {
          const status = {
            startTime: Date.now(),
            totalExpenses: 30,
            migratedExpenses: statuses[callCount]?.processedExpenses || 0,
            skippedExpenses: 0,
            errors: [],
            lastProcessedId: statuses[callCount]?.processedExpenses || 0,
            batchSize: 10,
            ...statuses[callCount],
          };
          callCount++;
          return Promise.resolve(status);
        }),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      // Call displayStatus multiple times
      await (monitor as any).displayStatus();
      await (monitor as any).displayStatus();
      await (monitor as any).displayStatus();

      expect(mockExecutorInstance.getStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle large error lists', async () => {
      const errors = Array.from({ length: 100 }, (_, i) => `Error ${i + 1}`);
      const mockStatus = {
        status: 'running' as const,
        startTime: Date.now(),
        totalExpenses: 1000,
        processedExpenses: 500,
        migratedExpenses: 400,
        skippedExpenses: 100,
        errors,
        lastProcessedId: 500,
        batchSize: 50,
      };

      const mockExecutorInstance = {
        getStatus: vi.fn().mockResolvedValue(mockStatus),
      };
      mockExecutor.mockImplementation(() => mockExecutorInstance as any);

      await (monitor as any).displayStatus();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('... and 97 more errors')
      );
    });
  });
});