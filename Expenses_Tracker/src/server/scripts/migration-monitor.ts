#!/usr/bin/env tsx

import { MigrationExecutor, type MigrationState } from './migrate-historical-rates';
import fs from 'fs/promises';
import path from 'path';

interface MonitorConfig {
  refreshInterval: number;
  logFile: string;
  stateFile: string;
  showLogs: boolean;
}

class MigrationMonitor {
  private config: MonitorConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      refreshInterval: 5000, // 5 seconds
      logFile: path.join(process.cwd(), 'logs', 'migration.log'),
      stateFile: path.join(process.cwd(), 'logs', 'migration-state.json'),
      showLogs: false,
      ...config
    };
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('🔍 Migration Monitor Started');
    console.log('Press Ctrl+C to stop monitoring\n');

    while (this.isRunning) {
      try {
        await this.displayStatus();
        
        if (this.config.showLogs) {
          await this.displayRecentLogs();
        }
        
        await this.delay(this.config.refreshInterval);
      } catch (error) {
        console.error('Monitor error:', error);
        await this.delay(this.config.refreshInterval);
      }
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('\n👋 Migration Monitor Stopped');
  }

  private async displayStatus(): Promise<void> {
    try {
      const executor = new MigrationExecutor();
      const status = await executor.getStatus();
      
      // Clear screen and move cursor to top
      process.stdout.write('\x1b[2J\x1b[0f');
      
      console.log('📊 Historical Rates Migration Status');
      console.log('=====================================\n');
      
      // Status overview
      console.log(`Status: ${this.getStatusEmoji(status.status)} ${status.status.toUpperCase()}`);
      console.log(`Started: ${new Date(status.startTime).toLocaleString()}`);
      
      if (status.status === 'running') {
        const elapsed = Date.now() - status.startTime;
        console.log(`Elapsed: ${this.formatDuration(elapsed)}`);
        
        if (status.totalExpenses > 0) {
          const percentage = ((status.processedExpenses / status.totalExpenses) * 100).toFixed(2);
          const rate = status.processedExpenses / (elapsed / 1000);
          const eta = status.totalExpenses > status.processedExpenses 
            ? ((status.totalExpenses - status.processedExpenses) / rate) 
            : 0;
          
          console.log(`ETA: ${this.formatDuration(eta * 1000)}`);
          console.log(`Rate: ${rate.toFixed(2)} expenses/sec`);
        }
      } else if (status.status === 'completed') {
        console.log(`Duration: ${this.formatDuration(status.duration || 0)}`);
      }
      
      console.log();
      
      // Progress bar
      if (status.totalExpenses > 0) {
        const percentage = (status.processedExpenses / status.totalExpenses) * 100;
        const progressBar = this.createProgressBar(percentage, 40);
        console.log(`Progress: ${progressBar} ${percentage.toFixed(2)}%`);
        console.log(`Processed: ${status.processedExpenses}/${status.totalExpenses}`);
      }
      
      console.log();
      
      // Statistics
      console.log('📈 Statistics:');
      console.log(`  ✅ Migrated: ${status.migratedExpenses}`);
      console.log(`  ⏭️  Skipped: ${status.skippedExpenses}`);
      console.log(`  ❌ Errors: ${status.errors.length}`);
      console.log(`  🔄 Last ID: ${status.lastProcessedId}`);
      console.log(`  📦 Batch Size: ${status.batchSize}`);
      
      // Recent errors
      if (status.errors.length > 0) {
        console.log('\n🚨 Recent Errors:');
        const recentErrors = status.errors.slice(-3);
        recentErrors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
        
        if (status.errors.length > 3) {
          console.log(`  ... and ${status.errors.length - 3} more errors`);
        }
      }
      
      console.log(`\n🕐 Last updated: ${new Date().toLocaleTimeString()}`);
      
      if (this.config.showLogs) {
        console.log('\n📝 Recent Logs:');
      }
      
    } catch (error) {
      console.log('❌ Unable to read migration status');
      console.log('Migration may not be running or state file is missing');
    }
  }

  private async displayRecentLogs(): Promise<void> {
    try {
      const logContent = await fs.readFile(this.config.logFile, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());
      const recentLines = lines.slice(-10); // Show last 10 log entries
      
      recentLines.forEach(line => {
        console.log(`  ${line}`);
      });
    } catch (error) {
      console.log('  No logs available');
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'paused': return '⏸️';
      default: return '❓';
    }
  }

  private createProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const monitor = new MigrationMonitor({
    refreshInterval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '5000'),
    showLogs: args.includes('--show-logs')
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });

  try {
    await monitor.start();
  } catch (error) {
    console.error('Monitor failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Monitor script failed:", error);
    process.exit(1);
  });
}

export { MigrationMonitor };