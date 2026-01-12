/*
  # Create Optimized User Function for Attendance Reports
  
  This migration creates a lightweight function that returns only the essential
  fields needed for attendance reports, reducing data transfer and improving performance.
  
  Fields included:
  - id, email, full_name, employee_id
  - role_id, department_id
  - date_of_joining, status
  - manager_id, tenure_mechlin
  - designation_offer_letter, employment_terms
  - isSA, comp_off_balance
  - department_name
*/

-- Create optimized function for attendance reports
CREATE OR REPLACE FUNCTION get_users_for_attendance_reports()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  employee_id text,
  role_id uuid,
  department_id uuid,
  date_of_joining date,
  status text,
  manager_id uuid,
  tenure_mechlin interval,
  designation_offer_letter text,
  employment_terms text,
  "isSA" boolean,
  comp_off_balance numeric,
  department_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.employee_id,
    u.role_id,
    u.department_id,
    u.date_of_joining,
    u.status,
    u.manager_id,
    u.tenure_mechlin,
    u.designation_offer_letter,
    u.employment_terms,
    u."isSA",
    COALESCE(u.comp_off_balance, 0) as comp_off_balance,
    d.name as department_name
  FROM users u
  LEFT JOIN departments d ON u.department_id = d.id
  WHERE u.status != 'deleted'
  ORDER BY u.full_name;
END;
$$;

-- Create optimized function for single user (for daywise attendance)
CREATE OR REPLACE FUNCTION get_user_for_attendance_reports(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  employee_id text,
  role_id uuid,
  department_id uuid,
  date_of_joining date,
  status text,
  manager_id uuid,
  tenure_mechlin interval,
  designation_offer_letter text,
  employment_terms text,
  "isSA" boolean,
  comp_off_balance numeric,
  department_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.full_name,
    u.employee_id,
    u.role_id,
    u.department_id,
    u.date_of_joining,
    u.status,
    u.manager_id,
    u.tenure_mechlin,
    u.designation_offer_letter,
    u.employment_terms,
    u."isSA",
    COALESCE(u.comp_off_balance, 0) as comp_off_balance,
    d.name as department_name
  FROM users u
  LEFT JOIN departments d ON u.department_id = d.id
  WHERE u.id = p_user_id
    AND u.status != 'deleted';
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_users_for_attendance_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_for_attendance_reports(uuid) TO authenticated;

COMMENT ON FUNCTION get_users_for_attendance_reports() IS 'Returns only essential user fields needed for attendance reports to optimize performance';
COMMENT ON FUNCTION get_user_for_attendance_reports(uuid) IS 'Returns only essential user fields for a specific user ID (optimized for daywise attendance)';

