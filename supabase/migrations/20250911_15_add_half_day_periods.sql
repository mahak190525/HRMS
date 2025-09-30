/*
  # Add Half Day Period Support

  1. Database Changes
    - Add half_day_period column to leave_applications
    - Support for '1st_half' (morning) and '2nd_half' (afternoon)
    - Update constraints to ensure period is specified for half day leaves

  2. Data Validation
    - Ensure half_day_period is only set for half day leaves
    - Add check constraint for valid period values

  3. Comments and Documentation
    - Add helpful comments for understanding the feature
*/

-- Add the half_day_period column to leave_applications
ALTER TABLE leave_applications 
ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(10);

-- Add check constraint for valid half day periods
ALTER TABLE leave_applications 
ADD CONSTRAINT check_valid_half_day_period 
CHECK (half_day_period IS NULL OR half_day_period IN ('1st_half', '2nd_half'));

-- Update the existing half day logic constraint to include period requirement
ALTER TABLE leave_applications 
DROP CONSTRAINT IF EXISTS check_half_day_logic;

ALTER TABLE leave_applications 
ADD CONSTRAINT check_half_day_logic 
CHECK (
  (is_half_day = true AND days_count = 0.5 AND half_day_period IN ('1st_half', '2nd_half')) OR 
  (is_half_day = false AND days_count >= 1 AND half_day_period IS NULL)
);

-- Add helpful comments
COMMENT ON COLUMN leave_applications.half_day_period IS 'Period of half day leave: 1st_half (morning) or 2nd_half (afternoon)';

-- Create an index for better performance on half day period queries
CREATE INDEX IF NOT EXISTS idx_leave_applications_half_day_period ON leave_applications(half_day_period);

-- Add a view for easy querying of half day leaves with periods
CREATE OR REPLACE VIEW half_day_leaves_view AS
SELECT 
  la.*,
  u.full_name,
  u.employee_id,
  lt.name as leave_type_name,
  CASE 
    WHEN la.half_day_period = '1st_half' THEN 'Morning (1st Half)'
    WHEN la.half_day_period = '2nd_half' THEN 'Afternoon (2nd Half)'
    ELSE 'Full Day'
  END as period_display,
  CASE 
    WHEN la.half_day_period = '1st_half' THEN '9:00 AM - 1:00 PM'
    WHEN la.half_day_period = '2nd_half' THEN '2:00 PM - 6:00 PM'
    ELSE 'Full Day'
  END as time_range
FROM leave_applications la
JOIN users u ON la.user_id = u.id
JOIN leave_types lt ON la.leave_type_id = lt.id
WHERE la.is_half_day = true;

-- Grant permissions on the view
GRANT SELECT ON half_day_leaves_view TO authenticated;

-- Add helpful documentation
COMMENT ON VIEW half_day_leaves_view IS 'View showing half day leaves with human-readable period information';
COMMENT ON CONSTRAINT check_half_day_logic ON leave_applications IS 'Ensures half day leaves have exactly 0.5 days and a valid period, full day leaves have >= 1 day and no period';
COMMENT ON CONSTRAINT check_valid_half_day_period ON leave_applications IS 'Ensures half_day_period is either 1st_half or 2nd_half when specified';
