/*
  # Create Leave Balance Adjustments Table
  
  This migration creates a table to track manual adjustments made to leave balances
  by HR/admin users for audit trail purposes.
*/

-- Create leave balance adjustments table for audit trail
CREATE TABLE IF NOT EXISTS leave_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  leave_balance_id uuid REFERENCES leave_balances(id) NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('add', 'subtract')),
  amount integer NOT NULL,
  reason text NOT NULL,
  previous_allocated integer NOT NULL,
  new_allocated integer NOT NULL,
  adjusted_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE leave_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_balance_adjustments
CREATE POLICY "HR can view all adjustments"
  ON leave_balance_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

CREATE POLICY "Users can view their own adjustments"
  ON leave_balance_adjustments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "HR can create adjustments"
  ON leave_balance_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id IN (
        SELECT id FROM roles WHERE name IN ('super_admin', 'admin', 'hr')
      )
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leave_balance_adjustments_user_id ON leave_balance_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_adjustments_balance_id ON leave_balance_adjustments(leave_balance_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_adjustments_created_at ON leave_balance_adjustments(created_at);

-- Add comments
COMMENT ON TABLE leave_balance_adjustments IS 'Audit trail for manual leave balance adjustments by HR/admin';
COMMENT ON COLUMN leave_balance_adjustments.adjustment_type IS 'Type of adjustment: add or subtract';
COMMENT ON COLUMN leave_balance_adjustments.amount IS 'Number of days adjusted';
COMMENT ON COLUMN leave_balance_adjustments.reason IS 'Reason for the adjustment';
COMMENT ON COLUMN leave_balance_adjustments.adjusted_by IS 'User who made the adjustment';
