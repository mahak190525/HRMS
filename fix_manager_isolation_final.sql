-- Final fix for manager isolation - Users cannot view their own requests
-- Only managers can view requests from their direct reports
-- HR/Admin can view all requests

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

-- 1. Users can create their own requests (but not view them)
CREATE POLICY "users_create_own_requests" ON asset_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Users can update their own pending requests (but not view them)
CREATE POLICY "users_update_own_pending_requests" ON asset_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- 3. CORE POLICY: Managers can ONLY view requests from users they directly manage
-- This excludes the manager's own requests (as per requirement)
CREATE POLICY "managers_view_direct_reports_requests" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users requester
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE asset_requests.user_id = requester.id
      AND requester.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- 4. HR/Admin can view all requests
CREATE POLICY "hr_admin_view_all_requests" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- 5. Update permissions for managers and HR
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
COMMENT ON POLICY "users_create_own_requests" ON asset_requests IS 
'Users can create their own asset requests but cannot view them in the employee management dashboard';

COMMENT ON POLICY "managers_view_direct_reports_requests" ON asset_requests IS 
'Managers can ONLY view asset requests from their direct reports (users with manager_id = current user ID). Managers cannot view their own requests in the employee management dashboard.';

COMMENT ON POLICY "hr_admin_view_all_requests" ON asset_requests IS 
'HR/Admin/Super Admin users can view all asset requests regardless of hierarchy';

-- Verify the policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN policyname LIKE '%manager%' THEN 'Manager Policy - Direct Reports Only'
    WHEN policyname LIKE '%hr%' OR policyname LIKE '%admin%' THEN 'Admin Policy - All Requests'
    WHEN policyname LIKE '%create%' THEN 'User Policy - Create Only'
    WHEN policyname LIKE '%update%' THEN 'User Policy - Update Own Pending'
    ELSE 'Other Policy'
  END as description
FROM pg_policies 
WHERE tablename = 'asset_requests' 
AND schemaname = 'public'
ORDER BY policyname;
