-- Complete fix for manager isolation
-- This ensures managers can see BOTH their own requests AND their direct reports' requests

-- Drop ALL existing policies on asset_requests
DO $$ 
DECLARE
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'asset_requests' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON asset_requests', pol_name);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE asset_requests ENABLE ROW LEVEL SECURITY;

-- Create the correct policies

-- 1. Users can view their own requests
CREATE POLICY "users_view_own_requests" ON asset_requests
  FOR SELECT USING (user_id = auth.uid());

-- 2. Users can create their own requests  
CREATE POLICY "users_create_own_requests" ON asset_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Users can update their own pending requests
CREATE POLICY "users_update_own_pending_requests" ON asset_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- 4. FIXED: Managers can view requests from users they directly manage
-- This policy ONLY applies to direct reports, not the manager's own requests
CREATE POLICY "managers_view_direct_reports_requests" ON asset_requests
  FOR SELECT USING (
    -- Manager viewing direct reports' requests (not their own)
    user_id != auth.uid() AND
    EXISTS (
      SELECT 1 FROM users requester
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- 5. HR/Admin can view all requests
CREATE POLICY "hr_admin_view_all_requests" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- 6. Update permissions for managers and HR
CREATE POLICY "managers_hr_update_requests" ON asset_requests
  FOR UPDATE USING (
    -- HR/Admin can update all requests
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
    OR
    -- Managers can update requests from users they directly manage
    EXISTS (
      SELECT 1 FROM users requester
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- Add explanatory comments
COMMENT ON POLICY "users_view_own_requests" ON asset_requests IS 
'Users (including managers) can view their own asset requests';

COMMENT ON POLICY "managers_view_direct_reports_requests" ON asset_requests IS 
'Managers can view asset requests from their direct reports (users with manager_id = auth.uid()). This policy specifically excludes the managers own requests to avoid conflicts with the user policy.';

COMMENT ON POLICY "hr_admin_view_all_requests" ON asset_requests IS 
'HR/Admin/Super Admin users can view all asset requests regardless of hierarchy';

-- Verify the policies
SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public'
ORDER BY policyname;
