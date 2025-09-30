/*
  # Allow Leave Applications for Users with < 9 Months Tenure
  
  This migration fixes the system to allow users with < 9 months tenure to apply for leave,
  but their entire leave will be deducted from salary since they have 0 leave allocation.
  
  Changes:
  1. Ensure ALL users get leave balance records (even with 0 allocated days)
  2. Remove tenure restrictions from leave application process
  3. Update functions to handle < 9 months tenure users properly
*/

-- Update the leave balance initialization to include ALL users, even those with < 9 months tenure
CREATE OR REPLACE FUNCTION update_user_leave_balance(p_user_id uuid, p_year integer DEFAULT NULL)
RETURNS void AS $$
DECLARE
  user_joining_date date;
  current_year integer;
  monthly_rate decimal(3,1);
  tenure_months integer;
  can_carry_forward boolean;
  anniversary_date date;
  months_to_credit integer;
  total_credits decimal(10,1);
  existing_balance_id uuid;
  annual_leave_type_id uuid;
BEGIN
  -- Use current year if not specified
  IF p_year IS NULL THEN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  ELSE
    current_year := p_year;
  END IF;
  
  -- Get user's joining date
  SELECT date_of_joining INTO user_joining_date
  FROM users 
  WHERE id = p_user_id;
  
  IF user_joining_date IS NULL THEN
    RAISE NOTICE 'User % has no joining date, skipping leave balance update', p_user_id;
    RETURN;
  END IF;
  
  -- Get annual leave type (we'll create balances for this type)
  SELECT id INTO annual_leave_type_id
  FROM leave_types 
  WHERE name = 'Annual Leave'
  LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'Annual Leave type not found in leave_types table';
  END IF;
  
  -- Calculate tenure and leave rates
  tenure_months := get_tenure_months(user_joining_date);
  monthly_rate := get_monthly_leave_rate(user_joining_date);
  can_carry_forward := can_carry_forward_leaves(user_joining_date);
  anniversary_date := get_next_anniversary_date(user_joining_date);
  
  -- Calculate how many months to credit for this year
  -- If joining year is current year, only credit from joining month onwards
  IF EXTRACT(YEAR FROM user_joining_date) = current_year THEN
    months_to_credit := 12 - EXTRACT(MONTH FROM user_joining_date) + 1;
  ELSE
    months_to_credit := 12;
  END IF;
  
  -- Calculate total credits for the year (can be 0 for < 9 months tenure)
  total_credits := monthly_rate * months_to_credit;
  
  -- Check if balance record already exists
  SELECT id INTO existing_balance_id
  FROM leave_balances
  WHERE user_id = p_user_id 
    AND leave_type_id = annual_leave_type_id 
    AND year = current_year;
  
  -- Insert or update the leave balance (even if credits are 0)
  IF existing_balance_id IS NOT NULL THEN
    -- Update existing record
    UPDATE leave_balances SET
      allocated_days = GREATEST(0, total_credits::integer),
      monthly_credit_rate = monthly_rate,
      anniversary_reset_date = anniversary_date,
      updated_at = now()
    WHERE id = existing_balance_id;
  ELSE
    -- Insert new record (even for users with 0 credits)
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
      p_user_id,
      annual_leave_type_id,
      current_year,
      GREATEST(0, total_credits::integer), -- Can be 0 for < 9 months tenure
      0,
      monthly_rate,
      CURRENT_DATE,
      0,
      anniversary_date
    );
  END IF;
  
  RAISE NOTICE 'Updated leave balance for user % - Tenure: % months, Rate: %/month, Credits: % (including 0-credit users)', 
    p_user_id, tenure_months, monthly_rate, total_credits;
END;
$$ LANGUAGE plpgsql;

-- Update monthly credit function to process ALL users (not just those with > 0 rate)
CREATE OR REPLACE FUNCTION credit_monthly_leaves()
RETURNS void AS $$
DECLARE
  user_record record;
  current_month date;
  monthly_rate decimal(3,1);
  annual_leave_type_id uuid;
BEGIN
  current_month := date_trunc('month', CURRENT_DATE)::date;
  
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types 
  WHERE name = 'Annual Leave'
  LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RAISE EXCEPTION 'Annual Leave type not found in leave_types table';
  END IF;
  
  -- Loop through ALL active users with joining dates (including < 9 months tenure)
  FOR user_record IN 
    SELECT id, date_of_joining, full_name
    FROM users 
    WHERE status = 'active' 
      AND date_of_joining IS NOT NULL
  LOOP
    monthly_rate := get_monthly_leave_rate(user_record.date_of_joining);
    
    -- Process even users with 0 rate to ensure they have balance records
    -- Check if we've already credited for this month
    IF NOT EXISTS (
      SELECT 1 FROM leave_balances 
      WHERE user_id = user_record.id 
        AND leave_type_id = annual_leave_type_id
        AND year = EXTRACT(YEAR FROM CURRENT_DATE)
        AND last_credited_month >= current_month
    ) THEN
      -- Update the allocated days and last credited month (even if rate is 0)
      UPDATE leave_balances SET
        allocated_days = allocated_days + monthly_rate::integer, -- Can add 0
        last_credited_month = current_month,
        updated_at = now()
      WHERE user_id = user_record.id 
        AND leave_type_id = annual_leave_type_id
        AND year = EXTRACT(YEAR FROM CURRENT_DATE);
      
      -- If no record exists, create it (including for < 9 months tenure users)
      IF NOT FOUND THEN
        PERFORM update_user_leave_balance(user_record.id);
      END IF;
      
      IF monthly_rate > 0 THEN
        RAISE NOTICE 'Credited % leaves to % for month %', 
          monthly_rate, user_record.full_name, current_month;
      ELSE
        RAISE NOTICE 'Processed % (0 credits - tenure < 9 months) for month %', 
          user_record.full_name, current_month;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update the user leave summary function to properly indicate salary deduction scenarios
