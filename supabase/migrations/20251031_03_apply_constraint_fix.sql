-- Apply constraint fix for existing installations
-- Migration: 20251031_07_apply_constraint_fix.sql

-- Drop any existing problematic triggers first
DROP TRIGGER IF EXISTS trigger_policy_activity_log ON policies;

-- Fix the constraint to allow NULL policy_id (for existing installations)
-- First drop the existing constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'policy_activity_logs_policy_id_fkey' 
        AND table_name = 'policy_activity_logs'
    ) THEN
        ALTER TABLE policy_activity_logs DROP CONSTRAINT policy_activity_logs_policy_id_fkey;
    END IF;
END $$;

-- Make policy_id nullable if it isn't already
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'policy_activity_logs' 
        AND column_name = 'policy_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE policy_activity_logs ALTER COLUMN policy_id DROP NOT NULL;
    END IF;
END $$;

-- Add the new constraint with proper CASCADE behavior
ALTER TABLE policy_activity_logs 
ADD CONSTRAINT policy_activity_logs_policy_id_fkey 
FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE SET NULL;

-- Recreate the proper triggers (these functions should already exist from the main migration)
-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS trigger_policy_activity_log_before ON policies;
DROP TRIGGER IF EXISTS trigger_policy_activity_log_after_insert ON policies;

-- Create BEFORE trigger for UPDATE and DELETE
CREATE TRIGGER trigger_policy_activity_log_before
    BEFORE UPDATE OR DELETE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_policy_activity();

-- Create AFTER INSERT trigger for creation logging
CREATE TRIGGER trigger_policy_activity_log_after_insert
    AFTER INSERT ON policies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_policy_creation();
