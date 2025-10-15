-- Add finance role access to leave management
-- This migration updates RLS policies to include finance and finance_manager roles

-- Update leave_applications SELECT policy to include finance roles
DROP POLICY IF EXISTS "HR and managers can read all leave applications" ON leave_applications;
CREATE POLICY "HR, managers, and finance can read all leave applications"
  ON leave_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam', 'finance', 'finance_manager')
      )
    )
  );

-- Update leave_applications UPDATE policy to include finance roles
DROP POLICY IF EXISTS "HR and managers can approve/reject leave applications" ON leave_applications;
CREATE POLICY "HR, managers, and finance can approve/reject leave applications"
  ON leave_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'sdm', 'bdm', 'qam', 'finance', 'finance_manager')
      )
    )
  );

-- Update leave_balances SELECT policy to include finance roles
DROP POLICY IF EXISTS "HR can read all leave balances" ON leave_balances;
CREATE POLICY "HR and finance can read all leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'finance', 'finance_manager')
      )
    )
  );

-- Update leave_balances UPDATE policy to include finance roles
DROP POLICY IF EXISTS "HR can update all leave balances" ON leave_balances;
CREATE POLICY "HR and finance can update all leave balances"
  ON leave_balances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr', 'finance', 'finance_manager')
      )
    )
  );
