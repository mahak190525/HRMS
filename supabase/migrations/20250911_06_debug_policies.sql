-- Debug migration: Show all current policies for asset tables
-- This will help us understand what policies are currently active

-- Create a temporary function to show policies
CREATE OR REPLACE FUNCTION debug_show_policies()
RETURNS TABLE(
  table_name text,
  policy_name text,
  policy_cmd text,
  policy_qual text
) 
LANGUAGE sql
AS $$
  SELECT 
    tablename::text,
    policyname::text,
    cmd::text,
    qual::text
  FROM pg_policies 
  WHERE tablename IN ('asset_requests', 'asset_assignments', 'asset_complaints', 'users')
  AND schemaname = 'public'
  ORDER BY tablename, policyname;
$$;

-- You can run this query to see current policies:
-- SELECT * FROM debug_show_policies();

-- Also create a function to test manager access
CREATE OR REPLACE FUNCTION test_manager_access(test_user_id uuid)
RETURNS TABLE(
  user_name text,
  manager_id uuid,
  role_name text,
  can_see_requests boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.full_name::text,
    u.manager_id,
    r.name::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM asset_requests ar
        JOIN users requester ON ar.user_id = requester.id
        WHERE requester.manager_id = test_user_id
      ) THEN true
      ELSE false
    END as can_see_requests
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = test_user_id;
END;
$$;

-- Test with your user ID:
-- SELECT * FROM test_manager_access('your-user-id-here');

COMMENT ON FUNCTION debug_show_policies() IS 'Shows all RLS policies for asset tables to help debug access issues';
COMMENT ON FUNCTION test_manager_access(uuid) IS 'Tests if a manager can see requests based on manager_id relationships';
