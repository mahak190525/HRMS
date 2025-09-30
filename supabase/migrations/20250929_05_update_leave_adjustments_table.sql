-- Add missing columns to leave_balance_adjustments table
ALTER TABLE leave_balance_adjustments
  ADD COLUMN IF NOT EXISTS balance_id uuid REFERENCES leave_balances(id),
  ADD COLUMN IF NOT EXISTS previous_allocated numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_allocated numeric NOT NULL DEFAULT 0;

-- Update existing records to link with leave_balances
UPDATE leave_balance_adjustments la
SET balance_id = lb.id,
    previous_allocated = lb.allocated_days - CASE 
      WHEN la.adjustment_type = 'add' THEN la.amount 
      ELSE -la.amount 
    END,
    new_allocated = lb.allocated_days
FROM leave_balances lb
WHERE la.user_id = lb.user_id
  AND DATE_TRUNC('year', la.created_at) = DATE_TRUNC('year', MAKE_DATE(lb.year, 1, 1));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leave_balance_adjustments_balance_id ON leave_balance_adjustments(balance_id);