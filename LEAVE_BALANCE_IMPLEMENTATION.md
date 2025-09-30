# Manual Leave Balance System Implementation

This document describes the manual leave balance system that is managed by HR once a year.

## Leave Balance Policy

### Manual Allocation by HR
- **HR manages all leave allocations**: Leave balances are set manually by HR once per year
- **No automatic calculations**: The system does not automatically calculate or credit leaves based on tenure
- **Contact HR for adjustments**: Employees must contact HR for any balance adjustments or questions

### Leave Application Rules
- **Applications always allowed**: Employees can apply for leave regardless of tenure or balance
- **Approval required**: All leave applications require manager/HR approval
- **Balance tracking**: System tracks usage when leaves are approved/rejected

### Balance Management
- **Manual allocation only**: HR sets leave allocations manually once a year
- **Usage tracking**: System automatically tracks used leaves when applications are approved
- **No automatic resets**: HR handles any balance resets or carry-forwards manually

## Database Changes

### Migration Files
1. **`20250905000002_remove_automatic_leave_allocation.sql`**
   - Removes all automatic leave allocation triggers and scheduled jobs
   - Drops automatic maintenance functions and calculations
   - Simplifies leave_balances table (removes auto-calculation columns)
   - Updates system to manual-only allocation approach

### Remaining Database Functions

#### Essential Functions (Kept)
- `get_tenure_months(joining_date)` - Calculates tenure in months (for display purposes)
- `recalculate_user_leave_balance(user_id)` - Returns current balance information (no auto-calculation)
- `get_user_leave_summary(user_id)` - Comprehensive balance info for display
- `update_leave_balance_on_status_change()` - Simplified to only track usage, no auto-creation

#### Removed Functions
- All automatic maintenance and scheduling functions
- Automatic balance calculation and crediting functions
- pg_cron scheduled jobs and related functions

### HR Management Tools
- Manual balance adjustment through LeaveManagement interface
- Create new leave balances for employees
- View and monitor all employee balances
- Track balance adjustment history

## API Changes

### Updated API Endpoints
```typescript
// Get comprehensive leave summary for a user (simplified)
leaveApi.getUserLeaveSummary(userId: string)

// Get current balance information (no auto-calculation)
leaveApi.recalculateUserBalance(userId: string)

// Removed: triggerLeaveMaintenence() - automatic maintenance removed
```

### HR Management API
```typescript
// Get all employees' leave balances
leaveApi.getAllEmployeesLeaveBalances(year?: number)

// Adjust leave balance manually
leaveApi.adjustLeaveBalance(userId: string, adjustment: object)

// Create new leave balance for employee
leaveApi.createLeaveBalance(userData: object)
```

## Frontend Changes

### Enhanced Leave Balance Display
- Real-time tenure and monthly rate information
- Carry-forward status and anniversary reset dates
- Visual indicators for negative balances
- Manual balance recalculation button

### Improved Leave Application
- Validation based on tenure eligibility
- Warning for negative balance (salary deduction)
- Enhanced error messages with context

### Leave Rules Information
- Clear display of leave entitlement rules
- User-specific status and eligibility
- Anniversary date warnings for < 2 years tenure

## How to Deploy

### 1. Run Database Migrations
```bash
# Apply the migrations in order
supabase db reset  # Only if starting fresh
# Or apply specific migrations:
# The migrations will run automatically when you deploy
```

### 2. Verify Scheduled Jobs
```sql
-- Check if pg_cron is enabled and job is scheduled
SELECT * FROM cron.job;

-- If needed, manually schedule the job:
SELECT cron.schedule(
  'leave-balance-maintenance',
  '0 2 * * *', -- Every day at 2 AM
  'SELECT maintain_leave_balances();'
);
```

### 3. Initialize Existing Users (if needed)
```sql
-- The migration automatically initializes balances
-- But you can manually trigger for specific users:
SELECT recalculate_user_leave_balance('user-id-here');

-- Or for all users:
SELECT manual_leave_maintenance();
```

## Testing the System

### 1. Test Tenure Calculations
```sql
-- Test different tenure scenarios
SELECT 
  'Test User' as name,
  '2023-01-15'::date as joining_date,
  get_tenure_months('2023-01-15'::date) as tenure_months,
  get_monthly_leave_rate('2023-01-15'::date) as monthly_rate,
  can_carry_forward_leaves('2023-01-15'::date) as can_carry_forward;
```

### 2. Test Balance Calculations
```sql
-- Get detailed balance for a user
SELECT get_user_leave_summary('user-id-here');

-- Recalculate balance for a user
SELECT recalculate_user_leave_balance('user-id-here');
```

### 3. Test Leave Application Flow
1. Apply for leave through the frontend
2. Approve the leave (if you have admin access)
3. Verify that `used_days` increases and `remaining_days` decreases
4. Test negative balance scenarios

### 4. Test Monthly Credit (Manual)
```sql
-- Manually run monthly credit
SELECT credit_monthly_leaves();

-- Check the results
SELECT * FROM leave_balance_summary ORDER BY full_name;
```

## Monitoring and Maintenance

### Check System Status
```sql
-- View all user balances
SELECT * FROM leave_balance_summary;

-- Check recent maintenance logs
-- (Logs are output via RAISE NOTICE, check your database logs)

-- Get specific user's comprehensive info
SELECT get_user_leave_summary('user-id-here');
```

### Manual Operations (HR/Admin)
```sql
-- Manually trigger all maintenance operations
SELECT manual_leave_maintenance();

-- Recalculate specific user's balance
SELECT recalculate_user_leave_balance('user-id-here');

-- Check scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'leave-balance-maintenance';
```

## Troubleshooting

### Common Issues

1. **Balances not updating automatically**
   - Check if pg_cron extension is enabled
   - Verify the scheduled job exists
   - Check database logs for errors

2. **Incorrect tenure calculations**
   - Verify `date_of_joining` is set correctly for users
   - Run manual recalculation for affected users

3. **Missing leave types**
   - Ensure "Annual Leave" type exists in `leave_types` table
   - All balance calculations are based on this leave type

### Manual Fixes
```sql
-- Fix missing joining dates
UPDATE users SET date_of_joining = '2023-01-15' WHERE id = 'user-id' AND date_of_joining IS NULL;

-- Recalculate after fixing data
SELECT recalculate_user_leave_balance('user-id');

-- Reset a user's balance completely
DELETE FROM leave_balances WHERE user_id = 'user-id' AND year = 2025;
SELECT update_user_leave_balance('user-id');
```

## Security Considerations

- Only HR and admin users can view all balances via `leave_balance_summary`
- Regular users can only see their own balance information
- Manual maintenance functions should be restricted to admin users
- All balance changes are logged with timestamps

## Performance Notes

- The system uses computed columns for `remaining_days` (calculated as `allocated_days - used_days`)
- Indexes are created on commonly queried fields like `date_of_joining`
- The scheduler runs daily but only performs intensive operations monthly/yearly
- Balance calculations are optimized to avoid unnecessary recalculations

## Future Enhancements

1. **Email Notifications**
   - Notify users when leaves are credited
   - Alert users approaching anniversary reset
   - Remind about unused leaves

2. **Advanced Reporting**
   - Leave utilization analytics
   - Trend analysis by department
   - Predictive balance forecasting

3. **Integration with Payroll**
   - Automatic salary deduction calculation
   - Export negative balance data for payroll processing

4. **Holiday Calendar Integration**
   - Consider public holidays in leave calculations
   - Regional holiday support

## Support

For issues or questions about the leave balance system:
1. Check the database logs for error messages
2. Use the troubleshooting SQL queries above
3. Contact the development team with specific error details
