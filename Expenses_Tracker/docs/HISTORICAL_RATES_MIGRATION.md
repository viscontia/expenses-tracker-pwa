# Historical Rates Migration System

This document describes the migration system for implementing historical currency conversion rates in the Expenses Tracker application.

## Overview

The migration system provides a robust, production-ready solution for migrating existing expenses to use historical exchange rates. It includes batch processing, progress monitoring, resume capability, and rollback functionality.

## Components

### 1. Migration Executor (`migrate-historical-rates.ts`)

The main migration script that handles the actual data migration process.

**Features:**
- Batch processing for efficient handling of large datasets
- Automatic retry mechanism for failed operations
- Resume capability for interrupted migrations
- Progress reporting and state persistence
- Rollback functionality
- Comprehensive error handling and logging

**Usage:**
```bash
# Run migration
pnpm migrate-historical

# Check migration status
pnpm migrate-status

# Rollback migration
pnpm migrate-rollback

# Custom batch size and retry settings
tsx src/server/scripts/migrate-historical-rates.ts migrate --batch-size=100 --max-retries=5
```

### 2. Migration Monitor (`migration-monitor.ts`)

A real-time monitoring dashboard for tracking migration progress.

**Features:**
- Real-time progress visualization
- Performance metrics (rate, ETA)
- Error reporting
- Recent logs display
- Automatic refresh

**Usage:**
```bash
# Start monitoring
pnpm migrate-monitor

# Monitor with logs
tsx src/server/scripts/migration-monitor.ts --show-logs

# Custom refresh interval
tsx src/server/scripts/migration-monitor.ts --interval=3000
```

## Migration Process

### Phase 1: Preparation
1. **Database Schema**: Ensure `expense_exchange_rates` table exists
2. **Backup**: Create database backup before migration
3. **Configuration**: Set appropriate batch size and retry limits

### Phase 2: Execution
1. **Initialization**: Load previous state or start fresh
2. **Batch Processing**: Process expenses in configurable batches
3. **Rate Migration**: For each expense:
   - Use existing `conversionRate` field as primary source
   - Find closest historical rates from `exchange_rates` table
   - Fallback to current API rates if needed
4. **State Persistence**: Save progress after each batch
5. **Error Handling**: Retry failed operations with exponential backoff

### Phase 3: Monitoring
1. **Progress Tracking**: Real-time progress visualization
2. **Performance Metrics**: Processing rate and ETA calculation
3. **Error Reporting**: Detailed error logs and statistics
4. **Health Checks**: Monitor system resources and database performance

## Configuration Options

### Migration Executor Options

| Option | Default | Description |
|--------|---------|-------------|
| `batchSize` | 50 | Number of expenses to process per batch |
| `maxRetries` | 3 | Maximum retry attempts per expense |
| `retryDelay` | 1000ms | Delay between retry attempts |
| `progressReportInterval` | 10 | Report progress every N expenses |
| `enableRollback` | true | Enable rollback functionality |

### Monitor Options

| Option | Default | Description |
|--------|---------|-------------|
| `refreshInterval` | 5000ms | Dashboard refresh interval |
| `showLogs` | false | Display recent log entries |

## State Management

The migration system maintains persistent state in JSON files:

### State File Structure
```json
{
  "startTime": 1640995200000,
  "totalExpenses": 1000,
  "processedExpenses": 450,
  "migratedExpenses": 420,
  "skippedExpenses": 30,
  "errors": ["Expense 123: API timeout", "..."],
  "lastProcessedId": 456,
  "batchSize": 50,
  "status": "running"
}
```

### Log File Format
```
[2024-01-01T10:00:00.000Z] Migration initialized. Total expenses: 1000
[2024-01-01T10:00:01.000Z] Processing batch of 50 expenses...
[2024-01-01T10:00:02.000Z] Progress: 50/1000 (5.00%)
```

## Error Handling

### Retry Strategy
1. **Transient Errors**: Automatic retry with exponential backoff
2. **Permanent Errors**: Skip expense and log error
3. **Critical Errors**: Stop migration and report failure

### Error Categories
- **Database Errors**: Connection issues, constraint violations
- **API Errors**: Rate limiting, service unavailable
- **Data Errors**: Invalid currency codes, missing data
- **System Errors**: Memory issues, disk space

### Recovery Procedures
1. **Resume Migration**: Restart from last processed expense
2. **Partial Rollback**: Remove rates for specific expense ranges
3. **Full Rollback**: Remove all migrated historical rates
4. **Manual Intervention**: Fix data issues and resume

## Performance Considerations

### Optimization Strategies
1. **Batch Size Tuning**: Balance memory usage vs. transaction overhead
2. **Connection Pooling**: Optimize database connection usage
3. **Index Usage**: Ensure proper indexes for query performance
4. **Memory Management**: Monitor memory usage during large migrations

