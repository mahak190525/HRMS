-- Migration: Implement direct manager isolation
-- Managers (SDM, QAM, BDM) can only see data for users they directly manage
-- This replaces the department-based approach with a direct manager_id relationship

-- Drop all existing manager policies that were department-based and any conflicting policies
DROP POLICY IF EXISTS "Managers can view department asset requests" ON asset_requests;
DROP POLICY IF EXISTS "Managers can update department asset requests" ON asset_requests;
DROP POLICY IF EXISTS "Managers can view department asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Managers can update department asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Managers can view department complaints" ON asset_complaints;
DROP POLICY IF EXISTS "Managers can update department complaints" ON asset_complaints;
DROP POLICY IF EXISTS "Managers can view department users" ON users;
DROP POLICY IF EXISTS "Managers can view managed user asset requests" ON asset_requests;
DROP POLICY IF EXISTS "HR can view all asset requests" ON asset_requests;
DROP POLICY IF EXISTS "Managers and admins can update asset requests" ON asset_requests;
DROP POLICY IF EXISTS "Managers can update managed user asset requests" ON asset_requests;
DROP POLICY IF EXISTS "Managers can view managed user asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Managers can update managed user asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Managers can view managed user asset complaints" ON asset_complaints;
DROP POLICY IF EXISTS "Managers can update managed user asset complaints" ON asset_complaints;
DROP POLICY IF EXISTS "Managers can view managed users" ON users;

-- Asset Requests: Direct manager access only
CREATE POLICY "Managers can view managed user asset requests" ON asset_requests
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

-- HR/Admin can view all asset requests
CREATE POLICY "HR can view all asset requests" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

CREATE POLICY "Managers can update managed user asset requests" ON asset_requests
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

-- Asset Assignments: Direct manager access only
CREATE POLICY "Managers can view managed user asset assignments" ON asset_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users assignee
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE asset_assignments.user_id = assignee.id
      AND assignee.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- HR/Admin can view all asset assignments
CREATE POLICY "HR can view all asset assignments" ON asset_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

CREATE POLICY "Managers can update managed user asset assignments" ON asset_assignments
  FOR UPDATE USING (
    -- HR/Admin can update all assignments
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
    OR
    -- Managers can update assignments for users they directly manage
    EXISTS (
      SELECT 1 FROM users assignee
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE asset_assignments.user_id = assignee.id
      AND assignee.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- Asset Complaints: Direct manager access only
CREATE POLICY "Managers can view managed user asset complaints" ON asset_complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users complaint_user
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      JOIN asset_assignments aa ON asset_complaints.asset_assignment_id = aa.id
      WHERE aa.user_id = complaint_user.id
      AND complaint_user.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- HR/Admin can view all asset complaints
CREATE POLICY "HR can view all asset complaints" ON asset_complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

CREATE POLICY "Managers can update managed user asset complaints" ON asset_complaints
  FOR UPDATE USING (
    -- HR/Admin can update all complaints
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
    OR
    -- Managers can update complaints from users they directly manage
    EXISTS (
      SELECT 1 FROM users complaint_user
      JOIN users manager_user ON manager_user.id = auth.uid()
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      JOIN asset_assignments aa ON asset_complaints.asset_assignment_id = aa.id
      WHERE aa.user_id = complaint_user.id
      AND complaint_user.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- Users: Direct manager access only (for employee management)
CREATE POLICY "Managers can view managed users" ON users
  FOR SELECT USING (
    -- User can see themselves
    id = auth.uid() OR
    -- HR/Admin can see all users
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    ) OR
    -- Managers can see users they directly manage
    EXISTS (
      SELECT 1 FROM users manager_user
      JOIN roles manager_role ON manager_user.role_id = manager_role.id
      WHERE manager_user.id = auth.uid()
      AND users.manager_id = auth.uid()
      AND manager_role.name IN ('sdm', 'bdm', 'qam', 'hrm')
    )
  );

-- Comments for clarity
COMMENT ON POLICY "Managers can view managed user asset requests" ON asset_requests IS 'Managers can only view asset requests from users who have their ID in the manager_id column';
COMMENT ON POLICY "Managers can view managed user asset assignments" ON asset_assignments IS 'Managers can only view asset assignments for users who have their ID in the manager_id column';
COMMENT ON POLICY "Managers can view managed user asset complaints" ON asset_complaints IS 'Managers can only view asset complaints from users who have their ID in the manager_id column';
COMMENT ON POLICY "Managers can view managed users" ON users IS 'Managers can only view users who have their ID in the manager_id column';
