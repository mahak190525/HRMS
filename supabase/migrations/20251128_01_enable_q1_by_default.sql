/*
  # Enable Q1 by Default for KRA Assignments
  
  This migration ensures that Q1 is enabled by default when KRAs are assigned or reassigned:
  1. Changes the default value of q1_enabled from false to true
  2. Updates existing assignments that don't have Q1 enabled to enable it
  3. Ensures all future assignments will have Q1 enabled by default
*/

-- Change the default value of q1_enabled to true for future records
ALTER TABLE kra_assignments 
ALTER COLUMN q1_enabled SET DEFAULT true;

-- Update existing assignments that don't have Q1 enabled
UPDATE kra_assignments 
SET 
    q1_enabled = true,
    q1_enabled_at = COALESCE(q1_enabled_at, created_at, now()),
    q1_enabled_by = COALESCE(q1_enabled_by, assigned_by),
    q1_status = COALESCE(q1_status, 'not_started')
WHERE q1_enabled = false OR q1_enabled IS NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN kra_assignments.q1_enabled IS 'Whether Q1 evidence submission is enabled for the employee (default: true)';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Q1 is now enabled by default for all KRA assignments';
END $$;