### Performance Metrics
- **Processing Rate**: Expenses processed per second
- **Database Performance**: Query execution times
- **Memory Usage**: Peak memory consumption
- **Error Rate**: Percentage of failed operations

## Safety Features

### Data Integrity
- **Transaction Safety**: Use database transactions for atomic operations
- **Duplicate Prevention**: Skip expenses that already have historical rates
- **Validation**: Verify data consistency before and after migration
- **Backup Verification**: Ensure backups are valid before starting

### Rollback Capability
- **Complete Rollback**: Remove all historical rates
- **Partial Rollback**: Remove rates for specific date ranges
- **State Cleanup**: Remove migration state files
- **Verification**: Verify system state after rollback

## Monitoring and Alerting

### Key Metrics to Monitor
- **Migration Progress**: Percentage completed
- **Processing Rate**: Expenses per second
- **Error Rate**: Failed operations percentage
- **System Resources**: CPU, memory, disk usage
- **Database Performance**: Connection pool, query times

### Alert Conditions
- **High Error Rate**: > 5% of operations failing
- **Slow Progress**: Processing rate below threshold
- **System Resources**: High CPU/memory usage
- **Database Issues**: Connection pool exhaustion

## Troubleshooting

### Common Issues

#### Migration Stuck
**Symptoms**: No progress for extended period
**Causes**: Database locks, API rate limiting, system resources
**Solutions**: 
- Check database locks: `SHOW PROCESSLIST`
- Verify API rate limits
- Monitor system resources
- Restart with smaller batch size

#### High Error Rate
**Symptoms**: Many expenses failing to migrate
**Causes**: Data quality issues, API problems, database constraints
**Solutions**:
- Review error logs for patterns
- Check data quality for problematic expenses
- Verify API connectivity and rate limits
- Consider manual data cleanup

#### Memory Issues
**Symptoms**: Out of memory errors, slow performance
**Causes**: Large batch sizes, memory leaks, insufficient system memory
**Solutions**:
- Reduce batch size
- Restart migration process
- Increase system memory
- Monitor memory usage patterns

### Diagnostic Commands

```bash
# Check migration status
pnpm migrate-status

# Monitor in real-time
pnpm migrate-monitor --show-logs

# Check database state
psql -c "SELECT COUNT(*) FROM expense_exchange_rates;"

# Check log files
tail -f logs/migration.log

# System resources
top -p $(pgrep -f migrate-historical-rates)
```

## Testing

### Unit Tests
Run comprehensive unit tests for migration logic:
```bash
pnpm test src/server/scripts/__tests__/migrate-historical-rates.test.ts
```

### Integration Tests
Test complete migration workflow:
```bash
# Run all migration tests
pnpm test migrate-historical-rates

# Run specific test suites
pnpm test --run --reporter=verbose migrate-historical-rates.test.ts
```

### Load Testing
Test migration performance with large datasets:
```bash
# Create test data
tsx src/server/scripts/create-test-data.ts --count=10000

# Run migration with monitoring
pnpm migrate-historical --batch-size=100 &
pnpm migrate-monitor
```

## Production Deployment

### Pre-Migration Checklist
- [ ] Database backup completed and verified
- [ ] Migration scripts tested in staging environment
- [ ] System resources verified (CPU, memory, disk)
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures tested
- [ ] Maintenance window scheduled

### Migration Execution
1. **Start Monitoring**: Begin monitoring before migration
2. **Execute Migration**: Run with appropriate batch size
3. **Monitor Progress**: Watch for errors and performance issues
4. **Verify Results**: Check data integrity after completion
5. **Update Documentation**: Record migration results and lessons learned

### Post-Migration Verification
```bash
# Verify migration completeness
tsx src/server/scripts/verify-migration.ts

# Check data integrity
tsx src/server/scripts/validate-historical-rates.ts

# Performance testing
tsx src/server/scripts/test-conversion-performance.ts
```

## Support and Maintenance

### Log Retention
- **Migration Logs**: Keep for 90 days
- **Error Logs**: Keep for 1 year
- **State Files**: Archive after successful completion

### Regular Maintenance
- **Log Rotation**: Implement log rotation for large migrations
- **State Cleanup**: Remove old state files periodically
- **Performance Monitoring**: Regular performance reviews
- **Documentation Updates**: Keep documentation current

### Emergency Procedures
- **Migration Failure**: Stop migration, assess damage, plan recovery
- **Data Corruption**: Restore from backup, investigate root cause
- **System Outage**: Graceful shutdown, resume after recovery
- **Rollback Required**: Execute rollback procedures, verify system state

## Contact Information

For issues or questions regarding the migration system:
- **Development Team**: [team-email]
- **Database Team**: [db-team-email]
- **Operations Team**: [ops-team-email]
- **Emergency Contact**: [emergency-contact]