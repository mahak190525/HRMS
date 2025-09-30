-- Migration: Fix manager isolation by ensuring all conflicting policies are dropped
-- This should resolve the issue where BDM can see all requests instead of only managed users

-- First, let's see what policies exist (for debugging)
-- SELECT * FROM pg_policies WHERE tablename = 'asset_requests';

-- Drop ALL existing policies on asset_requests to start clean
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

-- Drop ALL existing policies on asset_assignments to start clean
DO $$ 
DECLARE
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'asset_assignments' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON asset_assignments', pol_name);
    END LOOP;
END $$;

-- Drop ALL existing policies on asset_complaints to start clean
DO $$ 
DECLARE
    pol_name text;
BEGIN
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'asset_complaints' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON asset_complaints', pol_name);
    END LOOP;
END $$;

-- Now create ONLY the policies we want

-- ASSET REQUESTS POLICIES
-- Users can view their own requests
CREATE POLICY "Users can view own asset requests" ON asset_requests
  FOR SELECT USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own asset requests" ON asset_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pending requests
CREATE POLICY "Users can update own pending asset requests" ON asset_requests
  FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Managers can ONLY view requests from users they directly manage
CREATE POLICY "Managers view only managed user requests" ON asset_requests
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

-- HR/Admin can view all requests
CREATE POLICY "HR admin view all requests" ON asset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- Managers can update requests from users they directly manage
CREATE POLICY "Managers update only managed user requests" ON asset_requests
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

-- ASSET ASSIGNMENTS POLICIES
-- Users can view their own assignments
CREATE POLICY "Users can view own asset assignments" ON asset_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Managers can ONLY view assignments for users they directly manage
CREATE POLICY "Managers view only managed user assignments" ON asset_assignments
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

-- HR/Admin can view all assignments
CREATE POLICY "HR admin view all assignments" ON asset_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- ASSET COMPLAINTS POLICIES
-- Users can view their own complaints
CREATE POLICY "Users can view own asset complaints" ON asset_complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM asset_assignments aa
      WHERE asset_complaints.asset_assignment_id = aa.id
      AND aa.user_id = auth.uid()
    )
  );

-- Managers can ONLY view complaints from users they directly manage
CREATE POLICY "Managers view only managed user complaints" ON asset_complaints
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

-- HR/Admin can view all complaints
CREATE POLICY "HR admin view all complaints" ON asset_complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND (u."isSA" = true OR r.name IN ('hr', 'admin', 'super_admin'))
    )
  );

-- Comments for clarity
COMMENT ON POLICY "Managers view only managed user requests" ON asset_requests IS 'BDM/SDM/QAM can ONLY view requests from users who have their ID in manager_id column';
COMMENT ON POLICY "Managers view only managed user assignments" ON asset_assignments IS 'BDM/SDM/QAM can ONLY view assignments for users who have their ID in manager_id column';
COMMENT ON POLICY "Managers view only managed user complaints" ON asset_complaints IS 'BDM/SDM/QAM can ONLY view complaints from users who have their ID in manager_id column';
