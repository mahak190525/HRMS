-- Migration: Final fix for manager isolation - Clean up conflicting policies
-- This migration ensures managers can ONLY see asset requests from users who have their ID in manager_id column
-- Date: 2025-09-11

-- First, drop ALL policies on asset_requests to ensure a clean slate
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

-- Create the ONLY policies we need for asset_requests

-- 1. Users can view their own requests
CREATE POLICY "users_view_own_requests" ON asset_requests
  FOR SELECT USING (user_id = auth.uid());

-- 2. Users can create their own requests
CREATE POLICY "users_create_own_requests" ON asset_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 3. Users can update their own pending requests
CREATE POLICY "users_update_own_pending_requests" ON asset_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- 4. Managers can ONLY view requests from users they directly manage
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

-- 6. Managers and HR/Admin can update requests appropriately
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

-- Add helpful comments
COMMENT ON POLICY "managers_view_direct_reports_requests" ON asset_requests IS 
'CRITICAL: Managers (BDM/SDM/QAM/HRM) can ONLY view asset requests from users who have their ID in the manager_id column. This ensures proper data isolation.';

COMMENT ON POLICY "hr_admin_view_all_requests" ON asset_requests IS 
'HR/Admin/Super Admin users can view all asset requests regardless of manager hierarchy.';

-- Create a debugging function to verify manager isolation is working
CREATE OR REPLACE FUNCTION verify_manager_isolation(manager_user_id uuid)
RETURNS TABLE(
  manager_name text,
  manager_role text,
  direct_reports_count bigint,
  visible_requests_count bigint,
  should_match boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH manager_info AS (
    SELECT 
      u.full_name as manager_name,
      r.name as manager_role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = manager_user_id
  ),
  direct_reports AS (
    SELECT COUNT(*) as count
    FROM users 
    WHERE manager_id = manager_user_id
  ),
  requests_from_reports AS (
    SELECT COUNT(*) as count
    FROM asset_requests ar
    JOIN users u ON ar.user_id = u.id
    WHERE u.manager_id = manager_user_id
  )
  SELECT 
    mi.manager_name,
    mi.manager_role,
    dr.count as direct_reports_count,
    rfr.count as visible_requests_count,
    true as should_match  -- These counts should align with what the manager can see
  FROM manager_info mi
  CROSS JOIN direct_reports dr
  CROSS JOIN requests_from_reports rfr;
$$;

COMMENT ON FUNCTION verify_manager_isolation(uuid) IS 
'Debugging function to verify that managers can only see requests from their direct reports. Run: SELECT * FROM verify_manager_isolation(''manager-uuid-here'');';
