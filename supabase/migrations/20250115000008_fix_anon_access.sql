/*
  # Fix Anonymous Access for Leave Balance Management
  
  This migration updates RLS policies and function permissions to work with
  anonymous (anon) role instead of authenticated role.
*/

-- Update leave_balance_adjustments policies for anon role
-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "HR can create adjustments" ON leave_balance_adjustments;
DROP POLICY IF EXISTS "Allow authenticated insert" ON leave_balance_adjustments;
DROP POLICY IF EXISTS "HR can view all adjustments" ON leave_balance_adjustments;
DROP POLICY IF EXISTS "Users can view their own adjustments" ON leave_balance_adjustments;

-- Create policies for anon role
CREATE POLICY "Allow anon insert"
  ON leave_balance_adjustments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon select"
  ON leave_balance_adjustments FOR SELECT
  TO anon
  USING (true);

-- Update function permissions
GRANT EXECUTE ON FUNCTION adjust_leave_balance TO anon;
GRANT EXECUTE ON FUNCTION get_all_employees_leave_balances TO anon;

-- Update other functions that might be used
GRANT EXECUTE ON FUNCTION get_user_leave_summary TO anon;
GRANT EXECUTE ON FUNCTION recalculate_user_leave_balance TO anon;
GRANT EXECUTE ON FUNCTION manual_leave_maintenance TO anon;
GRANT EXECUTE ON FUNCTION credit_monthly_leaves TO anon;
GRANT EXECUTE ON FUNCTION process_anniversary_actions TO anon;

-- Update leave_balances table policies for anon if they exist
DROP POLICY IF EXISTS "Users can view own balances" ON leave_balances;
DROP POLICY IF EXISTS "Users can update own balances" ON leave_balances;

CREATE POLICY "Allow anon read leave_balances"
  ON leave_balances FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon update leave_balances"
  ON leave_balances FOR UPDATE
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert leave_balances"
  ON leave_balances FOR INSERT
  TO anon
  WITH CHECK (true);

-- Grant table permissions to anon
GRANT SELECT, INSERT, UPDATE ON leave_balances TO anon;
GRANT SELECT, INSERT ON leave_balance_adjustments TO anon;
GRANT SELECT ON leave_types TO anon;
GRANT SELECT ON users TO anon;

-- Add comments
COMMENT ON POLICY "Allow anon insert" ON leave_balance_adjustments IS 'Allows anonymous role to insert audit records';
COMMENT ON POLICY "Allow anon select" ON leave_balance_adjustments IS 'Allows anonymous role to read audit records';
COMMENT ON POLICY "Allow anon read leave_balances" ON leave_balances IS 'Allows anonymous role to read leave balances';
COMMENT ON POLICY "Allow anon update leave_balances" ON leave_balances IS 'Allows anonymous role to update leave balances';
COMMENT ON POLICY "Allow anon insert leave_balances" ON leave_balances IS 'Allows anonymous role to insert leave balances';
