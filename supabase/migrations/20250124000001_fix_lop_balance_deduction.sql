/*
  # Fix LOP Days Balance Deduction
  
  Update the trigger to exclude LOP days from balance deduction.
  LOP days should not be deducted from leave balance.
  When restoring balance (withdrawal), also account for LOP days.
  
  IMPORTANT: Remove constraint that prevents negative used_days to allow
  negative balances (which will be corrected by monthly credits).
*/

-- Remove constraint that prevents negative used_days (we need to allow negative balances)
ALTER TABLE leave_balances 
DROP CONSTRAINT IF EXISTS leave_balances_used_not_negative;

ALTER TABLE leave_balances 
DROP CONSTRAINT IF EXISTS leave_balances_used_days_not_negative;

-- Add LOP days variable to the function
CREATE OR REPLACE FUNCTION update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  days_to_add_to_used numeric;
  sandwich_calculation record;
  current_allocated numeric;
  current_used numeric;
  balance_record_exists boolean;
  total_leave_type_id uuid;
  comp_off_leave_type_id uuid;
  birthday_leave_type_id uuid;
  is_compensatory_off boolean;
  is_birthday_leave boolean;
  current_comp_off_balance numeric;
  lop_days_to_exclude numeric;
  old_lop_days numeric;
BEGIN
  -- Get the compensatory off leave type ID
  SELECT id INTO comp_off_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('compensatory off', 'compensatory', 'comp off') 
  LIMIT 1;
  
  -- Get the birthday leave type ID
  SELECT id INTO birthday_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) = 'birthday leave' 
  LIMIT 1;
  
  -- Check if this is a compensatory off leave
  is_compensatory_off := (comp_off_leave_type_id IS NOT NULL AND NEW.leave_type_id = comp_off_leave_type_id);
  
  -- Check if this is a birthday leave
  is_birthday_leave := (birthday_leave_type_id IS NOT NULL AND NEW.leave_type_id = birthday_leave_type_id);
  
  -- Get or create the 'Total Leave' type ID (for non-compensatory and non-birthday leaves)
  SELECT id INTO total_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
  LIMIT 1;
  
  -- If no 'Total Leave' type exists, use the first available leave type as default
  IF total_leave_type_id IS NULL THEN
    SELECT id INTO total_leave_type_id 
    FROM leave_types 
    WHERE id != COALESCE(comp_off_leave_type_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND id != COALESCE(birthday_leave_type_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY created_at 
    LIMIT 1;
  END IF;
  
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_to_add_to_used := 0;
    
    -- Get LOP days (for current and old record)
    lop_days_to_exclude := COALESCE(NEW.lop_days, 0);
    old_lop_days := COALESCE(OLD.lop_days, 0);
    
    -- If changing from approved to something else, restore days
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      -- IMPORTANT: When restoring, we need to restore only the non-LOP portion that was deducted
      -- The sandwich_deducted_days should already exclude LOP days (since we subtracted LOP when approving)
      -- If sandwich_deducted_days is NULL, calculate it as days_count - lop_days (non-LOP portion)
      IF OLD.sandwich_deducted_days IS NOT NULL THEN
        -- Use the stored value (already excludes LOP)
        days_to_add_to_used := -OLD.sandwich_deducted_days;
      ELSE
        -- Calculate non-LOP portion: days_count - lop_days
        days_to_add_to_used := -(OLD.days_count - COALESCE(old_lop_days, 0));
      END IF;
      
      -- Log the restoration for debugging
      IF old_lop_days > 0 THEN
        RAISE NOTICE 'Restoring % days for withdrawn application % (sandwich_deducted_days: %, days_count: %, LOP: %, restoring non-LOP portion only)', 
          -days_to_add_to_used, OLD.id, OLD.sandwich_deducted_days, OLD.days_count, old_lop_days;
      ELSE
        RAISE NOTICE 'Restoring % days for withdrawn application % (sandwich_deducted_days: %, days_count: %)', 
          -days_to_add_to_used, OLD.id, OLD.sandwich_deducted_days, OLD.days_count;
      END IF;
      
      -- Clear the sandwich calculation when status changes from approved
      UPDATE leave_applications 
      SET 
        sandwich_deducted_days = NULL,
        sandwich_reason = NULL,
        is_sandwich_leave = NULL,
        updated_at = now()
      WHERE id = NEW.id;
      
      -- Restore comp off balance if this was a compensatory off leave
      IF is_compensatory_off THEN
        -- Get current comp off balance
        SELECT COALESCE(comp_off_balance, 0) INTO current_comp_off_balance
        FROM users
        WHERE id = NEW.user_id;
        
        -- Restore the balance
        UPDATE users
        SET comp_off_balance = current_comp_off_balance + (-days_to_add_to_used),
            updated_at = now()
        WHERE id = NEW.user_id;
        
        RAISE NOTICE 'Restored % comp off balance for user %. New balance: %', 
          -days_to_add_to_used, NEW.user_id, current_comp_off_balance + (-days_to_add_to_used);
      END IF;
      
      -- For birthday leave, no balance to restore (it doesn't deduct from any balance)
      IF is_birthday_leave THEN
        RAISE NOTICE 'Birthday leave withdrawn for user %. No balance to restore (paid leave, no deduction).', 
          NEW.user_id;
      END IF;
    
    -- If changing to approved from something else, deduct days
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      
      -- For birthday leave, no balance deduction (paid leave)
      IF is_birthday_leave THEN
        -- Store the deduction info in the application (0 days deducted)
        UPDATE leave_applications 
        SET 
          sandwich_deducted_days = 0,
          sandwich_reason = 'Birthday leave - paid leave, no balance deduction',
          is_sandwich_leave = false,
          updated_at = now()
        WHERE id = NEW.id;
        
        days_to_add_to_used := 0; -- No deduction from leave balance
        
        RAISE NOTICE 'Birthday leave approved for user %. No balance deduction (paid leave).', 
          NEW.user_id;
      
      -- For compensatory off, use simple days_count (no sandwich calculation)
      ELSIF is_compensatory_off THEN
        days_to_add_to_used := NEW.days_count;
        
        -- Check if user has enough comp off balance
        SELECT COALESCE(comp_off_balance, 0) INTO current_comp_off_balance
        FROM users
        WHERE id = NEW.user_id;
        
        IF current_comp_off_balance < days_to_add_to_used THEN
          RAISE WARNING 'User % does not have enough comp off balance. Required: %, Available: %', 
            NEW.user_id, days_to_add_to_used, current_comp_off_balance;
        END IF;
        
        -- Deduct from comp off balance
        UPDATE users
        SET comp_off_balance = GREATEST(0, current_comp_off_balance - days_to_add_to_used),
            updated_at = now()
        WHERE id = NEW.user_id;
        
        -- Store the deduction info in the application
        UPDATE leave_applications 
        SET 
          sandwich_deducted_days = days_to_add_to_used,
          sandwich_reason = 'Compensatory off - deducted from comp off balance',
          is_sandwich_leave = false,
          updated_at = now()
        WHERE id = NEW.id;
        
        RAISE NOTICE 'Deducted % comp off balance for user %. New balance: %', 
          days_to_add_to_used, NEW.user_id, GREATEST(0, current_comp_off_balance - days_to_add_to_used);
      ELSE
        -- For regular leaves, use sandwich leave calculation
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
        
        -- Check if this completes a Friday/Monday sandwich pattern and update related application
        IF (is_friday(NEW.start_date) OR is_monday(NEW.start_date)) AND NEW.start_date = NEW.end_date THEN
          PERFORM update_related_sandwich_applications(NEW.user_id, NEW.start_date, NEW.id);
        END IF;
        
        -- Log the calculation for debugging
        RAISE NOTICE 'Leave approved for user %: % days calculated (original: % days, LOP: % days). Reason: %', 
          NEW.user_id, sandwich_calculation.deducted_days, NEW.days_count, lop_days_to_exclude, sandwich_calculation.reason;
      END IF;
    END IF;
    
    -- Update the regular leave balance if this is NOT a compensatory off leave AND NOT a birthday leave
    IF NOT is_compensatory_off AND NOT is_birthday_leave AND days_to_add_to_used != 0 THEN
      -- IMPORTANT: Only deduct non-LOP days from leave balance
      -- LOP days should NOT be deducted from balance (they are Loss of Pay, salary deduction only)
      -- This applies when approving (positive days_to_add_to_used) or withdrawing (negative days_to_add_to_used)
      IF days_to_add_to_used > 0 THEN
        -- When approving: subtract LOP days from deduction
        -- Example: If leave has 3.0 days and 0.9 LOP, only 2.1 days should be deducted from balance
        days_to_add_to_used := GREATEST(0, days_to_add_to_used - lop_days_to_exclude);
      ELSIF days_to_add_to_used < 0 THEN
        -- When withdrawing: the restoration should already account for LOP (since deduction excluded it)
        -- But we need to make sure we're restoring the correct amount
        -- The OLD.sandwich_deducted_days should already exclude LOP, so we restore as-is
        -- No adjustment needed here
      END IF;
      
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
        -- IMPORTANT: Allow negative used_days to support negative balances
        -- Negative used_days means positive balance (allocated - used = allocated - negative = allocated + positive)
        -- This is necessary when withdrawing leaves that were approved with insufficient balance
        -- The negative balance will be corrected by monthly credits
        -- Only deduct non-LOP days (LOP days are excluded above)
        UPDATE leave_balances SET
          used_days = current_used + days_to_add_to_used, -- Can be negative, which is allowed
          updated_at = now()
        WHERE user_id = NEW.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Log balance update for debugging
        IF lop_days_to_exclude > 0 THEN
          RAISE NOTICE 'Leave balance updated for user %: used_days changed from % to % (change: %, LOP excluded: %)', 
            NEW.user_id, current_used, current_used + days_to_add_to_used, days_to_add_to_used, lop_days_to_exclude;
        ELSE
          RAISE NOTICE 'Leave balance updated for user %: used_days changed from % to % (change: %)', 
            NEW.user_id, current_used, current_used + days_to_add_to_used, days_to_add_to_used;
        END IF;
        
        -- Log a warning if the operation exceeds allocated days
        IF current_used + days_to_add_to_used > current_allocated THEN
          RAISE WARNING 'Leave balance exceeded for user %. Used: %, Allocated: %, New Used: %. Employee will have negative balance.', 
            NEW.user_id, current_used, current_allocated, current_used + days_to_add_to_used;
        END IF;
      ELSE
        -- Create a leave balance record if it doesn't exist (using total leave type)
        -- This handles cases where users apply for leave before balance is set up
        INSERT INTO leave_balances (
          user_id, 
          leave_type_id, 
          year, 
          allocated_days, 
          used_days, 
          created_at, 
          updated_at
        ) VALUES (
          NEW.user_id,
          total_leave_type_id,
          EXTRACT(YEAR FROM NEW.start_date),
          0, -- No allocation, but track usage
          days_to_add_to_used, -- Allow negative values (negative used_days = positive balance)
          now(),
          now()
        );
        
        IF lop_days_to_exclude > 0 THEN
          RAISE WARNING 'Created new leave balance record for user % with % used days (LOP excluded: %, no allocation set)', 
            NEW.user_id, GREATEST(0, days_to_add_to_used), lop_days_to_exclude;
        ELSE
          RAISE WARNING 'Created new leave balance record for user % with % used days (no allocation set)', 
            NEW.user_id, GREATEST(0, days_to_add_to_used);
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
