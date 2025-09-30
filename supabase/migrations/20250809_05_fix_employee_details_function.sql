/*
  # Fix Employee Details Function

  Fix the get_employee_details function to properly join with departments table
  instead of accessing non-existent u.department column.
*/

-- Fix the get_employee_details function to properly get department from departments table
CREATE OR REPLACE FUNCTION get_employee_details(p_user_id uuid)
RETURNS TABLE (
  department text,
  manager_name text,
  manager_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.name as department,
    m.full_name as manager_name,
    u.manager_id
  FROM users u
  LEFT JOIN users m ON u.manager_id = m.id
  LEFT JOIN departments d ON u.department_id = d.id
  WHERE u.id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_employee_details TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_employee_details IS 'Returns department name and manager details for an employee by joining with departments table';
