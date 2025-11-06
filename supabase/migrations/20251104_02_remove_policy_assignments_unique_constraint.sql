-- Remove unique constraint from policy_assignments to allow multiple assignments
-- Migration: 20251104_02_remove_policy_assignments_unique_constraint.sql

-- Drop the unique constraint if it exists
ALTER TABLE policy_assignments 
DROP CONSTRAINT IF EXISTS policy_assignments_policy_id_user_id_key;

-- Add comment explaining why multiple assignments are allowed
COMMENT ON TABLE policy_assignments IS 'Stores assignments of policies to employees for review and acknowledgement. Multiple assignments of the same policy to the same employee are allowed when policies are updated and need to be reviewed again.';

