/*
  # Fix Anniversary-Based Leave System
  
  This migration fixes the leave balance system to ensure EVERYTHING happens on the user's work anniversary:
  
  1. For users with < 2 years tenure: Reset balance to 0 on work anniversary
  2. For users with ≥ 2 years tenure: Carry forward remaining balance on work anniversary
  
  This removes the December 31st logic and makes everything individual anniversary-based.
*/

-- Updated function to handle both resets AND carry-forwards on work anniversaries
CREATE OR REPLACE FUNCTION process_anniversary_actions()
RETURNS void AS $$
DECLARE
  user_record record;
  annual_leave_type_id uuid;
  current_year integer;
  current_month integer;
  current_day integer;
  joining_month integer;
  joining_day integer;
  is_anniversary_today boolean;
  next_year integer;
  remaining_leaves integer;
BEGIN
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types 
  WHERE name = 'Annual Leave'
  LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'Annual Leave type not found in leave_types table';
  END IF;
  
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_day := EXTRACT(DAY FROM CURRENT_DATE);
  next_year := current_year + 1;
  
  -- Find ALL users whose anniversary is today (regardless of tenure)
  FOR user_record IN 
    SELECT u.id, u.date_of_joining, u.full_name, lb.id as balance_id, lb.remaining_days
    FROM users u
    JOIN leave_balances lb ON u.id = lb.user_id
    WHERE u.status = 'active' 
      AND u.date_of_joining IS NOT NULL
      AND lb.leave_type_id = annual_leave_type_id
      AND lb.year = current_year
  LOOP
    -- Check if today is the user's actual anniversary date
    joining_month := EXTRACT(MONTH FROM user_record.date_of_joining);
    joining_day := EXTRACT(DAY FROM user_record.date_of_joining);
    
    is_anniversary_today := (current_month = joining_month AND current_day = joining_day);
    
    -- Only process if today is actually their anniversary
    IF is_anniversary_today THEN
      remaining_leaves := user_record.remaining_days;
      
      -- Check if user can carry forward (tenure >= 2 years)
      IF can_carry_forward_leaves(user_record.date_of_joining) THEN
        -- CARRY FORWARD SCENARIO (≥ 2 years tenure)
        
        -- Create or update next year's balance with carry-forward
        INSERT INTO leave_balances (
          user_id, 
          leave_type_id, 
          year, 
          allocated_days, 
          used_days, 
          monthly_credit_rate,
          last_credited_month,
          carry_forward_from_previous_year,
          anniversary_reset_date
        ) VALUES (
          user_record.id,
          annual_leave_type_id,
          next_year,
          GREATEST(0, remaining_leaves), -- Start with carried forward leaves
          0,
          get_monthly_leave_rate(user_record.date_of_joining),
          NULL,
          GREATEST(0, remaining_leaves),
          get_next_anniversary_date(user_record.date_of_joining)
        ) ON CONFLICT (user_id, leave_type_id, year) DO UPDATE SET
          carry_forward_from_previous_year = GREATEST(0, remaining_leaves),
          allocated_days = GREATEST(0, remaining_leaves);
        
        RAISE NOTICE 'Carried forward % leaves for % on their anniversary (% %) - tenure >= 2 years', 
          remaining_leaves, user_record.full_name, joining_month, joining_day;
          
      ELSE
        -- RESET SCENARIO (< 2 years tenure)
        
        -- Reset current year balance to 0
        UPDATE leave_balances SET
          allocated_days = 0,
          used_days = 0,
          carry_forward_from_previous_year = 0,
          anniversary_reset_date = get_next_anniversary_date(user_record.date_of_joining),
          updated_at = now()
        WHERE id = user_record.balance_id;
        
        -- Create fresh balance for next year (starting from 0)
        INSERT INTO leave_balances (
          user_id, 
          leave_type_id, 
          year, 
          allocated_days, 
          used_days, 
          monthly_credit_rate,
          last_credited_month,
          carry_forward_from_previous_year,
          anniversary_reset_date
        ) VALUES (
          user_record.id,
          annual_leave_type_id,
          next_year,
          0, -- Start fresh with 0
          0,
          get_monthly_leave_rate(user_record.date_of_joining),
          NULL,
          0,
          get_next_anniversary_date(user_record.date_of_joining)
        ) ON CONFLICT (user_id, leave_type_id, year) DO UPDATE SET
          allocated_days = 0,
          used_days = 0,
          carry_forward_from_previous_year = 0;
        
        RAISE NOTICE 'Reset leave balance for % on their anniversary (% %) - tenure < 2 years', 
          user_record.full_name, joining_month, joining_day;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Remove the old December 31st carry-forward function (we don't need it anymore)
DROP FUNCTION IF EXISTS process_year_end_carry_forward();

-- Rename the old function for clarity
DROP FUNCTION IF EXISTS process_anniversary_resets();

-- Update the main maintenance function to use the new anniversary-based approach
CREATE OR REPLACE FUNCTION maintain_leave_balances()
RETURNS void AS $$
DECLARE
  current_day integer;
  current_month integer;
  execution_log text := '';
BEGIN
  current_day := EXTRACT(DAY FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  
  execution_log := 'Leave balance maintenance started at ' || now() || E'\n';
  
  -- Run monthly credit on the 1st of each month
  IF current_day = 1 THEN
    BEGIN
      PERFORM credit_monthly_leaves();
      execution_log := execution_log || 'Monthly leave credits processed successfully' || E'\n';
    EXCEPTION WHEN OTHERS THEN
      execution_log := execution_log || 'ERROR in monthly credits: ' || SQLERRM || E'\n';
    END;
  END IF;
  
  -- Run anniversary actions daily (checks for users with anniversary today)
  -- This handles BOTH resets and carry-forwards based on individual anniversaries
  BEGIN
    PERFORM process_anniversary_actions();
    execution_log := execution_log || 'Anniversary actions processed (resets + carry-forwards)' || E'\n';
  EXCEPTION WHEN OTHERS THEN
    execution_log := execution_log || 'ERROR in anniversary actions: ' || SQLERRM || E'\n';
  END;
  
  execution_log := execution_log || 'Leave balance maintenance completed at ' || now();
  
  -- Log the execution (you could store this in a log table if needed)
  RAISE NOTICE '%', execution_log;
END;
$$ LANGUAGE plpgsql;

-- Add a helper function to check if today is someone's anniversary
CREATE OR REPLACE FUNCTION is_anniversary_today(joining_date date)
RETURNS boolean AS $$
DECLARE
  current_month integer;
  current_day integer;
  joining_month integer;
  joining_day integer;
BEGIN
  IF joining_date IS NULL THEN
    RETURN false;
  END IF;
  
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_day := EXTRACT(DAY FROM CURRENT_DATE);
  joining_month := EXTRACT(MONTH FROM joining_date);
  joining_day := EXTRACT(DAY FROM joining_date);
  
  RETURN (current_month = joining_month AND current_day = joining_day);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update comments for documentation
COMMENT ON FUNCTION process_anniversary_actions() IS 'Handles both resets (< 2 years) and carry-forwards (≥ 2 years) on individual work anniversaries';
COMMENT ON FUNCTION maintain_leave_balances() IS 'Main scheduler function: monthly credits on 1st + anniversary actions daily';
COMMENT ON FUNCTION is_anniversary_today(date) IS 'Returns true if the given joining date anniversary is today';
