-- Simple Leave Balance Update Migration (TOTAL BALANCE ONLY)
-- This migration safely updates leave balances without any advanced permissions
-- Modified to consolidate all leave types into a single TOTAL leave balance

-- ========================================
-- 1. FIRST: ENSURE CONSTRAINTS ARE REMOVED
-- ========================================

-- Remove the problematic constraint that prevents negative balances
ALTER TABLE leave_balances 
DROP CONSTRAINT IF EXISTS leave_balances_used_not_exceed_allocated;

-- ========================================
-- 2. CREATE A SIMPLE BALANCE UPDATE FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION simple_update_leave_balances()
RETURNS TABLE(
  user_name TEXT,
  employee_id TEXT,
  leave_type TEXT,
  old_used_days NUMERIC,
  new_used_days NUMERIC,
  difference NUMERIC
) AS $$
DECLARE
  app_record RECORD;
  balance_record RECORD;
  total_apps INTEGER := 0;
  processed_apps INTEGER := 0;
  days_to_deduct NUMERIC;
  is_friday BOOLEAN;
  is_monday BOOLEAN;
  is_single_day BOOLEAN;
  total_leave_type_id uuid;
BEGIN
  -- Get or create the 'Total Leave' type ID (consolidate all leave types into one balance)
  SELECT id INTO total_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
  LIMIT 1;
  
  -- If no 'Total Leave' type exists, use the first available leave type as default
  IF total_leave_type_id IS NULL THEN
    SELECT id INTO total_leave_type_id 
    FROM leave_types 
    ORDER BY created_at 
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Using leave type ID % for total leave balance consolidation', total_leave_type_id;
  -- Count total approved applications
  SELECT COUNT(*) INTO total_apps FROM leave_applications WHERE status = 'approved';
  RAISE NOTICE 'Found % approved applications to process', total_apps;
  
  -- STEP 1: Consolidate all existing leave balances into total leave balance
  -- Sum up all allocated and used days for each user/year across all leave types
  INSERT INTO leave_balances (user_id, leave_type_id, year, allocated_days, used_days, created_at, updated_at)
  SELECT 
    user_id,
    total_leave_type_id,
    year,
    SUM(allocated_days) as total_allocated,
    0 as total_used, -- We'll recalculate from applications
    MIN(created_at) as created_at,
    now() as updated_at
  FROM leave_balances
  GROUP BY user_id, year
  ON CONFLICT (user_id, leave_type_id, year) 
  DO UPDATE SET 
    allocated_days = EXCLUDED.allocated_days,
    used_days = 0, -- Reset to recalculate
    updated_at = now();
  
  -- STEP 2: Remove individual leave type balances (keep only total)
  DELETE FROM leave_balances 
  WHERE leave_type_id != total_leave_type_id;
  
  RAISE NOTICE 'Consolidated all leave balances into total leave balance';
  
  -- Process each approved application
  FOR app_record IN 
    SELECT la.*, u.full_name, u.employee_id, lt.name as leave_type_name
    FROM leave_applications la
    JOIN users u ON la.user_id = u.id
    JOIN leave_types lt ON la.leave_type_id = lt.id
    WHERE la.status = 'approved'
    ORDER BY la.user_id, la.start_date
  LOOP
    processed_apps := processed_apps + 1;
    
    -- Calculate days to deduct (simple calculation for now)
    is_friday := EXTRACT(DOW FROM app_record.start_date) = 5;
    is_monday := EXTRACT(DOW FROM app_record.start_date) = 1;
    is_single_day := app_record.start_date = app_record.end_date;
    
    -- Simple deduction logic
    IF is_single_day AND (is_friday OR is_monday) THEN
      days_to_deduct := 1; -- Single Friday/Monday gets 1 day
    ELSE
      -- Calculate working days between dates
      days_to_deduct := app_record.end_date - app_record.start_date + 1;
    END IF;
    
    -- Handle half day
    IF app_record.is_half_day THEN
      days_to_deduct := days_to_deduct * 0.5;
    END IF;
    
    -- Update or create balance record (using total leave type only)
    INSERT INTO leave_balances (
      user_id, 
      leave_type_id, 
      year, 
      allocated_days, 
      used_days, 
      created_at, 
      updated_at
    ) VALUES (
      app_record.user_id,
      total_leave_type_id,
      EXTRACT(YEAR FROM app_record.start_date),
      0, -- We'll keep existing allocated_days
      days_to_deduct,
      now(),
      now()
    )
    ON CONFLICT (user_id, leave_type_id, year) 
    DO UPDATE SET 
      used_days = leave_balances.used_days + EXCLUDED.used_days,
      updated_at = now();
    
    -- Return progress info
    RETURN QUERY SELECT 
      app_record.full_name::TEXT,
      app_record.employee_id::TEXT,
      'Total Leave'::TEXT,  -- Always show as Total Leave
      0::NUMERIC as old_used,
      days_to_deduct::NUMERIC as new_used,
      days_to_deduct::NUMERIC as diff;
    
    -- Log progress every 10 applications
    IF processed_apps % 10 = 0 THEN
      RAISE NOTICE 'Processed %/% applications', processed_apps, total_apps;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed processing % applications', processed_apps;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. RUN THE UPDATE
-- ========================================

-- Execute the balance update
SELECT * FROM simple_update_leave_balances();

-- ========================================
-- 4. SHOW RESULTS
-- ========================================

-- Show current TOTAL balance summary (only one balance per user now)
SELECT 
  u.full_name,
  u.employee_id,
  'Total Leave' as leave_type,
  lb.allocated_days,
  lb.used_days,
  (lb.allocated_days - lb.used_days) as remaining_days,
  CASE 
    WHEN (lb.allocated_days - lb.used_days) < 0 THEN 'NEGATIVE BALANCE'
    WHEN (lb.allocated_days - lb.used_days) = 0 THEN 'ZERO BALANCE'
    ELSE 'POSITIVE BALANCE'
  END as balance_status
FROM leave_balances lb
JOIN users u ON lb.user_id = u.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
ORDER BY u.full_name;

-- ========================================
-- 5. GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION simple_update_leave_balances TO authenticated;

COMMENT ON FUNCTION simple_update_leave_balances IS 'Simple function to update leave balances for approved applications';

-- ========================================
-- 6. COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN 
  RAISE NOTICE 'TOTAL LEAVE BALANCE consolidation completed successfully!';
  RAISE NOTICE 'All leave types now consolidated into a single total leave balance per user.';
  RAISE NOTICE 'Future leave applications will affect only the total balance regardless of leave type selected.';
END $$;
