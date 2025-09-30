-- Implement Corrected Sandwich Leave Calculation
-- This migration adds sandwich leave calculation functionality to the database
-- Based on the corrected business rules

-- ========================================
-- 1. CREATE SANDWICH LEAVE CALCULATION FUNCTION
-- ========================================

-- Function to check if a date is a Friday
CREATE OR REPLACE FUNCTION is_friday(date_val date)
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(dow FROM date_val) = 5; -- 5 = Friday
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a date is a Monday
CREATE OR REPLACE FUNCTION is_monday(date_val date)
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(dow FROM date_val) = 1; -- 1 = Monday
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a date is a weekend
CREATE OR REPLACE FUNCTION is_weekend(date_val date)
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(dow FROM date_val) IN (0, 6); -- 0 = Sunday, 6 = Saturday
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a date is a national holiday
CREATE OR REPLACE FUNCTION is_national_holiday(date_val date)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM holidays 
    WHERE date = date_val 
    AND (is_optional IS FALSE OR is_optional IS NULL)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to generate date range
CREATE OR REPLACE FUNCTION generate_date_range(start_date date, end_date date)
RETURNS TABLE(date_val date) AS $$
BEGIN
  RETURN QUERY
  SELECT generate_series(start_date, end_date, interval '1 day')::date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to count weekdays (excluding weekends and holidays)
CREATE OR REPLACE FUNCTION count_working_days(start_date date, end_date date)
RETURNS integer AS $$
DECLARE
  working_days integer := 0;
  date_val date;
BEGIN
  FOR date_val IN SELECT generate_date_range(start_date, end_date)
  LOOP
    IF NOT is_weekend(date_val) AND NOT is_national_holiday(date_val) THEN
      working_days := working_days + 1;
    END IF;
  END LOOP;
  
  RETURN working_days;
END;
$$ LANGUAGE plpgsql STABLE;

-- Main sandwich leave calculation function with business rules
CREATE OR REPLACE FUNCTION calculate_sandwich_leave_deduction(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false,
  p_status text DEFAULT 'pending',
  p_applied_at timestamptz DEFAULT now()
)
RETURNS TABLE(
  actual_days numeric,
  deducted_days numeric,
  is_sandwich_leave boolean,
  reason text
) AS $$
DECLARE
  working_days integer;
  date_range_length integer;
  is_sudden_leave boolean;
  has_individual_friday_monday boolean;
  result_actual_days numeric;
  result_deducted_days numeric;
  result_is_sandwich boolean := false;
  result_reason text := 'Normal leave calculation';
