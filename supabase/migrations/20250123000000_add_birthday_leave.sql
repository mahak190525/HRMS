/*
  # Add Birthday Leave Support
  
  1. Add 'Birthday Leave' as a leave type
  2. Modify leave balance trigger to handle birthday leave (no balance deduction, paid leave)
  3. Add validation to ensure birthday leave can only be applied on employee's birthday
*/

-- ========================================
-- 1. ADD BIRTHDAY LEAVE TYPE
-- ========================================

-- Insert Birthday Leave type if it doesn't exist
INSERT INTO leave_types (name, description, max_days_per_year, carry_forward, requires_approval)
SELECT 
  'Birthday Leave',
  'Paid leave that can only be availed on the employee''s birthday. Does not deduct from leave balance.',
  1,
  false,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM leave_types WHERE LOWER(name) = 'birthday leave'
);

-- ========================================
-- 2. UPDATE LEAVE BALANCE TRIGGER TO HANDLE BIRTHDAY LEAVE
-- ========================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

-- Enhanced function that handles both compensatory off and birthday leave
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
    
    -- If changing from approved to something else, restore days
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      -- Use the original deducted days (stored in the application)
      days_to_add_to_used := -COALESCE(OLD.sandwich_deducted_days, OLD.days_count);
      
      -- Log what we're restoring for debugging
      RAISE NOTICE 'Restoring % days for withdrawn application % (sandwich_deducted_days: %, days_count: %)', 
        -days_to_add_to_used, OLD.id, OLD.sandwich_deducted_days, OLD.days_count;
      
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
        RAISE NOTICE 'Leave approved for user %: % days calculated (original: % days). Reason: %', 
          NEW.user_id, sandwich_calculation.deducted_days, NEW.days_count, sandwich_calculation.reason;
      END IF;
    END IF;
    
    -- Update the regular leave balance if this is NOT a compensatory off leave AND NOT a birthday leave
    IF NOT is_compensatory_off AND NOT is_birthday_leave AND days_to_add_to_used != 0 THEN
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
        -- Allow negative balances (users can go over their allocation)
        UPDATE leave_balances SET
          used_days = current_used + days_to_add_to_used,
          updated_at = now()
        WHERE user_id = NEW.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Log balance update for debugging
        RAISE NOTICE 'Leave balance updated for user %: used_days changed from % to % (change: %)', 
          NEW.user_id, current_used, current_used + days_to_add_to_used, days_to_add_to_used;
        
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
          GREATEST(0, days_to_add_to_used), -- Don't allow negative initial values
          now(),
          now()
        );
        
        RAISE WARNING 'Created new leave balance record for user % with % used days (no allocation set)', 
          NEW.user_id, GREATEST(0, days_to_add_to_used);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_leave_balance_on_status_change
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_status_change();

-- ========================================
-- 3. CREATE FUNCTION TO VALIDATE BIRTHDAY LEAVE
-- ========================================

-- Function to validate that birthday leave is only applied on the employee's birthday
CREATE OR REPLACE FUNCTION validate_birthday_leave()
RETURNS trigger AS $$
DECLARE
  user_birthday date;
  birthday_leave_type_id uuid;
  is_birthday_leave boolean;
  leave_start_month integer;
  leave_start_day integer;
  birthday_month integer;
  birthday_day integer;
BEGIN
  -- Get the birthday leave type ID
  SELECT id INTO birthday_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) = 'birthday leave' 
  LIMIT 1;
  
  -- Check if this is a birthday leave
  is_birthday_leave := (birthday_leave_type_id IS NOT NULL AND NEW.leave_type_id = birthday_leave_type_id);
  
  -- Only validate if this is a birthday leave
  IF is_birthday_leave THEN
    -- Get user's birthday
    SELECT date_of_birth INTO user_birthday
    FROM users
    WHERE id = NEW.user_id;
    
    -- Check if user has a birthday set
    IF user_birthday IS NULL THEN
      RAISE EXCEPTION 'Cannot apply for birthday leave: Employee date of birth is not set in the system. Please contact HR.';
    END IF;
    
    -- Extract month and day from leave start date
    leave_start_month := EXTRACT(MONTH FROM NEW.start_date);
    leave_start_day := EXTRACT(DAY FROM NEW.start_date);
    
    -- Extract month and day from user's birthday
    birthday_month := EXTRACT(MONTH FROM user_birthday);
    birthday_day := EXTRACT(DAY FROM user_birthday);
    
    -- Validate that the leave date matches the birthday (month and day)
    IF leave_start_month != birthday_month OR leave_start_day != birthday_day THEN
      RAISE EXCEPTION 'Birthday leave can only be availed on your birthday (Month: %, Day: %). The selected date does not match your birthday.', 
        birthday_month, birthday_day;
    END IF;
    
    -- Validate that start_date and end_date are the same (single day only)
    IF NEW.start_date != NEW.end_date THEN
      RAISE EXCEPTION 'Birthday leave can only be applied for a single day. Start date and end date must be the same.';
    END IF;
    
    -- Validate that it's not a half day (birthday leave should be full day)
    IF COALESCE(NEW.is_half_day, false) = true THEN
      RAISE EXCEPTION 'Birthday leave must be a full day leave. Half day is not allowed.';
    END IF;
    
    RAISE NOTICE 'Birthday leave validated successfully for user % on date %', 
      NEW.user_id, NEW.start_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate birthday leave before insert/update
DROP TRIGGER IF EXISTS trigger_validate_birthday_leave ON leave_applications;
CREATE TRIGGER trigger_validate_birthday_leave
  BEFORE INSERT OR UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION validate_birthday_leave();

-- ========================================
-- 4. GRANT PERMISSIONS
-- ========================================

-- Function permissions are inherited from the schema, but we ensure they're set
GRANT EXECUTE ON FUNCTION validate_birthday_leave() TO authenticated;

-- ========================================
-- 5. COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN 
  RAISE NOTICE '=== BIRTHDAY LEAVE SUPPORT ADDED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'FEATURES:';
  RAISE NOTICE '  1. Birthday Leave is a paid leave type';
  RAISE NOTICE '  2. Does not deduct from leave balance';
  RAISE NOTICE '  3. Can only be availed on the employee''s birthday';
  RAISE NOTICE '  4. Must be a full day (no half day allowed)';
  RAISE NOTICE '  5. Must be a single day (start_date = end_date)';
  RAISE NOTICE '';
  RAISE NOTICE 'VALIDATION:';
  RAISE NOTICE '  - Validates that leave date matches employee birthday (month and day)';
  RAISE NOTICE '  - Validates that it is a single day leave';
  RAISE NOTICE '  - Validates that it is a full day (not half day)';
END $$;

