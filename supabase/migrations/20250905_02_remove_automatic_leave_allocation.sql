-- Remove Automatic Leave Allocation System
-- This migration removes all automatic leave balance triggers, scheduled jobs,
-- and related functionality. HR will handle leave allocation manually once a year.

-- ========================================
-- 1. REMOVE SCHEDULED JOBS (pg_cron)
-- ========================================

-- Remove the scheduled maintenance job if it exists
SELECT cron.unschedule('leave-balance-maintenance') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'leave-balance-maintenance'
);

-- ========================================
-- 2. DROP TRIGGERS
-- ========================================

-- Drop the automatic leave balance update trigger
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

-- Keep the withdrawal balance restoration trigger as it's still needed
-- (trigger_restore_balance_on_withdrawal remains active)

-- ========================================
-- 3. DROP AUTOMATIC MAINTENANCE FUNCTIONS
-- ========================================

-- Drop all the automatic maintenance and scheduling functions
DROP FUNCTION IF EXISTS maintain_leave_balances();
DROP FUNCTION IF EXISTS credit_monthly_leaves();
DROP FUNCTION IF EXISTS process_anniversary_resets();
DROP FUNCTION IF EXISTS process_anniversary_actions();
DROP FUNCTION IF EXISTS process_year_end_carry_forward();
DROP FUNCTION IF EXISTS manual_leave_maintenance();

-- Drop automatic balance calculation functions
DROP FUNCTION IF EXISTS update_user_leave_balance(uuid, integer);
DROP FUNCTION IF EXISTS update_user_leave_balance(uuid);

-- ========================================
-- 4. REMOVE AUTOMATIC CALCULATION FUNCTIONS
-- ========================================

-- Drop the automatic tenure and rate calculation functions
DROP FUNCTION IF EXISTS get_monthly_leave_rate(date);
DROP FUNCTION IF EXISTS can_carry_forward_leaves(date);
DROP FUNCTION IF EXISTS get_next_anniversary_date(date);
DROP FUNCTION IF EXISTS is_anniversary_today(date);

-- Keep get_tenure_months() as it might still be useful for display purposes
-- DROP FUNCTION IF EXISTS get_tenure_months(date); -- Commented out to keep

-- ========================================
-- 5. SIMPLIFY LEAVE_BALANCES TABLE
-- ========================================

-- Remove automatic calculation columns that are no longer needed
ALTER TABLE leave_balances DROP COLUMN IF EXISTS monthly_credit_rate;
ALTER TABLE leave_balances DROP COLUMN IF EXISTS last_credited_month;
ALTER TABLE leave_balances DROP COLUMN IF EXISTS carry_forward_from_previous_year;
ALTER TABLE leave_balances DROP COLUMN IF EXISTS anniversary_reset_date;

-- ========================================
-- 6. UPDATE LEAVE BALANCE UPDATE FUNCTION
-- ========================================

-- Create a simplified manual-only leave balance update function for HR use
CREATE OR REPLACE FUNCTION update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  days_difference integer;
BEGIN
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_difference := 0;
    
    -- If changing from approved to something else, add days back
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      days_difference := -NEW.days_count;
    -- If changing to approved from something else, subtract days
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      days_difference := NEW.days_count;
    END IF;
    
    -- Update the leave balance if there's a change
    IF days_difference != 0 THEN
      -- Only update if a balance record exists (no auto-creation)
      UPDATE leave_balances SET
        used_days = used_days + days_difference,
        updated_at = now()
      WHERE user_id = NEW.user_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = EXTRACT(YEAR FROM NEW.start_date);
      
      -- If no balance record exists, do nothing (HR must create manually)
      -- This prevents automatic balance creation
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with the simplified function
CREATE TRIGGER trigger_update_leave_balance_on_status_change
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_status_change();

-- ========================================
-- 7. KEEP ESSENTIAL MANUAL FUNCTIONS
-- ========================================

