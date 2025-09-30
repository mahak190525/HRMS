-- Fix Friday/Monday Pair Withdrawal Logic
-- When one of the Friday/Monday pair is withdrawn:
-- 1. Restore 2 days for the withdrawn application
-- 2. Update the remaining application from 2 days to 1 day
-- 3. Adjust balance accordingly (net result: restore 3 days total)

-- ========================================
-- 1. FUNCTION TO HANDLE FRIDAY/MONDAY PAIR WITHDRAWAL
-- ========================================

CREATE OR REPLACE FUNCTION handle_friday_monday_pair_withdrawal(
  p_withdrawn_app_id uuid,
  p_user_id uuid,
  p_start_date date
)
RETURNS void AS $$
DECLARE
  related_app_id uuid;
  related_app record;
  total_leave_type_id uuid;
  current_used numeric;
  balance_adjustment numeric;
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
  
  -- Find the related Friday/Monday application
  SELECT id INTO related_app_id
  FROM leave_applications la
  WHERE la.user_id = p_user_id
  AND la.start_date = la.end_date  -- Single day application
  AND la.status = 'approved'
  AND la.id != p_withdrawn_app_id
  AND la.sandwich_deducted_days = 2  -- Currently marked as sandwich (2 days)
  AND (
    -- If withdrawn app is Friday, find Monday 3 days later
    (is_friday(p_start_date) AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
    OR
    -- If withdrawn app is Monday, find Friday 3 days earlier
    (is_monday(p_start_date) AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
  );
  
  -- If we found a related application, update it
  IF related_app_id IS NOT NULL THEN
    -- Get the related application details
    SELECT * INTO related_app FROM leave_applications WHERE id = related_app_id;
    
    -- Update the related application from 2 days to 1 day (no longer sandwich)
    UPDATE leave_applications 
    SET 
      sandwich_deducted_days = 1,
      sandwich_reason = 'Single Friday/Monday leave (pair withdrawn - reverted to 1 day)',
      is_sandwich_leave = false,
      updated_at = now()
    WHERE id = related_app_id;
    
    -- Calculate balance adjustment: related app changes from 2 days to 1 day
    balance_adjustment := 1 - 2; -- = -1 day (restore 1 day)
    
    -- Get current balance
    SELECT used_days INTO current_used
    FROM leave_balances
    WHERE user_id = p_user_id 
    AND leave_type_id = total_leave_type_id 
    AND year = EXTRACT(YEAR FROM related_app.start_date);
    
    IF FOUND THEN
      -- Apply the balance adjustment for the related app
      UPDATE leave_balances 
      SET 
        used_days = current_used + balance_adjustment,
        updated_at = now()
      WHERE user_id = p_user_id 
      AND leave_type_id = total_leave_type_id 
      AND year = EXTRACT(YEAR FROM related_app.start_date);
      
      RAISE NOTICE 'FRIDAY/MONDAY PAIR WITHDRAWAL: Updated related app % from 2 days to 1 day. Balance adjustment: % day', 
        related_app_id, balance_adjustment;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. UPDATE TRIGGER TO HANDLE PAIR WITHDRAWALS
-- ========================================

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
  
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_to_add_to_used := 0;
    
    -- If changing from approved to something else, restore days (reduce used_days)
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      
      -- For withdrawal, restore the EXACT amount that was deducted when approved
      IF NEW.status = 'withdrawn' THEN
        -- Use the stored sandwich deduction amount
        actual_deducted_days := COALESCE(OLD.sandwich_deducted_days, OLD.days_count);
        
        -- Check if this is part of a Friday/Monday pair that was marked as sandwich (2 days each)
        IF (is_friday(OLD.start_date) OR is_monday(OLD.start_date)) 
           AND OLD.start_date = OLD.end_date 
           AND OLD.sandwich_deducted_days = 2 
           AND OLD.is_sandwich_leave = true THEN
          is_friday_monday_pair := true;
        END IF;
        
        RAISE NOTICE 'WITHDRAWAL: Application % - restoring % days (was sandwich: %, is_friday_monday_pair: %)', 
          OLD.id, actual_deducted_days, COALESCE(OLD.is_sandwich_leave, false), is_friday_monday_pair;
      ELSE
        -- For other status changes, use stored deduction amount
        actual_deducted_days := COALESCE(OLD.sandwich_deducted_days, OLD.days_count);
        RAISE NOTICE 'STATUS CHANGE: Application % - status changed to % - restoring % days', 
          OLD.id, NEW.status, actual_deducted_days;
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
      
      -- Check if this completes a Friday/Monday sandwich pattern and update related application
      IF (is_friday(NEW.start_date) OR is_monday(NEW.start_date)) AND NEW.start_date = NEW.end_date THEN
        PERFORM update_related_sandwich_applications(NEW.user_id, NEW.start_date, NEW.id);
      END IF;
      
      RAISE NOTICE 'APPROVAL: Application % - is_half_day=%, deducting % days, reason: %', 
        NEW.id, NEW.is_half_day, sandwich_calculation.deducted_days, sandwich_calculation.reason;
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
        UPDATE leave_balances SET
          used_days = current_used + days_to_add_to_used,
          updated_at = now()
        WHERE user_id = NEW.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        RAISE NOTICE 'BALANCE UPDATE: user % - change=% days - used_days: % → %', 
          NEW.user_id, days_to_add_to_used, current_used, current_used + days_to_add_to_used;
        
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
-- 3. GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION handle_friday_monday_pair_withdrawal TO authenticated;

-- ========================================
-- 4. COMPLETION MESSAGE
-- ========================================

DO $$ 
BEGIN 
  RAISE NOTICE '=== FRIDAY/MONDAY PAIR WITHDRAWAL LOGIC FIXED ===';
  RAISE NOTICE '';
  RAISE NOTICE 'NEW BEHAVIOR:';
  RAISE NOTICE '  1. When Friday/Monday pair is approved: 2 days each (4 total)';
  RAISE NOTICE '  2. When one of the pair is withdrawn:';
  RAISE NOTICE '     - Withdrawn app: restore 2 days';
  RAISE NOTICE '     - Remaining app: change from 2 days to 1 day (restore 1 day)';
  RAISE NOTICE '     - Net effect: restore 3 days total to balance';
  RAISE NOTICE '';
  RAISE NOTICE 'EXAMPLE:';
  RAISE NOTICE '  - Friday + Monday approved: used_days +4';
  RAISE NOTICE '  - Friday withdrawn: used_days -3 (Friday -2, Monday adjustment -1)';
  RAISE NOTICE '  - Monday remains as single day leave (1 day deduction)';
END $$;
