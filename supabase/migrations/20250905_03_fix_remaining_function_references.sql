-- Fix Remaining Function References
-- This migration updates functions that still reference removed automatic functions

-- ========================================
-- 1. UPDATE get_all_employees_leave_balances FUNCTION
-- ========================================

-- Update the function to remove references to removed automatic functions
CREATE OR REPLACE FUNCTION get_all_employees_leave_balances(p_year integer DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  employee_id text,
  email text,
  date_of_joining date,
  tenure_months integer,
  monthly_rate numeric,
  can_carry_forward boolean,
  anniversary_reset_date date,
  is_anniversary_today boolean,
  year integer,
  allocated_days integer,
  used_days integer,
  remaining_days integer,
  carry_forward_from_previous_year integer,
  balance_created_at timestamptz,
  balance_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_year integer;
BEGIN
  -- Use current year if not specified
  target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  
  RETURN QUERY
  WITH user_info AS (
    SELECT 
      u.id as user_id,
      u.full_name,
      u.employee_id,
      u.email,
      u.date_of_joining,
      get_tenure_months(u.date_of_joining) as tenure_months,
      0::numeric as monthly_rate, -- Set to 0 since HR manages allocations manually
      false as can_carry_forward, -- Set to false since HR manages carry-forwards manually
      NULL::date as anniversary_reset_date, -- Set to NULL since HR manages resets manually
      false as is_anniversary_today -- Set to false since not relevant for manual allocation
    FROM users u
    WHERE u.status = 'active'
  ),
  current_year_balances AS (
    SELECT 
      lb.user_id,
      lb.allocated_days,
      lb.used_days,
      (lb.allocated_days - lb.used_days) as remaining_days,
      0 as carry_forward_from_previous_year, -- Set to 0 since column was removed
      lb.created_at as balance_created_at,
      lb.updated_at as balance_updated_at
    FROM leave_balances lb
    INNER JOIN leave_types lt ON lb.leave_type_id = lt.id
    WHERE lt.name = 'Annual Leave'
      AND lb.year = target_year
  )
  SELECT 
    ui.user_id,
    ui.full_name,
    ui.employee_id,
    ui.email,
    ui.date_of_joining,
    ui.tenure_months,
    ui.monthly_rate,
    ui.can_carry_forward,
    ui.anniversary_reset_date,
    ui.is_anniversary_today,
    target_year as year,
    COALESCE(cyb.allocated_days, 0) as allocated_days,
    COALESCE(cyb.used_days, 0) as used_days,
    COALESCE(cyb.remaining_days, 0) as remaining_days,
    COALESCE(cyb.carry_forward_from_previous_year, 0) as carry_forward_from_previous_year,
    COALESCE(cyb.balance_created_at, ui.date_of_joining::timestamptz) as balance_created_at,
    COALESCE(cyb.balance_updated_at, ui.date_of_joining::timestamptz) as balance_updated_at
  FROM user_info ui
  LEFT JOIN current_year_balances cyb ON ui.user_id = cyb.user_id
  ORDER BY ui.full_name;
END;
$$;

-- ========================================
-- 2. UPDATE get_user_leave_summary FUNCTION
-- ========================================

-- Replace the function to remove references to removed automatic functions and columns
CREATE OR REPLACE FUNCTION get_user_leave_summary(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_data record;
  balance_data record;
  annual_leave_type_id uuid;
  result jsonb;
BEGIN
  -- Get user basic info
  SELECT id, full_name, email, date_of_joining, status
  INTO user_data
  FROM users 
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get annual leave type
  SELECT id INTO annual_leave_type_id
  FROM leave_types WHERE name = 'Annual Leave' LIMIT 1;
  
  IF annual_leave_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Annual Leave type not found');
  END IF;
  
  -- Get balance data for current year
  SELECT 
    allocated_days,
    used_days,
    remaining_days
  INTO balance_data
  FROM leave_balances
  WHERE user_id = p_user_id 
    AND leave_type_id = annual_leave_type_id
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Build response
  result := jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_data.id,
      'full_name', user_data.full_name,
      'email', user_data.email,
      'date_of_joining', user_data.date_of_joining,
      'tenure_months', get_tenure_months(user_data.date_of_joining)
    ),
    'balance', CASE 
      WHEN balance_data IS NOT NULL THEN
        jsonb_build_object(
          'allocated_days', balance_data.allocated_days,
          'used_days', balance_data.used_days,
          'remaining_days', balance_data.remaining_days
        )
      ELSE
        jsonb_build_object(
          'allocated_days', 0,
          'used_days', 0,
          'remaining_days', 0
        )
    END,
    'rules', jsonb_build_object(
      'note', 'Leave allocations are managed manually by HR once a year',
      'can_apply_for_leaves', true,
      'eligible_for_paid_leaves', CASE 
        WHEN balance_data IS NOT NULL AND balance_data.allocated_days > 0 THEN true
        ELSE false
      END,
      'salary_deduction_warning', CASE 
        WHEN balance_data IS NULL OR balance_data.allocated_days = 0 THEN 
          'No leave allocation found. Contact HR for allocation. All leaves will be deducted from salary.'
        WHEN balance_data.remaining_days <= 0 THEN 
          'Leave balance exhausted. Additional leaves will be deducted from salary.'
        ELSE NULL
      END
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 3. UPDATE COMMENTS
-- ========================================

COMMENT ON FUNCTION get_all_employees_leave_balances IS 'Returns leave balance data for all active employees. Leave allocations are managed manually by HR.';
COMMENT ON FUNCTION get_user_leave_summary IS 'Returns user leave summary. Leave allocations are managed manually by HR once a year.';

-- ========================================
-- COMPLETION LOG
-- ========================================

DO $$
BEGIN
  RAISE NOTICE 'Fixed remaining function references to removed automatic functions.';
  RAISE NOTICE 'get_all_employees_leave_balances and get_user_leave_summary updated for manual allocation system.';
END;
$$;
