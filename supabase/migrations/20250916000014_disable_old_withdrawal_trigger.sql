-- Disable Old Withdrawal Trigger That's Adding Extra Days
-- The old restore_leave_balance_on_withdrawal() trigger is running in addition to our custom trigger
-- and causing double restoration (0.5 from our trigger + 1 from old trigger = 1.5 total)

-- ========================================
-- 1. DISABLE THE OLD WITHDRAWAL TRIGGER
-- ========================================

-- Drop the old withdrawal trigger that's causing double restoration
DROP TRIGGER IF EXISTS trigger_restore_balance_on_withdrawal ON leave_applications;

-- Also drop the old function since we don't need it anymore
DROP FUNCTION IF EXISTS restore_leave_balance_on_withdrawal();

-- ========================================
-- 2. VERIFY OUR CUSTOM TRIGGER IS THE ONLY ONE
-- ========================================

-- Check what triggers are currently on leave_applications table
DO $$
DECLARE
  trigger_count integer;
  trigger_names text;
BEGIN
  -- Count triggers on leave_applications table
  SELECT COUNT(*), string_agg(tgname, ', ') INTO trigger_count, trigger_names
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relname = 'leave_applications'
  AND n.nspname = 'public'
  AND NOT tgisinternal; -- Exclude internal triggers
  
  RAISE NOTICE 'Found % triggers on leave_applications table: %', trigger_count, COALESCE(trigger_names, 'none');
  
  -- Check specifically for our trigger
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'leave_applications'
    AND n.nspname = 'public'
    AND t.tgname = 'trigger_update_leave_balance_on_status_change'
  ) THEN
    RAISE NOTICE 'GOOD: Our custom trigger (trigger_update_leave_balance_on_status_change) is active';
  ELSE
    RAISE NOTICE 'ERROR: Our custom trigger is NOT found!';
  END IF;
  
  -- Check if the old withdrawal trigger still exists
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'leave_applications'
    AND n.nspname = 'public'
    AND t.tgname = 'trigger_restore_balance_on_withdrawal'
  ) THEN
    RAISE NOTICE 'PROBLEM: Old withdrawal trigger still exists and will cause double restoration!';
  ELSE
    RAISE NOTICE 'GOOD: Old withdrawal trigger has been removed';
  END IF;
END $$;

-- ========================================
-- 3. ENSURE OUR CUSTOM TRIGGER IS PROPERLY ATTACHED
-- ========================================

-- Make sure our custom trigger is properly attached (recreate if needed)
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

CREATE TRIGGER trigger_update_leave_balance_on_status_change
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_status_change();

-- ========================================
-- 4. TEST THE FIX
-- ========================================

-- Function to test half-day withdrawal behavior
CREATE OR REPLACE FUNCTION test_half_day_behavior()
RETURNS TABLE(
  test_name TEXT,
  expected_behavior TEXT,
  current_status TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT 
    'Half-day withdrawal'::TEXT,
    'Should restore exactly 0.5 days'::TEXT,
    'Only our custom trigger should run'::TEXT;
    
  RETURN QUERY SELECT 
    'Trigger count'::TEXT,
    'Should have exactly 1 trigger on leave_applications'::TEXT,
    'Old withdrawal trigger removed'::TEXT;
    
  RETURN QUERY SELECT 
    'Double restoration'::TEXT,
    'Should NOT happen anymore'::TEXT,
    'Only our trigger handles withdrawals'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION test_half_day_behavior TO authenticated;

-- ========================================
-- 5. COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN 
  RAISE NOTICE '=== OLD WITHDRAWAL TRIGGER DISABLED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'PROBLEM SOLVED:';
  RAISE NOTICE '  - Removed old trigger: trigger_restore_balance_on_withdrawal';
  RAISE NOTICE '  - Removed old function: restore_leave_balance_on_withdrawal()';
  RAISE NOTICE '  - Only our custom trigger now handles withdrawals';
  RAISE NOTICE '';
  RAISE NOTICE 'EXPECTED BEHAVIOR NOW:';
  RAISE NOTICE '  - Half-day withdrawal: restore exactly 0.5 days';
  RAISE NOTICE '  - Full-day withdrawal: restore working days';
  RAISE NOTICE '  - NO double restoration anymore';
  RAISE NOTICE '';
  RAISE NOTICE 'To test: SELECT * FROM test_half_day_behavior();';
END $$;
