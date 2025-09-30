-- Force refresh RLS policies and connections
-- This should fix the enforcement issue

-- 1. Completely disable and re-enable RLS to force refresh
ALTER TABLE asset_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- 2. Force policy refresh by touching each policy
-- Drop and recreate the manager policy to ensure it's fresh
DROP POLICY IF EXISTS "managers_view_direct_reports_only" ON asset_requests;

-- Recreate with explicit conditions to ensure clarity
CREATE POLICY "managers_view_direct_reports_only" ON asset_requests
  FOR SELECT 
  USING (
    -- Current user must be a manager
    EXISTS (
      SELECT 1 FROM users mgr_user
      JOIN roles mgr_role ON mgr_user.role_id = mgr_role.id
      WHERE mgr_user.id = auth.uid()
      AND mgr_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
    AND
    -- Request must be from a direct report (NOT from the manager themselves)
    EXISTS (
      SELECT 1 FROM users requester
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
      AND requester.id != auth.uid()  -- Explicitly exclude manager's own requests
    )
  );

-- 3. Test the policy immediately
SELECT 
  'Policy Test After Refresh' as test_name,
  ar.id,
  u.full_name,
  CASE 
    WHEN u.manager_id = '8bc2d108-047c-45ba-8e59-e27c95ccc924' AND u.id != '8bc2d108-047c-45ba-8e59-e27c95ccc924' 
    THEN 'SHOULD_BE_VISIBLE' 
    ELSE 'SHOULD_NOT_BE_VISIBLE' 
  END as expected_visibility
FROM asset_requests ar
JOIN users u ON ar.user_id = u.id
ORDER BY ar.created_at DESC;

-- 4. Force connection refresh hint
-- Close all connections and reconnect your app after running this

SELECT 'RLS POLICIES REFRESHED - Please refresh your application' as status;
