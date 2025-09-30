-- Drop the existing function to recreate it with correct types
DROP FUNCTION IF EXISTS get_all_employees_leave_balances;

-- Recreate the function with numeric types
CREATE OR REPLACE FUNCTION get_all_employees_leave_balances(p_year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer)
RETURNS TABLE (
  user_id uuid,
  employee_id text,
  full_name text,
  email text,
  manager_id uuid,
  tenure_months numeric,
  monthly_rate numeric,
  allocated_days numeric,
  used_days numeric,
  remaining_days numeric,
  carry_forward_from_previous_year numeric,
  anniversary_reset_date date,
  is_anniversary_today boolean
) AS $$
BEGIN
  RETURN QUERY
  WITH user_tenure AS (
    SELECT 
      u.id,
      u.employee_id,
      u.full_name,
      u.email,
      u.manager_id,
      get_tenure_months(u.date_of_joining)::numeric as tenure_months,
      CASE 
        WHEN get_tenure_months(u.date_of_joining)::numeric >= 12 THEN 2.0::numeric
        ELSE 1.5::numeric
      END as monthly_rate,
      u.date_of_joining,
      (u.date_of_joining + INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.date_of_joining)))::date as anniversary_date,
      CURRENT_DATE = (u.date_of_joining + INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM u.date_of_joining)))::date as is_anniversary
    FROM users u
    WHERE u.role_id IS NOT NULL
  )
  SELECT 
    ut.id as user_id,
    ut.employee_id,
    ut.full_name,
    ut.email,
    ut.manager_id,
    ut.tenure_months,
    ut.monthly_rate,
    COALESCE(lb.allocated_days, 0::numeric) as allocated_days,
    COALESCE(lb.used_days, 0::numeric) as used_days,
    COALESCE(lb.allocated_days - lb.used_days, 0::numeric) as remaining_days,
    COALESCE(lb.carry_forward_from_previous_year, 0::numeric) as carry_forward_from_previous_year,
    ut.anniversary_date as anniversary_reset_date,
    ut.is_anniversary as is_anniversary_today
  FROM user_tenure ut
  LEFT JOIN leave_balances lb ON 
    lb.user_id = ut.id AND 
    lb.year = p_year AND
    lb.leave_type_id = (
      SELECT id FROM leave_types 
      WHERE LOWER(name) IN ('total leave', 'total', 'annual leave') 
      ORDER BY created_at 
      LIMIT 1
    )
  ORDER BY ut.full_name;
END;
$$ LANGUAGE plpgsql;