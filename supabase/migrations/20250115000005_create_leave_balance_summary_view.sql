/*
  # Create Leave Balance RPC Function
  
  This migration creates an RPC function that provides a comprehensive summary
  of leave balances for all employees, avoiding view column conflicts.
*/

-- Drop the view if it exists
DROP VIEW IF EXISTS leave_balance_summary;

-- Create RPC function to get all employees' leave balances
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
      get_monthly_leave_rate(u.date_of_joining) as monthly_rate,
      can_carry_forward_leaves(u.date_of_joining) as can_carry_forward,
      get_next_anniversary_date(u.date_of_joining) as anniversary_reset_date,
      (EXTRACT(MONTH FROM u.date_of_joining) = EXTRACT(MONTH FROM CURRENT_DATE) 
       AND EXTRACT(DAY FROM u.date_of_joining) = EXTRACT(DAY FROM CURRENT_DATE)) as is_anniversary_today
    FROM users u
    WHERE u.status = 'active'
  ),
  current_year_balances AS (
    SELECT 
      lb.user_id,
      lb.allocated_days,
      lb.used_days,
      (lb.allocated_days - lb.used_days) as remaining_days,
      lb.carry_forward_from_previous_year,
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

-- Create indexes on underlying tables if they don't exist (for better performance)
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year_type ON leave_balances(user_id, year, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_users_status_joining ON users(status, date_of_joining) WHERE status = 'active';

-- Add comment
COMMENT ON FUNCTION get_all_employees_leave_balances IS 'Returns comprehensive leave balance data for all active employees';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_employees_leave_balances TO authenticated;