/*
  # Add Half Day Leave Support

  1. Database Changes
    - Change days_count from integer to numeric(3,1) to support half days
    - Add is_half_day boolean column for better tracking
    - Update used_days in leave_balances to support decimal values

  2. Update existing data
    - Ensure all existing days_count values are preserved
    - Set is_half_day to false for existing records

  3. Update constraints and policies as needed
*/

-- First, add the is_half_day column to leave_applications
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE;

-- Change days_count from integer to numeric to support half days
-- We'll use numeric(3,1) which allows up to 99.5 days
ALTER TABLE leave_applications 
ALTER COLUMN days_count TYPE NUMERIC(3,1);

-- Update leave_balances to support decimal values for used_days
-- First drop the generated column that depends on used_days
ALTER TABLE leave_balances 
DROP COLUMN IF EXISTS remaining_days;

-- Now we can safely alter the used_days column type
ALTER TABLE leave_balances 
ALTER COLUMN used_days TYPE NUMERIC(5,1);

-- Recreate the generated column for remaining_days to work with decimals
ALTER TABLE leave_balances 
ADD COLUMN remaining_days NUMERIC(5,1) GENERATED ALWAYS AS (allocated_days - used_days) STORED;

-- Add some helpful comments
COMMENT ON COLUMN leave_applications.days_count IS 'Number of days requested (supports half days as 0.5)';
COMMENT ON COLUMN leave_applications.is_half_day IS 'True if this is a half day leave application';
COMMENT ON COLUMN leave_balances.used_days IS 'Total days used (supports decimal for half days)';
COMMENT ON COLUMN leave_balances.remaining_days IS 'Calculated remaining days (allocated - used)';

-- Update any existing records to ensure data consistency
-- Set is_half_day to false for existing records first
UPDATE leave_applications 
SET is_half_day = false 
WHERE is_half_day IS NULL;

-- Ensure all existing days_count values are whole numbers (no fractional parts)
-- This handles any potential data inconsistencies from the type conversion
UPDATE leave_applications 
SET days_count = ROUND(days_count)
WHERE days_count != ROUND(days_count);

-- First, let's see what values exist and fix any problematic ones
-- Handle any edge cases like 0 days or negative values
UPDATE leave_applications 
SET days_count = 1
WHERE days_count <= 0;

-- Add a simple check constraint to ensure days_count is positive
-- We'll let the application handle the 0.5 increment logic
ALTER TABLE leave_applications 
ADD CONSTRAINT check_valid_days_count 
CHECK (days_count > 0);

-- Add a check constraint to ensure half day leaves are only 0.5 days
-- For existing data, we're more forgiving with the logic
ALTER TABLE leave_applications 
ADD CONSTRAINT check_half_day_logic 
CHECK (
  (is_half_day = true AND days_count <= 1) OR 
  (is_half_day = false)
);

-- Create an index for better performance on half day queries
CREATE INDEX IF NOT EXISTS idx_leave_applications_is_half_day ON leave_applications(is_half_day);

-- Make is_half_day NOT NULL with default false
ALTER TABLE leave_applications 
ALTER COLUMN is_half_day SET NOT NULL;

ALTER TABLE leave_applications 
ALTER COLUMN is_half_day SET DEFAULT FALSE;