-- Keep the manual recalculation function but simplify it (remove automatic calculations)
CREATE OR REPLACE FUNCTION recalculate_user_leave_balance(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_info record;
  annual_leave_type_id uuid;
  balance_info record;
BEGIN
  -- Get user information
  SELECT id, full_name, date_of_joining, status INTO user_info
  FROM users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF user_info.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not active');
  END IF;
  
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types WHERE name = 'Annual Leave' LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Annual Leave type not found');
  END IF;
  
  -- Get current balance information (no automatic updates)
  SELECT 
    allocated_days,
    used_days,
    remaining_days
  INTO balance_info
  FROM leave_balances 
  WHERE user_id = p_user_id 
    AND leave_type_id = annual_leave_type_id 
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No balance record found. HR must create leave allocation manually.');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_info.id,
      'full_name', user_info.full_name,
      'date_of_joining', user_info.date_of_joining,
      'tenure_months', get_tenure_months(user_info.date_of_joining)
    ),
    'balance', jsonb_build_object(
      'allocated_days', balance_info.allocated_days,
      'used_days', balance_info.used_days,
      'remaining_days', balance_info.remaining_days
    ),
    'note', 'Leave allocations are managed manually by HR'
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. UPDATE API FUNCTION FOR USER LEAVE SUMMARY
-- ========================================

-- Update the user leave summary function to work without automatic calculations
CREATE OR REPLACE FUNCTION get_user_leave_summary(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_data record;
  balance_data record;
  annual_leave_type_id uuid;
  result jsonb;
BEGIN
  -- Get user basic info
  SELECT id, full_name, email, date_of_joining, status
  INTO user_data
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types WHERE name = 'Annual Leave' LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Annual Leave type not found');
  END IF;
  
  -- Get balance data for current year
  SELECT 
    allocated_days,
    used_days,
    remaining_days
  INTO balance_data
  FROM leave_balances
  WHERE user_id = p_user_id 
    AND leave_type_id = annual_leave_type_id
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Build response
  result := jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_data.id,
      'full_name', user_data.full_name,
      'email', user_data.email,
      'date_of_joining', user_data.date_of_joining,
      'tenure_months', get_tenure_months(user_data.date_of_joining)
    ),
    'balance', CASE 
      WHEN balance_data IS NOT NULL THEN
        jsonb_build_object(
          'allocated_days', balance_data.allocated_days,
          'used_days', balance_data.used_days,
          'remaining_days', balance_data.remaining_days
        )
      ELSE
        jsonb_build_object(
          'allocated_days', 0,
          'used_days', 0,
          'remaining_days', 0
        )
    END,
    'rules', jsonb_build_object(
      'note', 'Leave allocations are managed manually by HR once a year'
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 9. UPDATE COMMENTS AND DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION recalculate_user_leave_balance(uuid) IS 'Returns current leave balance information. Leave allocations are managed manually by HR.';
COMMENT ON FUNCTION get_user_leave_summary(uuid) IS 'Returns comprehensive leave information. Leave allocations are managed manually by HR once a year.';
COMMENT ON FUNCTION update_leave_balance_on_status_change() IS 'Updates used_days when leave status changes. Does not auto-create balance records - HR must create them manually.';

-- Add a note to the leave_balances table
COMMENT ON TABLE leave_balances IS 'Employee leave balances. Allocations are managed manually by HR once a year. System only tracks usage when leaves are approved/rejected.';

-- ========================================
-- 10. CLEAN UP INDEXES (Optional)
-- ========================================

-- Keep the tenure index as it might still be useful for HR reports
-- DROP INDEX IF EXISTS idx_users_date_of_joining; -- Commented out to keep

-- ========================================
-- SUMMARY
-- ========================================

-- Log the cleanup completion
DO $$
BEGIN
  RAISE NOTICE 'Automatic leave allocation system has been removed successfully.';
  RAISE NOTICE 'HR must now manage leave allocations manually once a year.';
  RAISE NOTICE 'The system will continue to track leave usage when applications are approved/rejected.';
  RAISE NOTICE 'Leave withdrawal functionality remains intact.';
END;
$$;
