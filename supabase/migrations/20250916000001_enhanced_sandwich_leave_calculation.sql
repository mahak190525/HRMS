-- Enhanced Sandwich Leave Calculation
-- This migration enhances the existing sandwich leave calculation with refined business rules
-- Based on the detailed requirements for Friday-Monday sandwich leave patterns

-- ========================================
-- 1. ENHANCED SANDWICH LEAVE CALCULATION FUNCTION
-- ========================================

-- Drop existing function to recreate with enhanced logic
DROP FUNCTION IF EXISTS calculate_sandwich_leave_deduction(uuid, date, date, boolean, text, timestamptz);

-- Enhanced main sandwich leave calculation function with refined business rules
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
  has_separate_friday_monday boolean;
  friday_app_id uuid;
  monday_app_id uuid;
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
  
  -- RULE 1: Continuous leave from Friday to Monday → Deduct 4 days (Sandwich leave)
  IF is_friday(p_start_date) AND is_monday(p_end_date) AND date_range_length = 4 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Continuous Friday to Monday (4 days deducted)';
    
  -- RULE 2: Friday + Weekend (Fri-Sat-Sun) → Deduct 4 days
  ELSIF is_friday(p_start_date) AND date_range_length = 3 AND p_end_date = p_start_date + 2 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Friday + Weekend (4 days deducted)';
  
  -- RULE 3: Weekend + Monday (Sat-Sun-Mon) → Deduct 4 days  
  ELSIF is_monday(p_end_date) AND date_range_length = 3 AND p_start_date = p_end_date - 2 THEN
    result_is_sandwich := true;
    result_deducted_days := 4;
    result_reason := 'Sandwich leave: Weekend + Monday (4 days deducted)';
  
  -- RULE 4: Separate applications for Friday and next Monday → Treat as Sandwich leave → Deduct 4 days total
  ELSIF (is_friday(p_start_date) OR is_monday(p_start_date)) AND p_start_date = p_end_date THEN
    
    -- Check for separate Friday and Monday applications (exactly 3 days apart)
    -- IMPORTANT: Both applications must be APPROVED for sandwich pattern to apply
    SELECT EXISTS (
      SELECT 1 FROM leave_applications la
      WHERE la.user_id = p_user_id
      AND la.start_date = la.end_date  -- Single day application
      AND la.status = 'approved'  -- Only consider approved applications
      AND la.id != COALESCE((
        SELECT id FROM leave_applications 
        WHERE user_id = p_user_id 
        AND start_date = p_start_date 
        AND end_date = p_end_date
        LIMIT 1
      ), '00000000-0000-0000-0000-000000000000')  -- Exclude current application
      AND (
        -- If current application is Friday, look for approved Monday exactly 3 days later
        (is_friday(p_start_date) AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
        OR
        -- If current application is Monday, look for approved Friday exactly 3 days earlier  
        (is_monday(p_start_date) AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
      )
      -- Additional check: Only apply sandwich if current application is also being approved
      AND p_status = 'approved'
    ) INTO has_separate_friday_monday;
    
    -- Handle separate Friday/Monday sandwich pattern
    IF has_separate_friday_monday THEN
      result_is_sandwich := true;
      result_deducted_days := 2; -- Each application gets 2 days (total 4 across both)
      result_reason := 'Sandwich leave: Separate Friday/Monday applications (2 days each, 4 total)';
      
      -- IMPORTANT: When the second application is approved, we need to update the first one
      -- to also apply sandwich leave rules retroactively
    
    -- RULE 5: Single Friday or Monday WITH approval → Deduct 1 day
    ELSIF (is_friday(p_start_date) OR is_monday(p_start_date)) AND p_status = 'approved' THEN
      result_deducted_days := 1;
      result_reason := 'Single Friday/Monday leave (approved - 1 day)';
    
    -- RULE 6: Single Friday or Monday WITHOUT approval → Deduct 3 days (Sandwich penalty)
    ELSIF (is_friday(p_start_date) OR is_monday(p_start_date)) AND p_status != 'approved' THEN
      result_is_sandwich := true;
      result_deducted_days := 3;
      result_reason := 'Single Friday/Monday leave (unapproved - 3 days sandwich penalty)';
    
    -- Regular single day leave (not Friday/Monday)
    ELSE
      result_deducted_days := result_actual_days;
      result_reason := 'Single day leave (actual working days)';
    END IF;
  
  -- Default case: Regular leave calculation (excludes holidays automatically)
  ELSE
    result_deducted_days := result_actual_days;
    result_reason := 'Regular leave (actual working days excluding holidays)';
  END IF;
  
  RETURN QUERY SELECT result_actual_days, result_deducted_days, result_is_sandwich, result_reason;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 2. ENHANCED PREVIEW FUNCTION WITH DETAILED BREAKDOWN
-- ========================================

-- Drop and recreate the preview function with enhanced details
DROP FUNCTION IF EXISTS preview_sandwich_leave_calculation(uuid, date, date, boolean);

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
  has_separate_applications boolean := false;
  separate_app_info text := '';
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
  
  -- Count holidays (excluding weekends)
  holiday_days := 0;
  FOR date_val IN SELECT generate_date_range(p_start_date, p_end_date)
  LOOP
    IF is_national_holiday(date_val) AND NOT is_weekend(date_val) THEN
      holiday_days := holiday_days + 1;
    END IF;
  END LOOP;
  
  -- Check for separate Friday/Monday applications
  IF (is_friday(p_start_date) OR is_monday(p_start_date)) AND p_start_date = p_end_date THEN
    SELECT EXISTS (
      SELECT 1 FROM leave_applications la
      WHERE la.user_id = p_user_id
      AND la.start_date = la.end_date
      AND la.status IN ('pending', 'approved')
      AND (
        (is_friday(p_start_date) AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
        OR
        (is_monday(p_start_date) AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
      )
    ) INTO has_separate_applications;
    
    IF has_separate_applications THEN
      separate_app_info := 'Found matching Friday/Monday application';
    END IF;
  END IF;
  
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
      'sandwich_days', GREATEST(0, calculation.deducted_days - calculation.actual_days),
      'has_separate_applications', has_separate_applications,
      'separate_app_info', separate_app_info,
      'business_rules', jsonb_build_object(
        'continuous_fri_mon', 'Friday to Monday continuous → 4 days',
        'separate_fri_mon', 'Separate Friday + Monday → 2 days each (4 total)',
        'single_approved', 'Single Friday/Monday approved → 1 day',
        'single_unapproved', 'Single Friday/Monday unapproved → 3 days penalty',
        'holidays_excluded', 'National holidays are excluded from deduction'
      )
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 3. FUNCTION TO DETECT RELATED FRIDAY/MONDAY APPLICATIONS
-- ========================================

-- Function to find related Friday/Monday applications for a user
CREATE OR REPLACE FUNCTION find_related_friday_monday_applications(
  p_user_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  related_app_id uuid,
  related_start_date date,
  related_end_date date,
  related_status text,
  relationship_type text,
  combined_deduction numeric
) AS $$
DECLARE
  is_current_friday boolean;
  is_current_monday boolean;
BEGIN
  is_current_friday := is_friday(p_start_date) AND p_start_date = p_end_date;
  is_current_monday := is_monday(p_start_date) AND p_start_date = p_end_date;
  
  -- Only check for single-day Friday or Monday applications
  IF is_current_friday OR is_current_monday THEN
    RETURN QUERY
    SELECT 
      la.id,
      la.start_date,
      la.end_date,
      la.status,
      CASE 
        WHEN is_current_friday AND is_monday(la.start_date) THEN 'friday_to_monday'
        WHEN is_current_monday AND is_friday(la.start_date) THEN 'monday_to_friday'
        ELSE 'unknown'
      END as relationship_type,
      4::numeric as combined_deduction  -- Total deduction across both applications
    FROM leave_applications la
    WHERE la.user_id = p_user_id
    AND la.start_date = la.end_date  -- Single day application
    AND la.status IN ('pending', 'approved')
    AND (
      -- If current is Friday, find Monday 3 days later
      (is_current_friday AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
      OR
      -- If current is Monday, find Friday 3 days earlier
      (is_current_monday AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
    );
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 4. FUNCTION TO HANDLE RETROACTIVE SANDWICH LEAVE UPDATES
-- ========================================

-- Function to update related Friday/Monday applications when sandwich pattern is completed
CREATE OR REPLACE FUNCTION update_related_sandwich_applications(
  p_user_id uuid,
  p_start_date date,
  p_current_app_id uuid
)
RETURNS void AS $$
DECLARE
  related_app_id uuid;
  related_app record;
  new_calculation record;
  old_deduction numeric;
  balance_adjustment numeric;
  current_used numeric;
  current_allocated numeric;
  total_leave_type_id uuid;
BEGIN
  -- Find the related Friday/Monday application
  SELECT id INTO related_app_id
  FROM leave_applications la
  WHERE la.user_id = p_user_id
  AND la.start_date = la.end_date  -- Single day application
  AND la.status = 'approved'
  AND la.id != p_current_app_id
  AND (
    -- If current is Friday, find Monday 3 days later
    (is_friday(p_start_date) AND is_monday(la.start_date) AND la.start_date = p_start_date + 3)
    OR
    -- If current is Monday, find Friday 3 days earlier
    (is_monday(p_start_date) AND is_friday(la.start_date) AND p_start_date = la.start_date + 3)
  );
  
  -- If we found a related application, update it with sandwich calculation
  IF related_app_id IS NOT NULL THEN
    -- Get the related application details
    SELECT * INTO related_app FROM leave_applications WHERE id = related_app_id;
    
    -- Calculate new sandwich deduction for the related app
    SELECT * INTO new_calculation 
    FROM calculate_sandwich_leave_deduction(
      related_app.user_id,
      related_app.start_date,
      related_app.end_date,
      COALESCE(related_app.is_half_day, false),
      related_app.status,
      COALESCE(related_app.applied_at, related_app.created_at)
    );
    
    -- Get the old deduction amount
    old_deduction := COALESCE(related_app.sandwich_deducted_days, related_app.days_count);
    
    -- Update the related application with sandwich calculation
    UPDATE leave_applications 
    SET 
      sandwich_deducted_days = new_calculation.deducted_days,
      sandwich_reason = new_calculation.reason,
      is_sandwich_leave = new_calculation.is_sandwich_leave,
      updated_at = now()
    WHERE id = related_app_id;
    
    -- Adjust the leave balance for the difference
    balance_adjustment := new_calculation.deducted_days - old_deduction;
    
    IF balance_adjustment != 0 THEN
        -- Get the total leave type ID for consistency
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
        
        -- Get current balance (using total leave type)
        SELECT allocated_days, used_days INTO current_allocated, current_used
        FROM leave_balances
        WHERE user_id = related_app.user_id 
        AND leave_type_id = total_leave_type_id 
        AND year = EXTRACT(YEAR FROM related_app.start_date);
        
        IF FOUND THEN
          -- Apply the balance adjustment (using total leave type)
          UPDATE leave_balances 
          SET 
            used_days = current_used + balance_adjustment,
            updated_at = now()
          WHERE user_id = related_app.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM related_app.start_date);
        
        RAISE NOTICE 'Retroactively updated related sandwich application %. Balance adjustment: % days', 
          related_app_id, balance_adjustment;
      END IF;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. ENHANCED LEAVE BALANCE TRIGGER SYSTEM (TOTAL BALANCE ONLY)
-- ========================================

-- Drop existing trigger to recreate with enhanced functionality
DROP TRIGGER IF EXISTS trigger_update_leave_balance_on_status_change ON leave_applications;

-- Enhanced function that uses the new sandwich leave calculation
-- Modified to use TOTAL leave balance regardless of leave type
CREATE OR REPLACE FUNCTION update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  days_to_add_to_used numeric;
  sandwich_calculation record;
  current_allocated numeric;
  current_used numeric;
  balance_record_exists boolean;
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
  
  -- Only process when status changes from/to approved
  IF OLD.status != NEW.status THEN
    days_to_add_to_used := 0;
    
    -- If changing from approved to something else, restore days (reduce used_days)
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      -- Use the original deducted days (stored in the application)
      -- If sandwich_deducted_days is set, use that; otherwise fall back to days_count
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
      
    -- If changing to approved from something else, deduct days (increase used_days)
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      -- Calculate sandwich leave deduction using enhanced function
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

-- Create the trigger
CREATE TRIGGER trigger_update_leave_balance_on_status_change
  AFTER UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_leave_balance_on_status_change();

-- ========================================
-- 5. FUNCTION TO RECALCULATE BALANCES FOR EXISTING APPROVED LEAVES
-- ========================================

-- Function to recalculate all existing approved leaves with correct sandwich calculation
CREATE OR REPLACE FUNCTION recalculate_all_approved_leave_balances()
RETURNS TEXT AS $$
DECLARE
  app_record RECORD;
  sandwich_calc RECORD;
  old_deduction numeric;
  new_deduction numeric;
  balance_adjustment numeric;
  current_used numeric;
  current_allocated numeric;
  total_updated INTEGER := 0;
  total_balance_updated INTEGER := 0;
  total_leave_type_id uuid;
BEGIN
  RAISE NOTICE 'Starting recalculation of all approved leave applications...';
  
  -- Process all approved leave applications
  FOR app_record IN 
    SELECT * FROM leave_applications 
    WHERE status = 'approved'
    ORDER BY applied_at
  LOOP
    -- Calculate correct sandwich leave deduction
    SELECT * INTO sandwich_calc 
    FROM calculate_sandwich_leave_deduction(
      app_record.user_id,
      app_record.start_date,
      app_record.end_date,
      COALESCE(app_record.is_half_day, false),
      app_record.status,
      COALESCE(app_record.applied_at, app_record.created_at)
    );
    
    -- Get old deduction amount
    old_deduction := COALESCE(app_record.sandwich_deducted_days, app_record.days_count);
    new_deduction := sandwich_calc.deducted_days;
    
    -- Update application record if calculation differs
    IF old_deduction != new_deduction OR 
       COALESCE(app_record.sandwich_reason, '') != sandwich_calc.reason OR
       COALESCE(app_record.is_sandwich_leave, false) != sandwich_calc.is_sandwich_leave THEN
      
      UPDATE leave_applications 
      SET 
        sandwich_deducted_days = new_deduction,
        sandwich_reason = sandwich_calc.reason,
        is_sandwich_leave = sandwich_calc.is_sandwich_leave,
        updated_at = now()
      WHERE id = app_record.id;
      
      total_updated := total_updated + 1;
      
      -- Calculate balance adjustment needed
      balance_adjustment := new_deduction - old_deduction;
      
      -- Update leave balance if there's a difference
      IF balance_adjustment != 0 THEN
        -- Get current balance
        -- Get the total leave type ID for consistency
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
        
        SELECT allocated_days, used_days INTO current_allocated, current_used
        FROM leave_balances
        WHERE user_id = app_record.user_id 
        AND leave_type_id = total_leave_type_id 
        AND year = EXTRACT(YEAR FROM app_record.start_date);
        
        IF FOUND THEN
          -- Apply the adjustment (using total leave type)
          UPDATE leave_balances 
          SET 
            used_days = current_used + balance_adjustment,
            updated_at = now()
          WHERE user_id = app_record.user_id 
          AND leave_type_id = total_leave_type_id 
          AND year = EXTRACT(YEAR FROM app_record.start_date);
          
          total_balance_updated := total_balance_updated + 1;
          
          RAISE NOTICE 'Updated balance for user %: old_deduction=%, new_deduction=%, adjustment=%, new_used=%', 
            app_record.user_id, old_deduction, new_deduction, balance_adjustment, current_used + balance_adjustment;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN format('Recalculation complete. Updated %s leave applications and %s leave balances with correct sandwich calculations.', 
    total_updated, total_balance_updated);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. GRANT PERMISSIONS
-- ========================================

GRANT EXECUTE ON FUNCTION calculate_sandwich_leave_deduction TO authenticated;
GRANT EXECUTE ON FUNCTION preview_sandwich_leave_calculation TO authenticated;
GRANT EXECUTE ON FUNCTION find_related_friday_monday_applications TO authenticated;
GRANT EXECUTE ON FUNCTION update_related_sandwich_applications TO authenticated;
GRANT EXECUTE ON FUNCTION update_leave_balance_on_status_change TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_approved_leave_balances TO authenticated;

-- ========================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION calculate_sandwich_leave_deduction IS 
'Enhanced sandwich leave calculation with business rules:
1. Continuous Friday-Monday → 4 days
2. Separate Friday + Monday applications → 2 days each (4 total)
3. Single Friday/Monday approved → 1 day
4. Single Friday/Monday unapproved → 3 days penalty
5. National holidays excluded from deduction';

COMMENT ON FUNCTION preview_sandwich_leave_calculation IS 
'Preview sandwich leave calculation for UI with detailed breakdown and business rule explanations';

COMMENT ON FUNCTION find_related_friday_monday_applications IS 
'Find related Friday/Monday applications that form sandwich leave patterns';

COMMENT ON FUNCTION update_related_sandwich_applications IS 
'Retroactively update related Friday/Monday applications when sandwich pattern is completed by approving the second application';

COMMENT ON FUNCTION recalculate_all_approved_leave_balances IS 
'Recalculate all existing approved leave applications with correct sandwich leave deductions and update balances accordingly';
