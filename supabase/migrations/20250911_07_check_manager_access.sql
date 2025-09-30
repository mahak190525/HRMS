-- Check current manager access and debug RLS policies

-- First, let's see what policies exist
SELECT 
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public'
ORDER BY policyname;

-- Check if we can see users and their manager relationships
-- (This should show all users for debugging)
CREATE OR REPLACE FUNCTION debug_user_manager_relationships()
RETURNS TABLE(
  user_id uuid,
  user_name text,
  user_role text,
  manager_id uuid,
  manager_name text
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    u.id,
    u.full_name,
    r.name,
    u.manager_id,
    m.full_name as manager_name
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN users m ON u.manager_id = m.id
  ORDER BY u.full_name;
$$;

-- Check asset requests and their user relationships
CREATE OR REPLACE FUNCTION debug_asset_requests_access()
RETURNS TABLE(
  request_id uuid,
  requester_name text,
  requester_manager_id uuid,
  requester_manager_name text,
  request_status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ar.id,
    u.full_name as requester_name,
    u.manager_id,
    m.full_name as manager_name,
    ar.status,
    ar.created_at
  FROM asset_requests ar
  JOIN users u ON ar.user_id = u.id
  LEFT JOIN users m ON u.manager_id = m.id
  ORDER BY ar.created_at DESC;
$$;

-- Test what the current user can see with RLS
CREATE OR REPLACE FUNCTION test_current_user_asset_access()
RETURNS TABLE(
  request_count bigint,
  current_user_id uuid,
  current_user_role text
)
LANGUAGE sql
SECURITY INVOKER  -- This will use RLS policies
AS $$
  SELECT 
    COUNT(*) as request_count,
    auth.uid() as current_user_id,
    (SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid()) as current_user_role
  FROM asset_requests;
$$;

-- You can run these queries to debug:
-- SELECT * FROM debug_user_manager_relationships();
-- SELECT * FROM debug_asset_requests_access();
-- SELECT * FROM test_current_user_asset_access();

COMMENT ON FUNCTION debug_user_manager_relationships() IS 'Shows all user-manager relationships for debugging';
COMMENT ON FUNCTION debug_asset_requests_access() IS 'Shows all asset requests with manager relationships for debugging';
COMMENT ON FUNCTION test_current_user_asset_access() IS 'Tests what the current user can see with RLS policies';
