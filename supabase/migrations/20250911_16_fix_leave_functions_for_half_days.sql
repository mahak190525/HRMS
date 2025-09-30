/*
  # Fix Leave Database Functions for Half Day Support

  This migration updates all database functions that return leave application data
  to use the new numeric types for days_count instead of integer.

  The error "structure of query does not match function result type" occurs because
  the functions still define days_count as integer but the table now uses numeric(3,1).
*/

-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS get_leave_applications_with_manager_details();
DROP FUNCTION IF EXISTS get_leave_applications_for_manager(uuid);
DROP FUNCTION IF EXISTS get_all_employees_leave_balances(integer);

-- Update function to get leave applications with manager details
CREATE OR REPLACE FUNCTION get_leave_applications_with_manager_details()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count numeric(3,1),  -- Changed from integer to numeric(3,1)
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- User details
  user_full_name text,
  user_employee_id text,
  user_email text,
  user_manager_id uuid,
  
  -- Manager details
  manager_id uuid,
  manager_full_name text,
  manager_email text,
  
  -- Leave type details
  leave_type_name text,
  leave_type_description text,
  
  -- Approved by details
  approved_by_full_name text,
  approved_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.user_id,
    la.leave_type_id,
    la.start_date,
    la.end_date,
    la.days_count,
    la.reason,
    la.status,
    la.applied_at,
    la.approved_by,
    la.approved_at,
    la.comments,
    la.created_at,
    la.updated_at,
    
    -- User details
    u.full_name as user_full_name,
    u.employee_id as user_employee_id,
    u.email as user_email,
    u.manager_id as user_manager_id,
    
    -- Manager details
    m.id as manager_id,
    m.full_name as manager_full_name,
    m.email as manager_email,
    
    -- Leave type details
    lt.name as leave_type_name,
    lt.description as leave_type_description,
    
    -- Approved by details
    ab.full_name as approved_by_full_name,
    ab.email as approved_by_email
    
  FROM leave_applications la
  LEFT JOIN users u ON la.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users ab ON la.approved_by = ab.id
  ORDER BY la.created_at DESC;
END;
$$;

-- Update function for specific user's leave applications (for managers viewing their reports)
CREATE OR REPLACE FUNCTION get_leave_applications_for_manager(manager_user_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count numeric(3,1),  -- Changed from integer to numeric(3,1)
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- User details
  user_full_name text,
  user_employee_id text,
  user_email text,
  user_manager_id uuid,
  
  -- Manager details
  manager_id uuid,
  manager_full_name text,
  manager_email text,
  
  -- Leave type details
  leave_type_name text,
  leave_type_description text,
  
  -- Approved by details
  approved_by_full_name text,
  approved_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.user_id,
    la.leave_type_id,
    la.start_date,
    la.end_date,
    la.days_count,
    la.reason,
    la.status,
    la.applied_at,
    la.approved_by,
    la.approved_at,
    la.comments,
    la.created_at,
    la.updated_at,
    
    -- User details
    u.full_name as user_full_name,
    u.employee_id as user_employee_id,
    u.email as user_email,
    u.manager_id as user_manager_id,
    
    -- Manager details
    m.id as manager_id,
    m.full_name as manager_full_name,
    m.email as manager_email,
    
    -- Leave type details
    lt.name as leave_type_name,
    lt.description as leave_type_description,
    
    -- Approved by details
    ab.full_name as approved_by_full_name,
    ab.email as approved_by_email
    
  FROM leave_applications la
  LEFT JOIN users u ON la.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users ab ON la.approved_by = ab.id
  WHERE u.manager_id = manager_user_id
  ORDER BY la.created_at DESC;
END;
$$;

-- Check if there are any other functions that need updating
-- We'll also create a function to get leave applications with half day support
CREATE OR REPLACE FUNCTION get_leave_applications_with_half_day_support()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count numeric(3,1),
  is_half_day boolean,
  half_day_period varchar(10),
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- User details
  user_full_name text,
  user_employee_id text,
  user_email text,
  user_manager_id uuid,
  
  -- Manager details
  manager_id uuid,
  manager_full_name text,
  manager_email text,
  
  -- Leave type details
  leave_type_name text,
  leave_type_description text,
  
  -- Approved by details
  approved_by_full_name text,
  approved_by_email text,
  
  -- Half day display info
  half_day_display text,
  time_range text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    la.id,
    la.user_id,
    la.leave_type_id,
    la.start_date,
    la.end_date,
    la.days_count,
    la.is_half_day,
    la.half_day_period,
    la.reason,
    la.status,
    la.applied_at,
    la.approved_by,
    la.approved_at,
    la.comments,
    la.created_at,
    la.updated_at,
    
    -- User details
    u.full_name as user_full_name,
    u.employee_id as user_employee_id,
    u.email as user_email,
    u.manager_id as user_manager_id,
    
    -- Manager details
    m.id as manager_id,
    m.full_name as manager_full_name,
    m.email as manager_email,
    
    -- Leave type details
    lt.name as leave_type_name,
    lt.description as leave_type_description,
    
    -- Approved by details
    ab.full_name as approved_by_full_name,
    ab.email as approved_by_email,
    
    -- Half day display info
    CASE 
      WHEN la.half_day_period = '1st_half' THEN 'Morning (1st Half)'
      WHEN la.half_day_period = '2nd_half' THEN 'Afternoon (2nd Half)'
      WHEN la.is_half_day = true THEN 'Half Day'
      ELSE 'Full Day'
    END as half_day_display,
    
    CASE 
      WHEN la.half_day_period = '1st_half' THEN '9:00 AM - 1:00 PM'
      WHEN la.half_day_period = '2nd_half' THEN '2:00 PM - 6:00 PM'
      ELSE 'Full Day'
    END as time_range
    
  FROM leave_applications la
  LEFT JOIN users u ON la.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
  LEFT JOIN users ab ON la.approved_by = ab.id
  ORDER BY la.created_at DESC;
END;
$$;

-- Update function to get all employees' leave balances with numeric support
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
  used_days numeric(5,1),  -- Changed from integer to numeric(5,1)
  remaining_days numeric(5,1),  -- Changed from integer to numeric(5,1)
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
      lb.remaining_days,  -- Use the generated column directly
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
    COALESCE(cyb.used_days, 0::numeric(5,1)) as used_days,
    COALESCE(cyb.remaining_days, 0::numeric(5,1)) as remaining_days,
    COALESCE(cyb.carry_forward_from_previous_year, 0) as carry_forward_from_previous_year,
    COALESCE(cyb.balance_created_at, ui.date_of_joining::timestamptz) as balance_created_at,
    COALESCE(cyb.balance_updated_at, ui.date_of_joining::timestamptz) as balance_updated_at
  FROM user_info ui
  LEFT JOIN current_year_balances cyb ON ui.user_id = cyb.user_id
  ORDER BY ui.full_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_leave_applications_with_manager_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_applications_for_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leave_applications_with_half_day_support() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_employees_leave_balances(integer) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_leave_applications_with_manager_details() IS 'Returns leave applications with manager details, supporting half day leaves (numeric days_count)';
COMMENT ON FUNCTION get_leave_applications_for_manager(uuid) IS 'Returns leave applications for a specific manager, supporting half day leaves (numeric days_count)';
COMMENT ON FUNCTION get_leave_applications_with_half_day_support() IS 'Returns leave applications with full half day support including period information';
COMMENT ON FUNCTION get_all_employees_leave_balances(integer) IS 'Returns leave balance data for all active employees with support for decimal used_days and remaining_days';
