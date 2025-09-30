-- Test if RLS is working properly

-- Enable RLS on asset_requests (in case it's not enabled)
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- Create a simple test policy that should definitely work
CREATE POLICY "test_policy_no_access" ON asset_requests
  FOR SELECT USING (false);  -- This should block ALL access

-- Drop the test policy (so we can see if policies are working)
-- DROP POLICY "test_policy_no_access" ON asset_requests;

-- Now let's create a very specific manager policy that's easier to debug
CREATE POLICY "debug_manager_access" ON asset_requests
  FOR SELECT USING (
    -- Check if the current user is a manager and the request is from their direct report
    EXISTS (
      SELECT 1 
      FROM users requester
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
    )
  );

-- Create a separate HR policy
CREATE POLICY "debug_hr_access" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('hr', 'admin', 'super_admin')
    )
  );

-- Create user own access policy
CREATE POLICY "debug_user_own_access" ON asset_requests
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON POLICY "debug_manager_access" ON asset_requests IS 'Simple manager access for debugging - only direct reports';
COMMENT ON POLICY "debug_hr_access" ON asset_requests IS 'HR/Admin access for debugging';
COMMENT ON POLICY "debug_user_own_access" ON asset_requests IS 'Users can see their own requests';
