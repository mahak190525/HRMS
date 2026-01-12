/*
  # Fix LOP Days Balance Restoration on Withdrawal
  
  When a leave application with LOP days is withdrawn, the system was incorrectly
  restoring the full days_count (including LOP days) to the leave balance.
  
  This fix ensures that only the non-LOP portion is restored, since LOP days
  were never deducted from the balance in the first place.
  
  Issue: Used balance going negative because LOP days were being added back
  Solution: Exclude LOP days when restoring balance during withdrawal
*/

CREATE OR REPLACE FUNCTION update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  days_to_add_to_used numeric;
  sandwich_calculation record;
  current_allocated numeric;
  current_used numeric;
  balance_record_exists boolean;
  total_leave_type_id uuid;
  actual_deducted_days numeric;
  is_friday_monday_pair boolean := false;
  -- LOP handling variables
  lop_days_to_exclude numeric;
  old_lop_days numeric;
BEGIN
  -- Get total leave type ID
  SELECT id INTO total_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
  LIMIT 1;
  
  IF total_leave_type_id IS NULL THEN
    SELECT id INTO total_leave_type_id 
    FROM leave_types 
    ORDER BY created_at 
    LIMIT 1;
  END IF;
  
  -- Get LOP days (for current and old record)
  lop_days_to_exclude := COALESCE(NEW.lop_days, 0);
  old_lop_days := COALESCE(OLD.lop_days, 0);
  
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_to_add_to_used := 0;
    
    -- If changing from approved to something else, restore days (reduce used_days)
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      
      -- For withdrawal, restore the EXACT amount that was deducted when approved
      -- IMPORTANT: Only restore non-LOP days, since LOP days were never deducted
      IF NEW.status = 'withdrawn' THEN
        -- Use the stored sandwich deduction amount if available
        -- NOTE: sandwich_deducted_days is stored BEFORE LOP subtraction, so we need to subtract LOP
        IF OLD.sandwich_deducted_days IS NOT NULL THEN
          -- Subtract LOP from the stored value to get the actual amount deducted
          -- This is because LOP was subtracted during approval but not stored in sandwich_deducted_days
          -- Ensure we never get negative values
          actual_deducted_days := GREATEST(0, OLD.sandwich_deducted_days - COALESCE(old_lop_days, 0));
        ELSE
          -- If sandwich_deducted_days is NULL, calculate non-LOP portion: days_count - lop_days
          -- This ensures we never restore LOP days to the balance
          actual_deducted_days := GREATEST(0, OLD.days_count - COALESCE(old_lop_days, 0));
        END IF;
        
        -- Check if this is part of a Friday/Monday pair that was marked as sandwich (2 days each)
        IF (is_friday(OLD.start_date) OR is_monday(OLD.start_date)) 
           AND OLD.start_date = OLD.end_date 
           AND OLD.sandwich_deducted_days = 2 
           AND OLD.is_sandwich_leave = true THEN
          is_friday_monday_pair := true;
        END IF;
        
        -- Log the restoration with LOP information
        IF old_lop_days > 0 THEN
          RAISE NOTICE 'WITHDRAWAL: Application % - restoring % days (sandwich_deducted_days: %, days_count: %, LOP: %, restoring non-LOP portion only)', 
            OLD.id, actual_deducted_days, OLD.sandwich_deducted_days, OLD.days_count, old_lop_days;
        ELSE
          RAISE NOTICE 'WITHDRAWAL: Application % - restoring % days (was sandwich: %, is_friday_monday_pair: %)', 
            OLD.id, actual_deducted_days, COALESCE(OLD.is_sandwich_leave, false), is_friday_monday_pair;
        END IF;
      ELSE
        -- For other status changes (rejected, cancelled), use stored deduction amount
        -- NOTE: sandwich_deducted_days is stored BEFORE LOP subtraction, so we need to subtract LOP
        IF OLD.sandwich_deducted_days IS NOT NULL THEN
          -- Subtract LOP from the stored value to get the actual amount deducted
          -- Ensure we never get negative values
          actual_deducted_days := GREATEST(0, OLD.sandwich_deducted_days - COALESCE(old_lop_days, 0));
        ELSE
          -- If sandwich_deducted_days is NULL, calculate non-LOP portion
          actual_deducted_days := GREATEST(0, OLD.days_count - COALESCE(old_lop_days, 0));
        END IF;
        RAISE NOTICE 'STATUS CHANGE: Application % - status changed to % - restoring % days (LOP excluded: %)', 
          OLD.id, NEW.status, actual_deducted_days, old_lop_days;
      END IF;
      
      days_to_add_to_used := -actual_deducted_days;
      
      -- Clear sandwich calculation when status changes from approved
      UPDATE leave_applications 
      SET 
        sandwich_deducted_days = NULL,
        sandwich_reason = NULL,
        is_sandwich_leave = NULL,
        updated_at = now()
      WHERE id = NEW.id;
      
      -- If this was a Friday/Monday pair withdrawal, handle the related application
      IF NEW.status = 'withdrawn' AND is_friday_monday_pair THEN
        PERFORM handle_friday_monday_pair_withdrawal(OLD.id, OLD.user_id, OLD.start_date);
      END IF;
      
    -- If changing to approved from something else, deduct days (increase used_days)
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      
      -- Use sandwich calculation (which handles half-day and sandwich logic correctly)
      SELECT * INTO sandwich_calculation 
      FROM calculate_sandwich_leave_deduction(
        NEW.user_id,
        NEW.start_date,
        NEW.end_date,
        COALESCE(NEW.is_half_day, false),
        NEW.status,
        COALESCE(NEW.applied_at, now())
      );
      
      -- Store the calculated deduction in the application record
      UPDATE leave_applications 
      SET 
        sandwich_deducted_days = sandwich_calculation.deducted_days,
        sandwich_reason = sandwich_calculation.reason,
        is_sandwich_leave = sandwich_calculation.is_sandwich_leave,
        updated_at = now()
      WHERE id = NEW.id;
      
      days_to_add_to_used := sandwich_calculation.deducted_days;
      
      -- IMPORTANT: Subtract LOP days from the deduction when approving
      -- LOP days should NOT be deducted from leave balance (they are Loss of Pay, salary deduction only)
      -- Example: If leave has 3.0 days and 0.9 LOP, only 2.1 days should be deducted from balance
      IF days_to_add_to_used > 0 AND lop_days_to_exclude > 0 THEN
        days_to_add_to_used := GREATEST(0, days_to_add_to_used - lop_days_to_exclude);
        RAISE NOTICE 'APPROVAL: Application % - deducting % days (calculated: %, LOP excluded: %)', 
          NEW.id, days_to_add_to_used, sandwich_calculation.deducted_days, lop_days_to_exclude;
      ELSE
        RAISE NOTICE 'APPROVAL: Application % - is_half_day=%, deducting % days, reason: %', 
          NEW.id, NEW.is_half_day, days_to_add_to_used, sandwich_calculation.reason;
      END IF;
      
      -- Check if this completes a Friday/Monday sandwich pattern and update related application
      IF (is_friday(NEW.start_date) OR is_monday(NEW.start_date)) AND NEW.start_date = NEW.end_date THEN
        PERFORM update_related_sandwich_applications(NEW.user_id, NEW.start_date, NEW.id);
      END IF;
    END IF;
    
    -- Update the leave balance if there's a change
    IF days_to_add_to_used != 0 THEN
      -- Check if balance record exists (using total leave type)
      SELECT EXISTS(
        SELECT 1 FROM leave_balances
        WHERE user_id = NEW.user_id 
        AND leave_type_id = total_leave_type_id 
        AND year = EXTRACT(YEAR FROM NEW.start_date)
      ) INTO balance_record_exists;
      
      IF balance_record_exists THEN
        -- Get current balance (using total leave type)
        SELECT allocated_days, used_days INTO current_allocated, current_used
        FROM leave_balances
        WHERE user_id = NEW.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Calculate new used_days
        -- IMPORTANT: Ensure used_days never goes negative
        -- If the calculation would make it negative, set it to 0
        UPDATE leave_balances SET
          used_days = GREATEST(0, current_used + days_to_add_to_used),
          updated_at = now()
        WHERE user_id = NEW.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Log balance update with LOP information if applicable
        IF (old_lop_days > 0 OR lop_days_to_exclude > 0) AND OLD.status = 'approved' THEN
          RAISE NOTICE 'BALANCE UPDATE: user % - change=% days (LOP excluded) - used_days: % → %', 
            NEW.user_id, days_to_add_to_used, current_used, GREATEST(0, current_used + days_to_add_to_used);
        ELSE
          RAISE NOTICE 'BALANCE UPDATE: user % - change=% days - used_days: % → %', 
            NEW.user_id, days_to_add_to_used, current_used, GREATEST(0, current_used + days_to_add_to_used);
        END IF;
        
        -- Log a warning if used_days would have gone negative (but we prevented it)
        IF current_used + days_to_add_to_used < 0 THEN
          RAISE WARNING 'Leave balance restoration prevented negative used_days for user %. Used: %, Change: %, Set to: 0', 
            NEW.user_id, current_used, days_to_add_to_used;
        END IF;
        
      ELSE
        -- Create balance record if needed
        INSERT INTO leave_balances (
          user_id, leave_type_id, year, allocated_days, used_days, created_at, updated_at
        ) VALUES (
          NEW.user_id, total_leave_type_id, EXTRACT(YEAR FROM NEW.start_date),
          0, GREATEST(0, days_to_add_to_used), now(), now()
        );
        
        RAISE WARNING 'Created new balance record for user %', NEW.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN 
  RAISE NOTICE '=== LOP WITHDRAWAL BALANCE RESTORATION FIX APPLIED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'FIXED BEHAVIOR:';
  RAISE NOTICE '  1. When a leave with LOP days is withdrawn:';
  RAISE NOTICE '     - Only non-LOP days are restored to balance';
  RAISE NOTICE '     - LOP days are never restored (they were never deducted)';
  RAISE NOTICE '  2. When calculating restoration:';
  RAISE NOTICE '     - Use sandwich_deducted_days if available (already excludes LOP)';
  RAISE NOTICE '     - If NULL, calculate as: days_count - lop_days';
  RAISE NOTICE '  3. Used balance protection:';
  RAISE NOTICE '     - used_days is prevented from going negative';
  RAISE NOTICE '';
  RAISE NOTICE 'EXAMPLE:';
  RAISE NOTICE '  - Leave approved: 3.0 days total, 0.9 LOP, 2.1 deducted from balance';
  RAISE NOTICE '  - Leave withdrawn: Only 2.1 days restored (LOP excluded)';
  RAISE NOTICE '  - Result: Balance correctly restored, no negative used_days';
END $$;