BEGIN
  -- Calculate working days (excluding weekends and holidays)
  working_days := count_working_days(p_start_date, p_end_date);
  date_range_length := p_end_date - p_start_date + 1;
  
  -- Handle half days
  IF p_is_half_day THEN
    result_actual_days := 0.5;
  ELSE
    result_actual_days := working_days;
  END IF;
  
  result_deducted_days := result_actual_days;
  
  -- Check if it's a sudden leave (applied on or after start date)
  is_sudden_leave := p_applied_at::date >= p_start_date;
  
  -- Case 1: Friday + Saturday + Sunday (3 days)
  IF is_friday(p_start_date) AND date_range_length = 3 AND p_end_date = p_start_date + 2 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Friday + Saturday + Sunday (4 days deducted)';
  
  -- Case 2: Saturday + Sunday + Monday (3 days)
  ELSIF is_monday(p_end_date) AND date_range_length = 3 AND p_start_date = p_end_date - 2 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Saturday + Sunday + Monday (4 days deducted)';
  
  -- Case 3: Friday to Monday (continuous 4-day block)
  ELSIF is_friday(p_start_date) AND is_monday(p_end_date) AND date_range_length = 4 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Friday to Monday continuous (4 days deducted)';
  
  -- Case 4: Individual Friday and Monday leaves (non-continuous with 3-day gap)
  ELSIF (is_friday(p_start_date) OR is_monday(p_start_date)) AND p_start_date = p_end_date THEN
    -- Check if there's a corresponding Friday/Monday application exactly 3 days apart
    SELECT EXISTS (
      SELECT 1 FROM leave_applications la
      WHERE la.user_id = p_user_id
      AND la.start_date = la.end_date  -- Single day application
      AND la.status IN ('pending', 'approved')
      AND (
        -- If current application is Friday, look for Monday exactly 3 days later
        (is_friday(p_start_date) AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
        OR
        -- If current application is Monday, look for Friday exactly 3 days earlier  
        (is_monday(p_start_date) AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
      )
    ) INTO has_individual_friday_monday;
    
    -- Individual Friday/Monday sandwich pattern
    IF has_individual_friday_monday THEN
      result_is_sandwich := true;
      result_deducted_days := 2; -- Each application gets 2 days (total 4 across both)
      result_reason := 'Sandwich leave: Individual Friday/Monday pattern (2 days each, 4 total)';
    
    -- Single Friday or Monday without pair
    ELSIF is_friday(p_start_date) OR is_monday(p_start_date) THEN
      IF p_status = 'approved' THEN
        -- Approved single Friday/Monday = 1 day only
        result_deducted_days := 1;
        result_reason := 'Single Friday/Monday leave (approved - 1 day)';
      ELSIF is_sudden_leave OR p_status != 'approved' THEN
        -- Unapproved/sudden single Friday/Monday = 3 days sandwich penalty
        result_is_sandwich := true;
        result_deducted_days := 3;
        result_reason := 'Single Friday/Monday leave (unapproved/sudden - 3 days penalty)';
      ELSE
        result_deducted_days := 1;
        result_reason := 'Single Friday/Monday leave (1 day)';
      END IF;
    ELSE
      -- Regular single day leave (not Friday/Monday)
      result_deducted_days := result_actual_days;
      result_reason := 'Single day leave (actual working days)';
    END IF;
  
  -- Default case: Regular leave calculation
  ELSE
    result_deducted_days := result_actual_days;
    result_reason := 'Regular leave (actual working days excluding holidays)';
  END IF;
  
  RETURN QUERY SELECT result_actual_days, result_deducted_days, result_is_sandwich, result_reason;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 2. UPDATE LEAVE BALANCE TRIGGER WITH SANDWICH CALCULATION
-- ========================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

-- Create updated function that uses sandwich leave calculation
CREATE OR REPLACE FUNCTION update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  days_to_add_to_used numeric;
  sandwich_calculation record;
  current_allocated numeric;
  current_used numeric;
BEGIN
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_to_add_to_used := 0;
    
    -- If changing from approved to something else, restore days (reduce used_days)
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      -- Use the original deducted days (stored in the application)
      days_to_add_to_used := -COALESCE(NEW.sandwich_deducted_days, NEW.days_count);
    -- If changing to approved from something else, deduct days (increase used_days)
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      -- Calculate sandwich leave deduction
      SELECT * INTO sandwich_calculation 
      FROM calculate_sandwich_leave_deduction(
        NEW.user_id,
        NEW.start_date,
        NEW.end_date,
        NEW.is_half_day,
        NEW.status,
        NEW.applied_at
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
    END IF;
    
    -- Update the leave balance if there's a change
    IF days_to_add_to_used != 0 THEN
      -- Get current balance to ensure we don't exceed limits
      SELECT allocated_days, used_days INTO current_allocated, current_used
      FROM leave_balances
      WHERE user_id = NEW.user_id 
        AND leave_type_id = NEW.leave_type_id 
        AND year = EXTRACT(YEAR FROM NEW.start_date);
      
      -- Only update if a balance record exists
      IF FOUND THEN
        -- Calculate new used_days and ensure it doesn't go negative or exceed allocated
        UPDATE leave_balances SET
          used_days = GREATEST(0, LEAST(current_allocated, current_used + days_to_add_to_used)),
          updated_at = now()
        WHERE user_id = NEW.user_id 
          AND leave_type_id = NEW.leave_type_id 
          AND year = EXTRACT(YEAR FROM NEW.start_date);
        
        -- Log a warning if the operation would exceed allocated days
        IF current_used + days_to_add_to_used > current_allocated THEN
          RAISE WARNING 'Leave deduction would exceed allocated days for user %. Used: %, Allocated: %, Attempted change: %', 
            NEW.user_id, current_used, current_allocated, days_to_add_to_used;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. ADD COLUMNS TO LEAVE_APPLICATIONS TABLE AND CONSTRAINTS
-- ========================================

-- Add columns to store sandwich leave calculation results
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS sandwich_deducted_days numeric,
ADD COLUMN IF NOT EXISTS sandwich_reason text,
ADD COLUMN IF NOT EXISTS is_sandwich_leave boolean DEFAULT false;

-- Clean up existing data before adding constraints
-- Fix any negative used_days values
UPDATE leave_balances 
SET used_days = 0 
WHERE used_days < 0;

-- Fix any used_days that exceed allocated_days
UPDATE leave_balances 
SET used_days = allocated_days 
WHERE used_days > allocated_days;

-- Add constraint to ensure used_days is not negative
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leave_balances_used_not_negative'
  ) THEN
    ALTER TABLE leave_balances 
    ADD CONSTRAINT leave_balances_used_not_negative 
    CHECK (used_days >= 0);
  END IF;
END $$;

-- Add constraint to ensure used_days never exceeds allocated_days
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leave_balances_used_not_exceed_allocated'
  ) THEN
    ALTER TABLE leave_balances 
    ADD CONSTRAINT leave_balances_used_not_exceed_allocated 
    CHECK (used_days <= allocated_days);
  END IF;
END $$;

-- ========================================
-- 4. RECREATE THE TRIGGER
-- ========================================

-- Recreate the trigger with the updated function
CREATE TRIGGER trigger_update_leave_balance_on_status_change
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_status_change();

-- ========================================
-- 5. UPDATE WITHDRAWAL TRIGGER FOR SANDWICH LEAVES
-- ========================================

-- Update the withdrawal trigger to handle sandwich leave deductions
CREATE OR REPLACE FUNCTION restore_leave_balance_on_withdrawal()
RETURNS TRIGGER AS $$
DECLARE
  current_used numeric;
  days_to_restore numeric;
BEGIN
    -- Only restore balance if the leave was previously approved
    IF NEW.status = 'withdrawn' AND OLD.status = 'approved' THEN
        -- Calculate days to restore
        days_to_restore := COALESCE(NEW.sandwich_deducted_days, NEW.days_count);
        
        -- Get current used days
        SELECT used_days INTO current_used
        FROM leave_balances
        WHERE user_id = NEW.user_id
        AND EXTRACT(YEAR FROM NEW.start_date) = year;
        
        -- Only update if balance record exists and we have used days to restore
        IF FOUND AND current_used > 0 THEN
            UPDATE leave_balances
            SET 
                used_days = GREATEST(0, current_used - days_to_restore),
                updated_at = NOW()
            WHERE user_id = NEW.user_id
            AND EXTRACT(YEAR FROM NEW.start_date) = year;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. CREATE HELPER FUNCTION FOR FRONTEND
-- ========================================

-- Function to preview sandwich leave calculation before application
CREATE OR REPLACE FUNCTION preview_sandwich_leave_calculation(
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false
)
RETURNS TABLE(
  actual_days numeric,
  deducted_days numeric,
  is_sandwich_leave boolean,
  reason text,
  details jsonb
) AS $$
DECLARE
  calculation record;
  working_days integer;
  weekend_days integer;
  holiday_days integer;
  total_days integer;
  date_val date;
BEGIN
  -- Get the sandwich calculation
  SELECT * INTO calculation 
  FROM calculate_sandwich_leave_deduction(
    p_user_id,
    p_start_date,
    p_end_date,
    p_is_half_day,
    'pending', -- Assume pending for preview
    now()
  );
  
  -- Calculate detailed breakdown
  total_days := p_end_date - p_start_date + 1;
  working_days := count_working_days(p_start_date, p_end_date);
  
  -- Count weekends
  weekend_days := 0;
  FOR date_val IN SELECT generate_date_range(p_start_date, p_end_date)
  LOOP
    IF is_weekend(date_val) THEN
      weekend_days := weekend_days + 1;
    END IF;
  END LOOP;
  
  -- Count holidays
  holiday_days := 0;
  FOR date_val IN SELECT generate_date_range(p_start_date, p_end_date)
  LOOP
    IF is_national_holiday(date_val) THEN
      holiday_days := holiday_days + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    calculation.actual_days,
    calculation.deducted_days,
    calculation.is_sandwich_leave,
    calculation.reason,
    jsonb_build_object(
      'total_days', total_days,
      'working_days', working_days,
      'weekend_days', weekend_days,
      'holiday_days', holiday_days,
      'sandwich_days', GREATEST(0, calculation.deducted_days - calculation.actual_days)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 7. FUNCTION TO RECALCULATE EXISTING APPROVED APPLICATIONS
-- ========================================

-- Function to recalculate sandwich leave for existing approved applications
CREATE OR REPLACE FUNCTION recalculate_existing_sandwich_leaves()
RETURNS TEXT AS $$
DECLARE
  app_record RECORD;
  calculation RECORD;
  total_updated INTEGER := 0;
BEGIN
  -- Find all approved leave applications that might need recalculation
  FOR app_record IN 
    SELECT * FROM leave_applications 
    WHERE status = 'approved' 
    AND (sandwich_deducted_days IS NULL OR sandwich_deducted_days != days_count)
  LOOP
    -- Calculate correct sandwich leave deduction
    SELECT * INTO calculation 
    FROM calculate_sandwich_leave_deduction(
      app_record.user_id,
      app_record.start_date,
      app_record.end_date,
      app_record.is_half_day,
      app_record.status,
      app_record.applied_at
    );
    
    -- Update the application record if calculation differs
    IF calculation.deducted_days != COALESCE(app_record.sandwich_deducted_days, app_record.days_count) THEN
      -- Calculate the difference to adjust leave balances
      -- First restore the old deduction, then apply the new one
      DECLARE
        old_deduction numeric := COALESCE(app_record.sandwich_deducted_days, app_record.days_count);
        new_deduction numeric := calculation.deducted_days;
        current_allocated numeric;
        current_used numeric;
      BEGIN
        -- Get current balance
        SELECT allocated_days, used_days INTO current_allocated, current_used
        FROM leave_balances
        WHERE user_id = app_record.user_id 
        AND leave_type_id = app_record.leave_type_id 
        AND year = EXTRACT(YEAR FROM app_record.start_date);
        
        IF FOUND THEN
          -- Calculate new used_days: remove old deduction, add new deduction
          UPDATE leave_balances 
          SET used_days = GREATEST(0, LEAST(current_allocated, current_used - old_deduction + new_deduction)),
              updated_at = now()
          WHERE user_id = app_record.user_id 
          AND leave_type_id = app_record.leave_type_id 
          AND year = EXTRACT(YEAR FROM app_record.start_date);
        END IF;
      END;
      
      -- Update the application record
      UPDATE leave_applications 
      SET 
        sandwich_deducted_days = calculation.deducted_days,
        sandwich_reason = calculation.reason,
        is_sandwich_leave = calculation.is_sandwich_leave,
        updated_at = now()
      WHERE id = app_record.id;
      
      total_updated := total_updated + 1;
    END IF;
  END LOOP;
  
  RETURN 'Recalculated ' || total_updated || ' leave applications with corrected sandwich leave logic.';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_sandwich_leave_deduction TO authenticated;
GRANT EXECUTE ON FUNCTION preview_sandwich_leave_calculation TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_existing_sandwich_leaves TO authenticated;
GRANT EXECUTE ON FUNCTION is_friday TO authenticated;
GRANT EXECUTE ON FUNCTION is_monday TO authenticated;
GRANT EXECUTE ON FUNCTION is_weekend TO authenticated;
GRANT EXECUTE ON FUNCTION is_national_holiday TO authenticated;