CREATE OR REPLACE FUNCTION get_user_leave_summary(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_info record;
  balance_info record;
  annual_leave_type_id uuid;
  result jsonb;
  tenure_months integer;
  next_credit_date date;
  eligible_for_paid_leaves boolean;
BEGIN
  -- Get user information
  SELECT id, full_name, date_of_joining, status INTO user_info
  FROM users WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types WHERE name = 'Annual Leave' LIMIT 1;
  
  -- Calculate tenure and eligibility
  tenure_months := get_tenure_months(user_info.date_of_joining);
  eligible_for_paid_leaves := get_monthly_leave_rate(user_info.date_of_joining) > 0;
  
  -- Calculate next credit date (1st of next month)
  next_credit_date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date;
  
  -- Get balance information (create if doesn't exist)
  SELECT 
    allocated_days,
    used_days,
    remaining_days,
    monthly_credit_rate,
    carry_forward_from_previous_year,
    anniversary_reset_date,
    last_credited_month
  INTO balance_info
  FROM leave_balances 
  WHERE user_id = p_user_id 
    AND leave_type_id = annual_leave_type_id 
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- If no balance exists, create one (even for < 9 months tenure)
  IF NOT FOUND THEN
    PERFORM update_user_leave_balance(p_user_id);
    
    -- Try to get it again
    SELECT 
      allocated_days,
      used_days,
      remaining_days,
      monthly_credit_rate,
      carry_forward_from_previous_year,
      anniversary_reset_date,
      last_credited_month
    INTO balance_info
    FROM leave_balances 
    WHERE user_id = p_user_id 
      AND leave_type_id = annual_leave_type_id 
      AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  END IF;
  
  result := jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_info.id,
      'full_name', user_info.full_name,
      'date_of_joining', user_info.date_of_joining,
      'status', user_info.status,
      'tenure_months', tenure_months
    ),
    'balance', CASE 
      WHEN balance_info IS NOT NULL THEN
        jsonb_build_object(
          'allocated_days', balance_info.allocated_days,
          'used_days', balance_info.used_days,
          'remaining_days', balance_info.remaining_days,
          'monthly_credit_rate', balance_info.monthly_credit_rate,
          'carry_forward_from_previous_year', balance_info.carry_forward_from_previous_year,
          'anniversary_reset_date', balance_info.anniversary_reset_date,
          'last_credited_month', balance_info.last_credited_month
        )
      ELSE
        jsonb_build_object('message', 'No balance record found')
    END,
    'rules', jsonb_build_object(
      'current_monthly_rate', get_monthly_leave_rate(user_info.date_of_joining),
      'can_carry_forward', can_carry_forward_leaves(user_info.date_of_joining),
      'next_credit_date', next_credit_date,
      'eligible_for_paid_leaves', eligible_for_paid_leaves,
      'can_apply_for_leaves', true, -- Always true, but may result in salary deduction
      'salary_deduction_warning', CASE 
        WHEN NOT eligible_for_paid_leaves THEN 'All leaves will be deducted from salary (tenure < 9 months)'
        ELSE NULL
      END
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Ensure ALL existing users have leave balance records (including < 9 months tenure)
DO $$
DECLARE
  user_record record;
BEGIN
  FOR user_record IN 
    SELECT id, full_name, date_of_joining
    FROM users 
    WHERE status = 'active' 
      AND date_of_joining IS NOT NULL
  LOOP
    BEGIN
      PERFORM update_user_leave_balance(user_record.id);
      RAISE NOTICE 'Ensured leave balance exists for % (including 0-credit users)', user_record.full_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create leave balance for %: %', user_record.full_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Update function comments
COMMENT ON FUNCTION update_user_leave_balance(uuid, integer) IS 'Creates leave balance for ALL users, including those with <9mo tenure (0 credits)';
COMMENT ON FUNCTION credit_monthly_leaves() IS 'Processes ALL users monthly, including <9mo tenure users (0 credits)';
COMMENT ON FUNCTION get_user_leave_summary(uuid) IS 'Returns leave summary for any user, with salary deduction warnings for <9mo tenure';
