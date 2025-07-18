# Admin Setup and Historical Rates Management

This document explains how to set up admin users and use the administrative tools for historical rate management.

## Overview

The system now includes role-based access control with two user roles:
- **User** (default): Regular users who can manage their expenses
- **Admin**: Users with access to administrative tools for monitoring and managing historical rates

## Setting Up Admin Users

### 1. Database Migration

First, ensure the database schema includes the role field:

```bash
pnpm db:generate
```

### 2. Create Admin User

Use the provided script to create an admin user:

```bash
# Create a new admin user
pnpm create-admin admin@example.com mypassword123

# Or promote an existing user to admin
pnpm create-admin existing@user.com newpassword
```

The script will:
- Create a new user with admin role if the email doesn't exist
- Promote an existing user to admin role if they already exist
- Validate email format and password length

### 3. Login as Admin

1. Navigate to `/login`
2. Use the admin credentials you created
3. After login, you'll see an "Admin Panel" link in the navigation menu

## Admin Panel Features

The admin panel (`/admin`) provides comprehensive tools for managing historical rates:

### System Health Monitoring
- **Overall system status**: Healthy, Warning, or Critical
- **Conversion success rate**: Percentage of successful rate conversions
- **Historical rate usage**: How often historical vs current rates are used
- **Database connectivity**: Connection status and stored rates count
- **Response time monitoring**: Average response time for rate operations

### Conversion Metrics (24h)
- Total number of conversions
- Success rate percentage
- Historical rates used vs fallback rates used
- Average response time

### Expense Debug Tool
- **Debug specific expenses**: Enter expense ID to see detailed rate information
- **Manual rate save**: Trigger historical rate saving for specific expenses
- **View currency pairs**: See all available historical rates for an expense
- **Recent conversions**: Track recent rate conversion activity

### Bulk Operations
- **Find expenses without rates**: Identify expenses missing historical rates
- **Bulk rate save**: Process multiple expenses at once
- **Progress tracking**: Monitor bulk operation results

### Alerts and Monitoring
- **Fallback usage alerts**: Automatic alerts when too many conversions use current rates
- **System health checks**: Regular monitoring of all system components
- **Data cleanup**: Remove old monitoring data to prevent memory issues

## Security Features

### Role-Based Access Control
- Admin routes are protected by middleware that checks user roles
- Only users with `role: 'admin'` can access admin endpoints
- Unauthorized access attempts are logged and redirected

### Audit Logging
All admin operations are logged with:
- User identification
- Operation type and parameters
- Success/failure status
- Timestamps and duration
- Error details when applicable

## API Endpoints

Admin-only tRPC procedures:

```typescript
// System monitoring
trpc.admin.getSystemHealth.useQuery()
trpc.admin.getConversionMetrics.useQuery()
trpc.admin.getOperationStats.useQuery()

// Expense management
trpc.admin.getExpenseDebugInfo.useQuery({ expenseId })
trpc.admin.getExpenseHistoricalRates.useQuery({ expenseId })
trpc.admin.triggerRateSave.useMutation()
trpc.admin.deleteExpenseRates.useMutation()

// Bulk operations
trpc.admin.getExpensesWithoutRates.useQuery({ limit, offset })
trpc.admin.bulkTriggerRateSave.useMutation({ expenseIds })

// Alerts and cleanup
trpc.admin.checkFallbackAlerts.useQuery()
trpc.admin.cleanupMonitoringData.useMutation()
```

## Troubleshooting

### Common Issues

1. **"Admin access required" error**
   - Ensure user has `role: 'admin'` in database
   - Check that user is properly authenticated
   - Verify admin middleware is working

2. **Admin panel not showing**
   - Check user role in database
   - Clear browser cache and cookies
   - Verify navigation logic in Layout component

3. **Rate operations failing**
   - Check database connectivity
   - Verify exchange rate API is accessible
   - Review error logs in admin panel

### Database Queries

Check user roles:
```sql
SELECT id, email, role, created_at FROM users;
```

Promote user to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

Check historical rates:
```sql
SELECT COUNT(*) as total_rates FROM expense_exchange_rates;
```

## Best Practices

1. **Limit admin users**: Only create admin accounts for trusted users
2. **Regular monitoring**: Check system health regularly through admin panel
3. **Rate management**: Use bulk operations for efficiency when processing many expenses
4. **Data cleanup**: Periodically clean old monitoring data
5. **Security**: Monitor admin access logs and unauthorized attempts

## Migration Guide

If upgrading from a system without roles:

1. Run database migration to add role field
2. All existing users will have `role: 'user'` by default
3. Use `create-admin` script to promote necessary users
4. Test admin access before deploying to production

## Support

For issues with admin functionality:
1. Check system health in admin panel
2. Review application logs
3. Verify database schema and data
4. Test with a fresh admin user account