/*
  # Add LOP Days and Half Day Fields to Leave Application Functions
  
  Update the leave application functions to include lop_days and is_half_day fields
  so they can be displayed in the employee management dashboard.
*/

-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS get_leave_applications_with_manager_details();
DROP FUNCTION IF EXISTS get_leave_applications_for_manager(uuid);

-- Update function to get leave applications with manager details
CREATE OR REPLACE FUNCTION get_leave_applications_with_manager_details()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days_count numeric(3,1),
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  is_half_day boolean,
  half_day_period text,
  lop_days numeric(5,2),
  
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
    COALESCE(la.is_half_day, false) as is_half_day,
    la.half_day_period::text,
    COALESCE(la.lop_days, 0) as lop_days,
    
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
  days_count numeric(3,1),
  reason text,
  status text,
  applied_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  comments text,
  created_at timestamptz,
  updated_at timestamptz,
  is_half_day boolean,
  half_day_period text,
  lop_days numeric(5,2),
  
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
    COALESCE(la.is_half_day, false) as is_half_day,
    la.half_day_period::text,
    COALESCE(la.lop_days, 0) as lop_days,
    
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

