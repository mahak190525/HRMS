/*
  # Add Compensatory Off Balance Support
  
  1. Add comp_off_balance column to users table
  2. Modify leave balance trigger to handle compensatory off deductions
  3. Update functions to support comp off balance
*/

-- ========================================
-- 1. ADD COMP_OFF_BALANCE COLUMN TO USERS TABLE
-- ========================================

-- Add comp_off_balance column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS comp_off_balance NUMERIC(10,2) DEFAULT 0.0 CHECK (comp_off_balance >= 0);

-- Add comment
COMMENT ON COLUMN users.comp_off_balance IS 'Compensatory off balance for the employee. Deducted when applying for compensatory off leave.';

-- ========================================
-- 2. UPDATE LEAVE BALANCE TRIGGER TO HANDLE COMPENSATORY OFF
-- ========================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

-- Enhanced function that handles compensatory off balance
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
  is_compensatory_off boolean;
  current_comp_off_balance numeric;
BEGIN
  -- Get the compensatory off leave type ID
  SELECT id INTO comp_off_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('compensatory off', 'compensatory', 'comp off') 
  LIMIT 1;
  
  -- Check if this is a compensatory off leave
  is_compensatory_off := (comp_off_leave_type_id IS NOT NULL AND NEW.leave_type_id = comp_off_leave_type_id);
  
  -- Get or create the 'Total Leave' type ID (for non-compensatory leaves)
  SELECT id INTO total_leave_type_id 
  FROM leave_types 
  WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
  LIMIT 1;
  
  -- If no 'Total Leave' type exists, use the first available leave type as default
  IF total_leave_type_id IS NULL THEN
    SELECT id INTO total_leave_type_id 
    FROM leave_types 
    WHERE id != comp_off_leave_type_id
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
      
    -- If changing to approved from something else, deduct days
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      -- For compensatory off, use simple days_count (no sandwich calculation)
      IF is_compensatory_off THEN
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
    
    -- Update the regular leave balance if this is NOT a compensatory off leave
    IF NOT is_compensatory_off AND days_to_add_to_used != 0 THEN
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
-- 3. CREATE HELPER FUNCTION TO GET COMP OFF BALANCE
-- ========================================

-- Function to get user's comp off balance
CREATE OR REPLACE FUNCTION get_user_comp_off_balance(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT COALESCE(comp_off_balance, 0) INTO v_balance
  FROM users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_comp_off_balance(uuid) IS 'Returns the compensatory off balance for a user';

-- ========================================
-- 4. CREATE FUNCTION TO ADJUST COMP OFF BALANCE
-- ========================================

-- Function to adjust comp off balance
CREATE OR REPLACE FUNCTION adjust_comp_off_balance(
    p_user_id uuid,
    p_adjustment_type text,
    p_amount numeric,
    p_reason text,
    p_adjusted_by uuid
)
RETURNS TABLE (
    success boolean,
    message text,
    new_balance numeric,
    full_name text,
    employee_id text
) AS $$
DECLARE
    v_current_balance numeric;
    v_new_balance numeric;
    v_user_full_name text;
    v_user_employee_id text;
BEGIN
    -- Get current comp off balance and user info
    SELECT 
        COALESCE(u.comp_off_balance, 0),
        u.full_name,
        u.employee_id
    INTO v_current_balance, v_user_full_name, v_user_employee_id
    FROM users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            FALSE::boolean,
            'User not found'::text,
            0::numeric,
            ''::text,
            ''::text;
        RETURN;
    END IF;

    -- Calculate new balance
    IF p_adjustment_type = 'add' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSIF p_adjustment_type = 'subtract' THEN
        v_new_balance := GREATEST(0, v_current_balance - p_amount);
    ELSE
        RETURN QUERY SELECT 
            FALSE::boolean,
            'Invalid adjustment type. Use "add" or "subtract"'::text,
            v_current_balance,
            v_user_full_name,
            v_user_employee_id;
        RETURN;
    END IF;

    -- Update comp off balance
    UPDATE users
    SET 
        comp_off_balance = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;

    -- Log the adjustment (we'll use a simple approach - could be enhanced with a dedicated table)
    -- For now, we'll just update the balance and return success

    RETURN QUERY SELECT 
        TRUE::boolean,
        'Comp off balance adjusted successfully'::text,
        v_new_balance,
        v_user_full_name,
        v_user_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION adjust_comp_off_balance(uuid, text, numeric, text, uuid) IS 'Adjusts compensatory off balance for a user';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION adjust_comp_off_balance TO authenticated;

