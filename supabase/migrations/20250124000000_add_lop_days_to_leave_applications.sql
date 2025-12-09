/*
  # Add LOP (Loss of Pay) Days to Leave Applications
  
  1. Add lop_days column to leave_applications table
  2. This field tracks how many days in a leave application are marked as Loss of Pay
*/

-- Add lop_days column to leave_applications table
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5,2) DEFAULT 0.0;

-- Add comment
COMMENT ON COLUMN leave_applications.lop_days IS 'Number of days in this leave application that are marked as Loss of Pay (LOP). These days are not covered by leave balance or leave rate.';

-- Add check constraint to ensure lop_days is not negative and doesn't exceed days_count
-- Using explicit numeric casting to preserve exact decimal values in comparison
-- Drop constraint if it exists first (for idempotency)
ALTER TABLE leave_applications 
DROP CONSTRAINT IF EXISTS check_lop_days_valid;

ALTER TABLE leave_applications 
ADD CONSTRAINT check_lop_days_valid 
CHECK (lop_days >= 0::numeric(5,2) AND lop_days <= CAST(days_count AS numeric(5,2)));

-- Create index for better query performance on LOP leaves
CREATE INDEX IF NOT EXISTS idx_leave_applications_lop_days ON leave_applications(lop_days) WHERE lop_days > 0;

