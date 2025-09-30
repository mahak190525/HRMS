-- First drop the conflicting foreign key constraints
ALTER TABLE leave_balance_adjustments
  DROP CONSTRAINT IF EXISTS leave_balance_adjustments_balance_id_fkey,
  DROP CONSTRAINT IF EXISTS leave_balance_adjustments_leave_balance_id_fkey;

-- Then drop the duplicate column if it exists
ALTER TABLE leave_balance_adjustments
  DROP COLUMN IF EXISTS leave_balance_id;

-- Ensure we have just one column with the correct name and constraint
ALTER TABLE leave_balance_adjustments
  ALTER COLUMN balance_id SET NOT NULL,
  ADD CONSTRAINT leave_balance_adjustments_balance_id_fkey 
    FOREIGN KEY (balance_id) 
    REFERENCES leave_balances(id)
    ON DELETE CASCADE;

-- Create index for better performance
DROP INDEX IF EXISTS idx_leave_balance_adjustments_balance_id;
CREATE INDEX idx_leave_balance_adjustments_balance_id 
  ON leave_balance_adjustments(balance_id);